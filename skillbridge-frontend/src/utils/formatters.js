// src/utils/formatters.js
//
// Shared pure helper functions used across admin, instructor, and student pages.
// Import only what you need — all exports are tree-shakeable.

// ── Name helpers ──────────────────────────────────────────────────

/**
 * Extract a display name from a DNSC email address.
 * e.g. "villanueva.azel@dnsc.edu.ph" → "Azel Villanueva"
 */
export function nameFromEmail(email) {
  const local = email.split('@')[0]               // "villanueva.azel"
  const parts = local.split('.')                  // ["villanueva", "azel"]
  const cap   = s => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  if (parts.length >= 2) return `${cap(parts[1])} ${cap(parts[0])}`
  return cap(parts[0])
}

/**
 * Derive 1–2 letter initials from a full name string.
 * e.g. "Azel Villanueva" → "AV"
 */
export function getInitials(name = '') {
  return name
    .split(' ')
    .map(n => n[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase() || '??'
}

// ── Score / color helpers ─────────────────────────────────────────

/**
 * Returns a Tailwind text-color class based on a percentage score.
 * ≥80 → green, ≥60 → amber, <60 → rose
 */
export function scoreColor(p) {
  if (p === null || p === undefined) return 'text-gray-300 dark:text-gray-700'
  if (p >= 80) return 'text-green-600 dark:text-green-400'
  if (p >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-500 dark:text-rose-400'
}

/**
 * Returns a Tailwind bg-color class for a score bar.
 */
export function scoreBg(p) {
  if (p >= 80) return 'bg-green-600'
  if (p >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

// ── Average / top / bottom ────────────────────────────────────────

export function avg(scores) {
  const v = Object.values(scores)
  if (!v.length) return null
  return Math.round(v.reduce((a, b) => a + b, 0) / v.length)
}

export function topSkill(scores) {
  const e = Object.entries(scores)
  if (!e.length) return null
  return e.reduce((a, b) => b[1] > a[1] ? b : a)
}

export function bottomSkill(scores) {
  const e = Object.entries(scores)
  if (!e.length) return null
  return e.reduce((a, b) => b[1] < a[1] ? b : a)
}

// ── Tier label ────────────────────────────────────────────────────

export function tierLabel(p) {
  if (p >= 80) return { text: 'Strong',      cls: 'text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-900' }
  if (p >= 60) return { text: 'Fair',        cls: 'text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900' }
  return           { text: 'Needs Work',   cls: 'text-rose-700 dark:text-rose-300 bg-rose-100 dark:bg-rose-900' }
}

// ── Match / bar colors (admin dashboard) ─────────────────────────

export function matchColor(pct) {
  if (pct >= 80) return 'text-green-600 dark:text-green-400'
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400'
  return 'text-gray-400'
}

export function matchBg(pct) {
  if (pct >= 80) return 'bg-green-500'
  if (pct >= 60) return 'bg-amber-500'
  return 'bg-gray-200 dark:bg-gray-700'
}
