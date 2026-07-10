export function revealDelay(index: number, interval = 45, groupSize = 6): number {
  return (index % groupSize) * interval;
}
