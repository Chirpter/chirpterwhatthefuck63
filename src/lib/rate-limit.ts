// Client-side rate limiting for auth attempts
// Prevents brute force attacks by limiting login attempts per email

const MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

interface AttemptRecord {
  count: number;
  firstAttempt: number;
  lockoutUntil: number | null;
}

// Store in memory (persists during session only)
const attemptStore = new Map<string, AttemptRecord>();

/**
 * Check if an email is currently rate limited
 * @param email - User's email address
 * @returns Object with 'allowed' boolean and 'waitTime' in seconds
 */
export const checkRateLimit = (email: string): { allowed: boolean; waitTime: number } => {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  const record = attemptStore.get(normalizedEmail);

  if (!record) {
    return { allowed: true, waitTime: 0 };
  }

  // Check if lockout period has expired
  if (record.lockoutUntil && now < record.lockoutUntil) {
    const waitTime = Math.ceil((record.lockoutUntil - now) / 1000);
    return { allowed: false, waitTime };
  }

  // Reset if first attempt was more than lockout duration ago
  if (now - record.firstAttempt > LOCKOUT_DURATION) {
    attemptStore.delete(normalizedEmail);
    return { allowed: true, waitTime: 0 };
  }

  // Check if exceeded max attempts
  if (record.count >= MAX_ATTEMPTS) {
    const lockoutUntil = record.firstAttempt + LOCKOUT_DURATION;
    record.lockoutUntil = lockoutUntil;
    const waitTime = Math.ceil((lockoutUntil - now) / 1000);
    return { allowed: false, waitTime };
  }

  return { allowed: true, waitTime: 0 };
};

/**
 * Record a failed login attempt
 * @param email - User's email address
 */
export const recordFailedAttempt = (email: string): void => {
  const normalizedEmail = email.toLowerCase().trim();
  const now = Date.now();
  const record = attemptStore.get(normalizedEmail);

  if (!record) {
    attemptStore.set(normalizedEmail, {
      count: 1,
      firstAttempt: now,
      lockoutUntil: null,
    });
    return;
  }

  // Reset if first attempt was long ago
  if (now - record.firstAttempt > LOCKOUT_DURATION) {
    attemptStore.set(normalizedEmail, {
      count: 1,
      firstAttempt: now,
      lockoutUntil: null,
    });
    return;
  }

  // Increment count
  record.count += 1;

  // Set lockout if exceeded max attempts
  if (record.count >= MAX_ATTEMPTS) {
    record.lockoutUntil = record.firstAttempt + LOCKOUT_DURATION;
  }
};

/**
 * Clear failed attempts for an email (call on successful login)
 * @param email - User's email address
 */
export const clearFailedAttempts = (email: string): void => {
  const normalizedEmail = email.toLowerCase().trim();
  attemptStore.delete(normalizedEmail);
};

/**
 * Get current attempt count for debugging
 * @param email - User's email address
 */
export const getAttemptCount = (email: string): number => {
  const normalizedEmail = email.toLowerCase().trim();
  return attemptStore.get(normalizedEmail)?.count || 0;
};
