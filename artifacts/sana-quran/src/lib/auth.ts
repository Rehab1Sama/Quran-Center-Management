const TOKEN_KEY = "sana_auth_token";
const ACTIVE_CIRCLE_KEY = "sana_active_circle_id";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(ACTIVE_CIRCLE_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

// --- التعديل الجديد: إدارة الحلقة النشطة وإجبار التحديث ---

export function getActiveCircleId(): string | null {
  return localStorage.getItem(ACTIVE_CIRCLE_KEY);
}

export function setActiveCircleId(circleId: string): void {
  const current = getActiveCircleId();
  if (current !== circleId) {
    localStorage.setItem(ACTIVE_CIRCLE_KEY, circleId);
    // إعادة تحميل الصفحة فوراً لمسح كاش الحلقة القديمة
    window.location.reload();
  }
}

export function clearActiveCircleId(): void {
  localStorage.removeItem(ACTIVE_CIRCLE_KEY);
}
