import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { fakeStream, installGetUserMedia, installLiveVideoElement, removeMediaDevices } from "@/test/media-mocks";

import { cameraErrorKind, useCamera } from "./use-camera";

beforeEach(() => {
  vi.restoreAllMocks();
  installLiveVideoElement();
});

function renderCamera() {
  const hook = renderHook(() => useCamera());
  hook.result.current.videoRef.current = document.createElement("video");
  return hook;
}

describe("useCamera", () => {
  it("requests only the front camera without audio and shows the preview", async () => {
    const { stream } = fakeStream();
    const getUserMedia = installGetUserMedia(() => Promise.resolve(stream));
    const { result } = renderCamera();

    await act(async () => { expect(await result.current.start()).toBeNull(); });

    expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({ audio: false, video: expect.objectContaining({ facingMode: { ideal: "user" } }) }));
    expect(result.current.status).toBe("active");
    expect(result.current.videoRef.current?.srcObject).toBe(stream);
  });

  it("stops every track and detaches the preview on unmount", async () => {
    const { stream, track } = fakeStream();
    installGetUserMedia(() => Promise.resolve(stream));
    const { result, unmount } = renderCamera();
    const video = result.current.videoRef.current;
    await act(async () => { await result.current.start(); });

    unmount();

    expect(track.stop).toHaveBeenCalled();
    expect(video?.srcObject).toBeNull();
  });

  it("stops the camera when the page is hidden", async () => {
    const { stream, track } = fakeStream();
    installGetUserMedia(() => Promise.resolve(stream));
    const { result } = renderCamera();
    await act(async () => { await result.current.start(); });

    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "hidden" });
    act(() => { document.dispatchEvent(new Event("visibilitychange")); });
    Object.defineProperty(document, "visibilityState", { configurable: true, get: () => "visible" });

    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("releases a stream that arrives after the camera was already stopped", async () => {
    const { stream, track } = fakeStream();
    let resolve: (value: MediaStream) => void = () => undefined;
    installGetUserMedia(() => new Promise((done) => { resolve = done; }));
    const { result } = renderCamera();

    let pending: Promise<unknown> = Promise.resolve();
    act(() => { pending = result.current.start(); });
    act(() => { result.current.stop(); });
    await act(async () => { resolve(stream); await pending; });

    expect(track.stop).toHaveBeenCalled();
    expect(result.current.status).toBe("idle");
  });

  it("does not report an active camera when the track ends while playback starts", async () => {
    const { stream, track } = fakeStream();
    installGetUserMedia(() => Promise.resolve(stream));
    vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(async () => {
      const onEnded = track.addEventListener.mock.calls.find(([type]) => type === "ended")?.[1] as () => void;
      onEnded();
    });
    const { result } = renderCamera();

    await act(async () => { expect(await result.current.start()).toBe("camera_unavailable"); });
    expect(result.current.status).toBe("idle");
  });

  it("reports a denied permission", async () => {
    installGetUserMedia(() => Promise.reject(new DOMException("denied", "NotAllowedError")));
    const { result } = renderCamera();
    await act(async () => { expect(await result.current.start()).toBe("camera_denied"); });
    await waitFor(() => expect(result.current.error).toBe("camera_denied"));
  });

  it("reports a missing camera and an unsupported browser", async () => {
    installGetUserMedia(() => Promise.reject(new DOMException("none", "NotFoundError")));
    const { result } = renderCamera();
    await act(async () => { expect(await result.current.start()).toBe("no_camera"); });

    removeMediaDevices();
    await act(async () => { expect(await result.current.start()).toBe("camera_unavailable"); });
  });

  it("maps browser errors to camera error kinds", () => {
    expect(cameraErrorKind(new DOMException("", "SecurityError"))).toBe("camera_denied");
    expect(cameraErrorKind(new DOMException("", "OverconstrainedError"))).toBe("no_camera");
    expect(cameraErrorKind(new DOMException("", "NotReadableError"))).toBe("camera_unavailable");
  });
});
