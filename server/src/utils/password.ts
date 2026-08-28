export const PASSWORD_MAX_AGE_DAYS = 180;

const PASSWORD_PATTERN = /^(?=.*[A-Za-z])(?=.*\d)(?=.*[^A-Za-z\d]).{8,}$/;

export function validatePassword(password: string): string | null {
  if (!password || password.length < 8) {
    return 'Password must be at least 8 characters';
  }
  if (!PASSWORD_PATTERN.test(password)) {
    return 'Password must include a letter, a number, and a symbol';
  }
  return null;
}

export function passwordAgeDays(passwordChangedAt: Date | string | undefined, fallback?: Date | string): number {
  const base = passwordChangedAt ?? fallback;
  if (!base) return 0;
  const changed = new Date(base);
  const now = new Date();
  const ms = now.getTime() - changed.getTime();
  return Math.max(0, Math.floor(ms / (1000 * 60 * 60 * 24)));
}

export function isPasswordExpired(passwordChangedAt: Date | string | undefined, fallback?: Date | string): boolean {
  return passwordAgeDays(passwordChangedAt, fallback) >= PASSWORD_MAX_AGE_DAYS;
}
