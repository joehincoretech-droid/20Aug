export function parseBoxesPerOuterBox(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 1) return null;
  return n;
}

export function validateBoxesPerOuterBox(value: unknown): string | null {
  if (value === undefined || value === null || value === '') {
    return 'Boxes per outer box is required';
  }
  if (parseBoxesPerOuterBox(value) === null) {
    return 'Boxes per outer box must be a whole number of at least 1';
  }
  return null;
}
