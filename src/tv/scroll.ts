/** Next scroll offset that puts a focused row fully inside the viewport. */
export function scrollOffsetForFocus(
  itemTop: number,
  itemHeight: number,
  viewportHeight: number,
  currentOffset: number,
): number {
  if (viewportHeight <= 0 || itemHeight <= 0) return Math.max(0, currentOffset);
  const top = Math.max(0, itemTop);
  const bottom = top + itemHeight;
  const viewBottom = currentOffset + viewportHeight;
  if (top < currentOffset) return top;
  if (bottom > viewBottom) return Math.max(0, bottom - viewportHeight);
  return currentOffset;
}
