export function slugifyMatch(): string {
  const rand = Math.random().toString(36).substring(2, 10);
  return `match-${rand}`;
}