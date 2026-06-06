/**
 * Pure helpers for rendering live-preview participants. The participant's display *colour* is supplied by
 * the server (a stable, deterministic value), so this only derives the short label shown inside an avatar.
 */

/**
 * The initials shown in a participant avatar: the first letter of each of the first two words, uppercased
 * (e.g. `"Ada Lovelace" → "AL"`, `"grace" → "G"`). A blank name falls back to `"?"`.
 *
 * @param displayName The participant's display name.
 * @returns One or two uppercase initials, or `"?"` when the name is blank.
 */
export function initialsFor(displayName: string): string {
  const words = displayName.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return '?'
  return words
    .slice(0, 2)
    .map((word) => word[0]!.toUpperCase())
    .join('')
}
