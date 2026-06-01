const parse = <T>(val: string | undefined, fallback: T): T => {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
};

export const DEFAULT_ROLE_NAMES: Record<string, string> = {
  teacher: "معلمة",
  supervisor: "مشرفة",
  data_entry: "مدخلة بيانات",
  leader: "المشرفة العامة",
  deputy: "النائبة",
  student: "طالبة",
  track_supervisor: "مشرفة المسار",
  volunteer: "متطوعة",
  exam_supervisor: "مشرفة الاختبار",
};

const env = (import.meta as any).env as Record<string, string | undefined>;

export const schoolConfig = {
  schoolName: env.VITE_SCHOOL_NAME ?? null as string | null,
  schoolTagline: env.VITE_SCHOOL_TAGLINE ?? null as string | null,
  logoUrl: env.VITE_LOGO_URL ?? null as string | null,
  dataEntryRoles: parse<string[]>(env.VITE_DATA_ENTRY_ROLES, ["teacher", "supervisor", "data_entry", "leader"]),
  roleNames: { ...DEFAULT_ROLE_NAMES, ...parse<Record<string, string>>(env.VITE_ROLE_NAMES, {}) },
  defaultTrackTypes: parse<{ name: string; dataEntryType: string }[]>(env.VITE_DEFAULT_TRACK_TYPES, []),
  enabledFeatures: parse<string[]>(env.VITE_ENABLED_FEATURES, [
    "badges", "store", "audio", "review_plans", "teacher_rotation",
    "shortcomings", "exam", "messages", "calendar", "deputy_tasks",
    "registration", "leaves",
  ]),
  circleGenders: parse<string[]>(env.CIRCLE_GENDERS, ["girls"]),
};

export function getRoleName(role: string): string {
  return schoolConfig.roleNames[role] ?? DEFAULT_ROLE_NAMES[role] ?? role;
}

export function canEnterData(role: string): boolean {
  return role === "leader" || schoolConfig.dataEntryRoles.includes(role);
}
