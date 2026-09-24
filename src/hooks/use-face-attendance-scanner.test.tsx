import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { eyeWithEar, syntheticDescriptor } from "@/test/face-fixtures";
import { fakeStream, installGetUserMedia, installLiveVideoElement } from "@/test/media-mocks";

const faceApi = vi.hoisted(() => ({
  loadFaceModels: vi.fn(),
  detectFacesWithLandmarks: vi.fn(),
  detectFacesWithDescriptors: vi.fn(),
}));
const brightness = vi.hoisted(() => ({ value: 140 }));
vi.mock("@/lib/face-recognition/face-api", () => ({ ...faceApi, faceBrightness: () => brightness.value, getFaceBackend: () => "wasm", MODELS_FAILED_MESSAGE: "The face recognition models could not be loaded." }));

const record = vi.hoisted(() => vi.fn());
const recordMine = vi.hoisted(() => vi.fn());
vi.mock("@/queries/face-recognition", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/queries/face-recognition")>()), recordFaceAttendance: record, recordMyFaceAttendance: recordMine }));

import { FaceRecognitionRequestError } from "@/queries/face-recognition";

import { useFaceAttendanceScanner } from "./use-face-attendance-scanner";

const box = { x: 220, y: 140, width: 200, height: 200 };
const face = (ear: number) => ({ box, leftEye: eyeWithEar(ear), rightEye: eyeWithEar(ear, 3) });
/** Search frames, then open → closed → open, then open forever. */
const blinkTimeline = (call: number) => face(call >= 6 && call <= 7 ? 0.1 : 0.3);

let latest: ReturnType<typeof useFaceAttendanceScanner>;
function Harness({ mode = "kiosk" }: { mode?: "kiosk" | "self" }) {
  const { videoRef, ...scanner } = useFaceAttendanceScanner(mode);
  useEffect(() => { latest = { videoRef, ...scanner }; });
  return <video ref={videoRef} />;
}

function renderScanner(mode: "kiosk" | "self" = "kiosk") {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<Harness mode={mode} />, { wrapper });
}

async function startScanning() {
  await waitFor(() => expect(latest.state.status).toBe("ready"));
  latest.start();
}

const recognized = (scanId: string) => ({
  scanId,
  outcome: "time_in" as const,
  message: null,
  distance: 0.3,
  employee: { id: "3f1e2d3c-4b5a-4968-8776-655443322110", employeeNumber: "PAT-001", firstName: "Ana", lastName: "One" },
  log: { id: "7c1e2d3c-4b5a-4968-8776-655443322110", attendanceDate: "2026-09-25", timeIn: "2026-09-25T00:05:00Z", timeOut: null, status: "incomplete" as const },
  recordedAt: "2026-09-25T00:05:00Z",
});

let track: ReturnType<typeof fakeStream>["track"];

beforeEach(() => {
  vi.clearAllMocks();
  brightness.value = 140;
  installLiveVideoElement();
  const camera = fakeStream();
  track = camera.track;
  installGetUserMedia(() => Promise.resolve(camera.stream));
  faceApi.loadFaceModels.mockResolvedValue({});
  let call = 0;
  faceApi.detectFacesWithLandmarks.mockImplementation(async () => [blinkTimeline(call++)]);
  faceApi.detectFacesWithDescriptors.mockResolvedValue([{ ...face(0.3), descriptor: syntheticDescriptor(0.1) }]);
});

describe("useFaceAttendanceScanner", () => {
  it("runs search → blink → one descriptor → attendance, retrying a network failure with the same scan ID", async () => {
    record.mockRejectedValueOnce(new FaceRecognitionRequestError("offline", true)).mockImplementation(async ({ scanId }: { scanId: string }) => recognized(scanId));
    renderScanner();
    await startScanning();

    await waitFor(() => expect(latest.state.status).toBe("success"), { timeout: 5000 });

    expect(faceApi.detectFacesWithDescriptors).toHaveBeenCalledTimes(1);
    expect(record).toHaveBeenCalledTimes(2);
    const [first, second] = record.mock.calls.map(([input]) => input as { scanId: string; descriptor: number[] });
    expect(second.scanId).toBe(first.scanId);
    expect(first.descriptor).toHaveLength(128);
    expect(latest.state).toMatchObject({ status: "success", result: { employee: { firstName: "Ana" } } });
  });

  it("sends an employee's own scan to the self-verification RPC only", async () => {
    recordMine.mockImplementation(async ({ scanId }: { scanId: string }) => recognized(scanId));
    renderScanner("self");
    await startScanning();

    await waitFor(() => expect(latest.state.status).toBe("success"), { timeout: 5000 });
    expect(recordMine).toHaveBeenCalledTimes(1);
    expect(record).not.toHaveBeenCalled();
  });

  it("does not retry a database rejection and records nothing for an unknown face", async () => {
    record.mockImplementation(async ({ scanId }: { scanId: string }) => ({ ...recognized(scanId), outcome: "not_recognized", employee: null, log: null, message: "Face not recognized." }));
    renderScanner();
    await startScanning();

    await waitFor(() => expect(latest.state).toMatchObject({ status: "error", kind: "not_recognized", message: "Face not recognized." }), { timeout: 5000 });
    expect(record).toHaveBeenCalledTimes(1);
  });

  it("suggests more light when the face is dark, and reports detection diagnostics", async () => {
    brightness.value = 70;
    renderScanner();
    await startScanning();

    await waitFor(() => expect(latest.lowLight).toBe(true));
    expect(latest.diagnostics).toMatchObject({ backend: "wasm", brightness: 70 });
    expect(latest.diagnostics.detectionMs).not.toBeNull();
  });

  it("keeps searching while more than one face is visible", async () => {
    faceApi.detectFacesWithLandmarks.mockResolvedValue([face(0.3), { ...face(0.3), box: { ...box, x: 10 } }]);
    renderScanner();
    await startScanning();

    await waitFor(() => expect(latest.state).toMatchObject({ status: "searching", guidance: expect.stringMatching(/more than one face/i) }));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(latest.state.status).toBe("searching");
    expect(faceApi.detectFacesWithDescriptors).not.toHaveBeenCalled();
  });

  it("never computes a descriptor when the eyes stay closed", async () => {
    let call = 0;
    faceApi.detectFacesWithLandmarks.mockImplementation(async () => [face(call++ < 3 ? 0.3 : 0.1)]);
    renderScanner();
    await startScanning();

    await waitFor(() => expect(latest.state.status).toBe("liveness"));
    await new Promise((resolve) => setTimeout(resolve, 1000));
    expect(latest.state.status).toBe("liveness");
    expect(faceApi.detectFacesWithDescriptors).not.toHaveBeenCalled();
    expect(record).not.toHaveBeenCalled();
  });

  it("reports a denied camera and never runs detection", async () => {
    installGetUserMedia(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    renderScanner();

    await waitFor(() => expect(latest.state).toMatchObject({ status: "error", kind: "camera_denied", fatal: true }));
    expect(faceApi.detectFacesWithLandmarks).not.toHaveBeenCalled();
  });

  it("reports a model-loading failure and turns the camera off", async () => {
    faceApi.loadFaceModels.mockRejectedValue(new Error("404"));
    renderScanner();

    await waitFor(() => expect(latest.state).toMatchObject({ status: "error", kind: "models_failed", fatal: true }));
    expect(track.stop).toHaveBeenCalled();
  });

  it("stops scanning with a clear error when the camera track ends", async () => {
    renderScanner();
    await startScanning();
    const onEnded = track.addEventListener.mock.calls.find(([type]) => type === "ended")?.[1] as () => void;

    act(() => onEnded());

    await waitFor(() => expect(latest.state).toMatchObject({ status: "error", kind: "camera_unavailable", fatal: true }));
  });

  it("stops the camera and the detection loop on unmount", async () => {
    const view = renderScanner();
    await startScanning();
    await waitFor(() => expect(faceApi.detectFacesWithLandmarks).toHaveBeenCalled());

    view.unmount();
    const calls = faceApi.detectFacesWithLandmarks.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 600));

    expect(track.stop).toHaveBeenCalled();
    expect(faceApi.detectFacesWithLandmarks.mock.calls.length).toBeLessThanOrEqual(calls + 1);
  });
});
