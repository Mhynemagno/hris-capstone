import { beforeEach, describe, expect, it, vi } from "vitest";

const tf = vi.hoisted(() => ({ setBackend: vi.fn(), setWasmPaths: vi.fn(), getBackend: vi.fn() }));
const nets = vi.hoisted(() => ({
  tinyFaceDetector: { loadFromUri: vi.fn() },
  faceLandmark68Net: { loadFromUri: vi.fn() },
  faceRecognitionNet: { loadFromUri: vi.fn() },
}));
vi.mock("@vladmandic/face-api/dist/face-api.esm.js", () => ({ tf, nets }));

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  for (const net of Object.values(nets)) net.loadFromUri.mockResolvedValue(undefined);
});

async function load() {
  const faceApiModule = await import("./face-api");
  await faceApiModule.loadFaceModels("/models/face-api");
  return faceApiModule;
}

describe("loadFaceModels backend selection", () => {
  it("uses WebGL when it is available", async () => {
    tf.setBackend.mockResolvedValue(true);
    const { getFaceBackend } = await load();
    expect(tf.setBackend).toHaveBeenCalledTimes(1);
    expect(getFaceBackend()).toBe("webgl");
  });

  it("uses WebAssembly, served next to the models, when WebGL is unavailable", async () => {
    tf.setBackend.mockImplementation(async (name: string) => {
      if (name === "webgl") throw new Error("WebGL is not supported");
      return true;
    });
    const { getFaceBackend } = await load();
    expect(tf.setWasmPaths).toHaveBeenCalledWith("/models/face-api/wasm/");
    expect(tf.setBackend.mock.calls.map(([name]) => name)).toEqual(["webgl", "wasm"]);
    expect(getFaceBackend()).toBe("wasm");
  });

  it("falls back to the CPU only when WebAssembly also fails", async () => {
    tf.setBackend.mockImplementation(async (name: string) => name === "cpu");
    const { getFaceBackend } = await load();
    expect(tf.setBackend.mock.calls.map(([name]) => name)).toEqual(["webgl", "wasm", "cpu"]);
    expect(getFaceBackend()).toBe("cpu");
  });
});
