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

export const ALL_FEATURE_KEYS = [
  "stats_general", "stats_weekly", "stats_monthly", "stats_stumbling",
  "shortcomings", "review_plans", "exam", "teacher_rotation",
  "messages", "calendar", "registration", "leaves", "deputy_tasks",
  "badges", "audio", "store",
] as const;

export type FeatureKey = typeof ALL_FEATURE_KEYS[number];

export const schoolConfig = {
  schoolName: env.VITE_SCHOOL_NAME ?? null as string | null,
  schoolTagline: env.VITE_SCHOOL_TAGLINE ?? null as string | null,
  logoUrl: env.VITE_LOGO_URL ?? null as string | null,
  dataEntryRoles: parse<string[]>(env.VITE_DATA_ENTRY_ROLES, ["teacher", "supervisor", "data_entry", "leader"]),
  roleNames: { ...DEFAULT_ROLE_NAMES, ...parse<Record<string, string>>(env.VITE_ROLE_NAMES, {}) },
  defaultTrackTypes: parse<{ name: string; dataEntryType: string; category?: string; inputFields?: string[] }[]>(env.VITE_DEFAULT_TRACK_TYPES, []),
  enabledFeatures: parse<string[]>(env.VITE_ENABLED_FEATURES, [...ALL_FEATURE_KEYS]),
  circleGenders: parse<string[]>(env.CIRCLE_GENDERS, ["girls"]),
};

export function getRoleName(role: string): string {
  return schoolConfig.roleNames[role] ?? DEFAULT_ROLE_NAMES[role] ?? role;
}

export function canEnterData(role: string): boolean {
  return role === "leader" || schoolConfig.dataEntryRoles.includes(role);
}

export function isFeatureEnabled(key: string): boolean {
  if (!env.VITE_ENABLED_FEATURES) return true;
  return schoolConfig.enabledFeatures.includes(key);
}
