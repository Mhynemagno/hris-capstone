import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, waitFor } from "@testing-library/react";
import { useEffect, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { FACE_RECOGNITION_CONFIG } from "@/lib/face-recognition/config";
import { syntheticDescriptor } from "@/test/face-fixtures";
import { fakeStream, installGetUserMedia, installLiveVideoElement } from "@/test/media-mocks";

const faceApi = vi.hoisted(() => ({ loadFaceModels: vi.fn(), detectFacesWithDescriptors: vi.fn(), detectFaces: vi.fn() }));
vi.mock("@/lib/face-recognition/face-api", () => ({ ...faceApi, MODELS_FAILED_MESSAGE: "The face recognition models could not be loaded." }));

const enroll = vi.hoisted(() => vi.fn());
vi.mock("@/queries/face-recognition", async (importOriginal) => ({ ...(await importOriginal<typeof import("@/queries/face-recognition")>()), enrollEmployeeFace: enroll }));

import { useFaceEnrollmentCapture } from "./use-face-enrollment-capture";

const employeeId = "3f1e2d3c-4b5a-4968-8776-655443322110";
const box = { x: 220, y: 140, width: 200, height: 200 };
const sample = (value: number, faceBox = box) => ({ box: faceBox, descriptor: syntheticDescriptor(value) });
const required = FACE_RECOGNITION_CONFIG.enrollment.requiredSamples;
const timeout = { timeout: (required + 3) * FACE_RECOGNITION_CONFIG.enrollment.sampleIntervalMs + 2000 };

let latest: ReturnType<typeof useFaceEnrollmentCapture>;
function Harness() {
  const { videoRef, ...capture } = useFaceEnrollmentCapture();
  useEffect(() => { latest = { videoRef, ...capture }; });
  return capture.state.phase === "idle" ? null : <video ref={videoRef} />;
}

function renderCapture() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return render(<Harness />, { wrapper });
}

let track: ReturnType<typeof fakeStream>["track"];

beforeEach(() => {
  vi.clearAllMocks();
  installLiveVideoElement();
  const camera = fakeStream();
  track = camera.track;
  installGetUserMedia(() => Promise.resolve(camera.stream));
  faceApi.loadFaceModels.mockResolvedValue({});
});

describe("useFaceEnrollmentCapture", () => {
  it("captures the required samples for the selected employee and submits their average", async () => {
    let call = 0;
    faceApi.detectFacesWithDescriptors.mockImplementation(async () => [sample(0.1 + 0.01 * (call++ % 2))]);
    enroll.mockResolvedValue({ employeeId, status: "re_registered" });
    renderCapture();

    act(() => latest.begin({ employeeId, consentConfirmed: true }));
    await waitFor(() => expect(latest.state).toEqual({ phase: "success", status: "re_registered" }), timeout);

    expect(enroll).toHaveBeenCalledTimes(1);
    const input = enroll.mock.calls[0][0] as { employeeId: string; descriptor: number[]; sampleCount: number; consentConfirmed: boolean };
    expect(input).toMatchObject({ employeeId, sampleCount: required, consentConfirmed: true });
    expect(input.descriptor).toHaveLength(128);
    expect(track.stop).toHaveBeenCalled();
  });

  it("never records a sample while several faces are visible", async () => {
    faceApi.detectFacesWithDescriptors.mockResolvedValue([sample(0.1), sample(0.1, { ...box, x: 10 })]);
    renderCapture();

    act(() => latest.begin({ employeeId, consentConfirmed: true }));
    await waitFor(() => expect(latest.state).toMatchObject({ phase: "capturing", samples: 0, guidance: expect.stringMatching(/more than one face/i) }), timeout);
    expect(enroll).not.toHaveBeenCalled();
  });

  it("rejects inconsistent samples without calling the database", async () => {
    let call = 0;
    faceApi.detectFacesWithDescriptors.mockImplementation(async () => [sample(call++ === 0 ? -0.2 : 0.1)]);
    renderCapture();

    act(() => latest.begin({ employeeId, consentConfirmed: true }));
    await waitFor(() => expect(latest.state).toMatchObject({ phase: "error", message: expect.stringMatching(/did not match/i) }), timeout);
    expect(enroll).not.toHaveBeenCalled();
    expect(track.stop).toHaveBeenCalled();
  });

  it("surfaces a database rejection such as a face registered to someone else", async () => {
    faceApi.detectFacesWithDescriptors.mockResolvedValue([sample(0.1)]);
    enroll.mockRejectedValue(new Error("This face is too similar to another registered employee."));
    renderCapture();

    act(() => latest.begin({ employeeId, consentConfirmed: true }));
    await waitFor(() => expect(latest.state).toEqual({ phase: "error", message: "This face is too similar to another registered employee." }), timeout);
  });

  it("stops the camera and discards samples when cancelled", async () => {
    faceApi.detectFacesWithDescriptors.mockResolvedValue([sample(0.1)]);
    renderCapture();

    act(() => latest.begin({ employeeId, consentConfirmed: true }));
    await waitFor(() => expect(latest.state.phase).toBe("capturing"));
    act(() => latest.cancel());

    expect(latest.state).toEqual({ phase: "idle" });
    expect(track.stop).toHaveBeenCalled();
    await new Promise((resolve) => setTimeout(resolve, FACE_RECOGNITION_CONFIG.enrollment.sampleIntervalMs * 2));
    expect(enroll).not.toHaveBeenCalled();
  });

  it("reports a denied camera", async () => {
    installGetUserMedia(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    renderCapture();

    act(() => latest.begin({ employeeId, consentConfirmed: true }));
    await waitFor(() => expect(latest.state).toMatchObject({ phase: "error", message: expect.stringMatching(/denied/i) }));
  });
});
