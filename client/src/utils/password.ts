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

export const PASSWORD_REQUIREMENTS =
  'At least 8 characters with a letter, a number, and a symbol. Passwords expire after 180 days.';
