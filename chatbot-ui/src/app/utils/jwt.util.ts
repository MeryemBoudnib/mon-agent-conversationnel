// src/app/utils/jwt.util.ts
export type UserRole = 'USER' | 'ADMIN';

export function parseJwt(token: string): any {
  try {
    const base = token.split('.')[1];
    const json = atob(base.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json);
  } catch {
    return null;
  }
}
const toArr = (x: any): string[] =>
  Array.isArray(x) ? x.map(String)
  : typeof x === 'string' ? x.split(/[,\s]+/).filter(Boolean)
  : [];

export function extractRole(token: string): UserRole | null {
  const p = parseJwt(token) || {};
  let claimed: string[] = [];

  claimed = toArr(p.roles).map(s => s.toUpperCase());
  if (!claimed.length && p.authorities) {
    if (Array.isArray(p.authorities)) {
      claimed = p.authorities
        .map((a: any) => String(a?.authority ?? a?.role ?? a))
        .map((s: string) => s.toUpperCase());
    } else {
      claimed = toArr(p.authorities).map(s => s.toUpperCase());
    }
  }
  if (!claimed.length && p.scope) claimed = toArr(p.scope).map(s => s.toUpperCase());
  if (!claimed.length && typeof p.role === 'string') claimed = [p.role.toUpperCase()];

  if (claimed.includes('ROLE_ADMIN') || claimed.includes('ADMIN')) return 'ADMIN';
  if (claimed.includes('ROLE_USER')  || claimed.includes('USER'))  return 'USER';
  return null;
}
