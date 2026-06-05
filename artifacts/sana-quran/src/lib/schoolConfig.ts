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

export const FIELD_LABELS: Record<string, string> = {
  memorize:    "الحفظ",
  review_near: "المراجعة القريبة",
  review_far:  "المراجعة البعيدة",
  review:      "المراجعة العامة",
  recitation:  "التلاوة",
  listen:      "السماع للقارئ",
  repetitions: "عدد التكرار",
  tafsir:      "التفسير",
};

export function getFieldLabel(key: string): string {
  return FIELD_LABELS[key] ?? key;
}

const NO_REVIEW_PLAN_CATEGORIES = new Set(["أطفال", "أمهات"]);
const NO_REVIEW_PLAN_DATATYPES  = new Set(["recitation", "mishkah"]);
const LEGACY_NO_REVIEW_TRACKS   = ["ألق", "سراج", "مهج", "مشكاة نور"];

export function shouldHideReviewPlans(trackName: string | null | undefined): boolean {
  if (!trackName) return false;
  const cfg = schoolConfig.defaultTrackTypes.find(t => t.name === trackName);
  if (cfg) {
    if (cfg.category && NO_REVIEW_PLAN_CATEGORIES.has(cfg.category)) return true;
    if (NO_REVIEW_PLAN_DATATYPES.has(cfg.dataEntryType))             return true;
    if (cfg.inputFields?.length) {
      const hasReview = cfg.inputFields.some(f =>
        f === "review_near" || f === "review_far" || f === "review"
      );
      const hasMem = cfg.inputFields.includes("memorize");
      if (!hasMem && !hasReview) return true;
      if (cfg.inputFields.includes("recitation") && !hasMem && !hasReview) return true;
    }
  }
  return LEGACY_NO_REVIEW_TRACKS.includes(trackName);
}
