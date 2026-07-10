export function nextOptionIndex(currentIndex: number, optionCount: number, direction: "next" | "previous"): number {
  if (optionCount <= 0) return -1;
  if (direction === "next") return (currentIndex + 1 + optionCount) % optionCount;
  return (currentIndex - 1 + optionCount) % optionCount;
}
