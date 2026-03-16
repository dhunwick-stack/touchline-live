export function getAdminSession() {
  try {
    const raw = localStorage.getItem('adminSession');
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function hasValidAdminSession() {
  try {
    const raw = localStorage.getItem('adminSession');
    if (!raw) return false;

    const session = JSON.parse(raw);
    return session.expires > Date.now();
  } catch {
    return false;
  }
}

export function clearAdminSession() {
  localStorage.removeItem('adminSession');
}