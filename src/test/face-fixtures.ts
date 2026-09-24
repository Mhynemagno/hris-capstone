/** Synthetic 128-value descriptor (not derived from any real face). */
export function syntheticDescriptor(value: number) {
  return new Float32Array(128).fill(value);
}
