export function getVisiblePages(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages: (number | 'ellipsis')[] = [1, 2, 3];
  if (current > 5) pages.push('ellipsis');
  for (let i = current - 1; i <= current + 1; i++) {
    if (i > 3 && i < total - 2 && !pages.includes(i)) pages.push(i);
  }
  if (current < total - 4) pages.push('ellipsis');
  for (let i = total - 2; i <= total; i++) {
    if (!pages.includes(i)) pages.push(i);
  }
  return pages;
}
