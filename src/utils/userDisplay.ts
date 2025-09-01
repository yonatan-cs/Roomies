export type UserLike = {
  id?: string;
  display_name?: string;
  full_name?: string;
  name?: string;
  displayName?: string;
  email?: string;
};

/**
 * Get display name from user object with fallbacks
 * Priority order: display_name -> displayName -> full_name -> name -> email -> 'אורח'
 */
export function getDisplayName(u?: UserLike | null): string {
  return (u?.display_name ?? u?.displayName ?? u?.full_name ?? u?.name ?? u?.email ?? 'אורח').toString().trim();
}

/**
 * Get initial from name, supporting Hebrew/emoji/multi-code-point characters
 * Uses Array.from() instead of charAt() for proper Unicode handling
 */
export function getInitial(name?: string): string {
  const s = (name ?? '').trim();
  if (!s) return 'א';
  
  const firstGrapheme = Array.from(s)[0]; // Safe for emoji and multi-code-point characters
  return firstGrapheme.toLocaleUpperCase('he-IL');
}

/**
 * Get display name and initial in one call
 */
export function getUserDisplayInfo(u?: UserLike | null): { displayName: string; initial: string } {
  const displayName = getDisplayName(u);
  const initial = getInitial(displayName);
  return { displayName, initial };
}
