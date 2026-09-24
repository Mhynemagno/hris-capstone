import { vi } from "vitest";

/** A fake MediaStream whose tracks record stop() calls. */
export function fakeStream() {
  const track = { stop: vi.fn(), addEventListener: vi.fn() };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] } as unknown as MediaStream;
  return { stream, track };
}

export function installGetUserMedia(implementation: () => Promise<MediaStream>) {
  const getUserMedia = vi.fn(implementation);
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia } });
  return getUserMedia;
}

export function removeMediaDevices() {
  Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: undefined });
}

/** jsdom has no media pipeline; make video elements look like a live 640×480 preview. */
export function installLiveVideoElement() {
  vi.spyOn(HTMLMediaElement.prototype, "play").mockResolvedValue(undefined);
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { configurable: true, get: () => 4 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", { configurable: true, get: () => 640 });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", { configurable: true, get: () => 480 });
  Object.defineProperty(HTMLMediaElement.prototype, "srcObject", {
    configurable: true,
    get(this: HTMLMediaElement & { _srcObject?: unknown }) { return this._srcObject ?? null; },
    set(this: HTMLMediaElement & { _srcObject?: unknown }, value: unknown) { this._srcObject = value; },
  });
}
