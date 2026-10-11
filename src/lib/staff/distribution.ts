export function distributionRows(items: { label: string; count: number }[]) {
  const total = items.reduce((sum, item) => sum + item.count, 0);
  const largest = Math.max(0, ...items.map((item) => item.count));
  return items.map((item) => ({
    ...item,
    percent: `${(total ? (item.count / total) * 100 : 0).toFixed(1)}%`,
    width: largest ? (item.count / largest) * 100 : 0,
  }));
}
