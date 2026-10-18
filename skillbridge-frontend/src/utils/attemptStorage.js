export function attemptStorageKey(kind, studentId, assessmentId) {
  return `sb_${kind}_${studentId}_${assessmentId}`
}
