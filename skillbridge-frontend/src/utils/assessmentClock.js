// Use a server-provided duration and a monotonic clock; wall-clock changes
// cannot extend an active countdown. The server still decides finalization.
export function remainingAttemptSeconds(deadline, monotonicNow) {
  return Math.max(0, Math.ceil((deadline - monotonicNow) / 1000))
}
