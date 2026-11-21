/**
 * Tunable constants for the phone app session.
 * As specified in PLAN 2 section 3.4, exact numbers live in dedicated constants files
 * so they can be tuned after test campaigns.
 */

/** After 5 minutes in background (visibility hidden), the PIN screen lock activates if a PIN is set. */
export const BACKGROUND_LOCK_MS = 5 * 60 * 1000;

/** Number of wrong PIN attempts before lockout timer begins. */
export const WRONG_PIN_LOCKOUT_ATTEMPTS = 5;

/** Base lockout duration: 30 seconds, doubling with each subsequent wrong attempt. */
export const BASE_PIN_LOCKOUT_MS = 30_000;

/**
 * Calculates the lockout duration in milliseconds for a given count of failed attempts.
 * 0-4 attempts: 0 ms (no lockout)
 * 5 attempts: 30 s
 * 6 attempts: 60 s
 * 7 attempts: 120 s
 * etc.
 */
export function lockoutDurationMs(failedAttempts: number): number {
  if (failedAttempts < WRONG_PIN_LOCKOUT_ATTEMPTS) return 0;
  const multiplier = Math.pow(2, failedAttempts - WRONG_PIN_LOCKOUT_ATTEMPTS);
  return BASE_PIN_LOCKOUT_MS * multiplier;
}
