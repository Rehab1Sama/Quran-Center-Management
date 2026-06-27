import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { SURAHS, calculatePages } from "@/lib/quran";
import {
  BookOpen, Loader2, AlertTriangle, CheckCircle2, Download,
  Palette, Edit3, RefreshCw, ChevronDown, ChevronUp,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Section = { startSurah: string; startAyah: number; endSurah: string; endAyah: number };

const JUZ_RANGES: Array<Section & { n: number; label: string }> = [
  { n:1,  label:"الجزء الأول",   startSurah:"الفاتحة",   startAyah:1,   endSurah:"البقرة",     endAyah:141 },
  { n:2,  label:"الجزء الثاني",  startSurah:"البقرة",    startAyah:142, endSurah:"البقرة",     endAyah:252 },
  { n:3,  label:"الجزء الثالث",  startSurah:"البقرة",    startAyah:253, endSurah:"آل عمران",   endAyah:92  },
  { n:4,  label:"الجزء الرابع",  startSurah:"آل عمران",  startAyah:93,  endSurah:"النساء",     endAyah:23  },
  { n:5,  label:"الجزء الخامس",  startSurah:"النساء",    startAyah:24,  endSurah:"النساء",     endAyah:147 },
  { n:6,  label:"الجزء السادس",  startSurah:"النساء",    startAyah:148, endSurah:"المائدة",    endAyah:81  },
  { n:7,  label:"الجزء السابع",  startSurah:"المائدة",   startAyah:82,  endSurah:"الأنعام",    endAyah:110 },
  { n:8,  label:"الجزء الثامن",  startSurah:"الأنعام",   startAyah:111, endSurah:"الأعراف",    endAyah:87  },
  { n:9,  label:"الجزء التاسع",  startSurah:"الأعراف",   startAyah:88,  endSurah:"الأنفال",    endAyah:40  },
  { n:10, label:"الجزء العاشر",  startSurah:"الأنفال",   startAyah:41,  endSurah:"التوبة",     endAyah:92  },
  { n:11, label:"الجزء ١١",      startSurah:"التوبة",    startAyah:93,  endSurah:"هود",        endAyah:5   },
  { n:12, label:"الجزء ١٢",      startSurah:"هود",       startAyah:6,   endSurah:"يوسف",       endAyah:52  },
  { n:13, label:"الجزء ١٣",      startSurah:"يوسف",      startAyah:53,  endSurah:"إبراهيم",    endAyah:52  },
  { n:14, label:"الجزء ١٤",      startSurah:"الحجر",     startAyah:1,   endSurah:"النحل",      endAyah:128 },
  { n:15, label:"الجزء ١٥",      startSurah:"الإسراء",   startAyah:1,   endSurah:"الكهف",      endAyah:74  },
  { n:16, label:"الجزء ١٦",      startSurah:"الكهف",     startAyah:75,  endSurah:"طه",         endAyah:135 },
  { n:17, label:"الجزء ١٧",      startSurah:"الأنبياء",  startAyah:1,   endSurah:"الحج",       endAyah:78  },
  { n:18, label:"الجزء ١٨",      startSurah:"المؤمنون",  startAyah:1,   endSurah:"الفرقان",    endAyah:20  },
  { n:19, label:"الجزء ١٩",      startSurah:"الفرقان",   startAyah:21,  endSurah:"النمل",      endAyah:55  },
  { n:20, label:"الجزء ٢٠",      startSurah:"النمل",     startAyah:56,  endSurah:"العنكبوت",   endAyah:45  },
  { n:21, label:"الجزء ٢١",      startSurah:"العنكبوت",  startAyah:46,  endSurah:"الأحزاب",    endAyah:30  },
  { n:22, label:"الجزء ٢٢",      startSurah:"الأحزاب",   startAyah:31,  endSurah:"يس",         endAyah:27  },
  { n:23, label:"الجزء ٢٣",      startSurah:"يس",        startAyah:28,  endSurah:"الزمر",      endAyah:31  },
  { n:24, label:"الجزء ٢٤",      startSurah:"الزمر",     startAyah:32,  endSurah:"فصلت",       endAyah:46  },
  { n:25, label:"الجزء ٢٥",      startSurah:"فصلت",      startAyah:47,  endSurah:"الجاثية",    endAyah:37  },
  { n:26, label:"الجزء ٢٦",      startSurah:"الأحقاف",   startAyah:1,   endSurah:"الذاريات",   endAyah:30  },
  { n:27, label:"الجزء ٢٧",      startSurah:"الذاريات",  startAyah:31,  endSurah:"الحديد",     endAyah:29  },
  { n:28, label:"الجزء ٢٨",      startSurah:"المجادلة",  startAyah:1,   endSurah:"التحريم",    endAyah:12  },
  { n:29, label:"الجزء ٢٩",      startSurah:"الملك",     startAyah:1,   endSurah:"المرسلات",   endAyah:50  },
  { n:30, label:"الجزء الثلاثون",startSurah:"النبأ",     startAyah:1,   endSurah:"الناس",      endAyah:6   },
];

type PlanDayEntry = {
  dayNumber: number;
  surahStart: string; ayahStart: number;
  surahEnd: string; ayahEnd: number;
  pages: number;
  label?: string;
};

type PlanTheme = {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  bgPattern: "dots" | "lines" | "plain" | "diamonds";
  fontStyle: "rounded" | "elegant" | "bold";
};

type PlanSnapshot = {
  cycleCount: number;
  startDate: string;
  endDate: string;
  totalPages: number;
  memorizedUpToSurah?: string;
  memorizedUpToAyah?: number;
  planType: string;
};

type DayPerf = { dayNumber: number; date: string; exceeded?: boolean; completed: boolean; partial?: boolean; absent: boolean; actual?: number; planned?: number };

type ReviewPlan = {
  id: number;
  studentId: number;
  planType: "auto" | "manual";
  cycleCount: number;
  cycleLength: number;
  totalPages: number;
  startDate: string;
  currentCycleStart: string;
  memorizedUpToSurah?: string;
  memorizedUpToAyah?: number;
  planEntries: PlanDayEntry[];
  theme: PlanTheme;
  status: string;
  dayInCycle: number;
  todayEntry: PlanDayEntry | null;
  plannedPagesForToday: number;
  actualPagesForToday: number;
  missedDaysLast30: number;
  isStumbling: boolean;
  currentCycleNum: number;
  isFriday?: boolean;
  history?: PlanSnapshot[];
  dayPerformance?: DayPerf[];
  isLocked?: boolean;
  isCompletedEarly?: boolean;
  updatedAt?: string;
  trackType?: string;
  lastEditedByName?: string | null;
};

const THEME_PRESETS: { name: string; theme: PlanTheme }[] = [
  { name: "لافندر 💜", theme: { primaryColor: "#a78bdb", secondaryColor: "#f5f0fd", accentColor: "#5b21b6", bgPattern: "plain", fontStyle: "rounded" } },
  { name: "وردي 🌸", theme: { primaryColor: "#e8a0b4", secondaryColor: "#fdf3f7", accentColor: "#8b3a5a", bgPattern: "dots", fontStyle: "rounded" } },
  { name: "خوخي 🍑", theme: { primaryColor: "#e8a87c", secondaryColor: "#fef7f0", accentColor: "#8b4a2a", bgPattern: "plain", fontStyle: "elegant" } },
  { name: "سماوي 🩵", theme: { primaryColor: "#7ab8d8", secondaryColor: "#eff8fd", accentColor: "#1e4f6a", bgPattern: "lines", fontStyle: "rounded" } },
  { name: "مينت 🌿", theme: { primaryColor: "#7ac5a8", secondaryColor: "#f0faf5", accentColor: "#1a5c40", bgPattern: "plain", fontStyle: "rounded" } },
  { name: "ذهبي 🌼", theme: { primaryColor: "#d4b06a", secondaryColor: "#fdf9ee", accentColor: "#7a5020", bgPattern: "diamonds", fontStyle: "elegant" } },
];

function BgPattern({ pattern, color }: { pattern: string; color: string }) {
  if (pattern === "dots") return (
    <div className="absolute inset-0 opacity-10" style={{
      backgroundImage: `radial-gradient(${color} 1px, transparent 1px)`,
      backgroundSize: "16px 16px",
    }} />
  );
  if (pattern === "lines") return (
    <div className="absolute inset-0 opacity-10" style={{
      backgroundImage: `repeating-linear-gradient(45deg, ${color} 0, ${color} 1px, transparent 0, transparent 50%)`,
      backgroundSize: "8px 8px",
    }} />
  );
  if (pattern === "diamonds") return (
    <div className="absolute inset-0 opacity-10" style={{
      backgroundImage: `repeating-linear-gradient(45deg, ${color} 0 2px, transparent 2px 14px)`,
      backgroundSize: "20px 20px",
    }} />
  );
  return null;
}

function PlanCard({ plan, studentName, circleName }: { plan: ReviewPlan; studentName: string; circleName: string }) {
  const theme = plan.theme;
  const pct = Math.round((plan.dayInCycle / plan.cycleLength) * 100);

  return (
    <div
      className="relative rounded-2xl overflow-hidden shadow-lg"
      style={{ background: theme.secondaryColor, fontFamily: theme.fontStyle === "bold" ? "system-ui" : undefined }}
    >
      <BgPattern pattern={theme.bgPattern} color={theme.primaryColor} />
      <div className="relative z-10 p-5 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-bold opacity-70" style={{ color: theme.accentColor }}>خطة المراجعة</p>
            <p className="text-lg font-bold" style={{ color: theme.accentColor }}>{studentName}</p>
            <p className="text-xs opacity-60" style={{ color: theme.accentColor }}>{circleName}</p>
          </div>
          <div className="w-14 h-14 relative">
            <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={theme.primaryColor} strokeWidth="3" opacity="0.2" />
              <circle
                cx="18" cy="18" r="15.9" fill="none"
                stroke={theme.primaryColor} strokeWidth="3"
                strokeDasharray={`${pct} 100`} strokeLinecap="round"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-[10px] font-bold" style={{ color: theme.primaryColor }}>{pct}%</span>
            </div>
          </div>
        </div>

        {/* Day info */}
        <div className="flex items-center gap-2">
          <span className="text-3xl font-black" style={{ color: theme.primaryColor }}>{plan.dayInCycle}</span>
          <span className="text-sm opacity-60" style={{ color: theme.accentColor }}>/ {plan.cycleLength} يوم — الدورة #{plan.cycleCount}</span>
        </div>

        {/* Today's portion */}
        {plan.todayEntry && (
          <div className="rounded-xl p-3" style={{ backgroundColor: theme.primaryColor + "22" }}>
            <p className="text-xs font-bold mb-1" style={{ color: theme.accentColor }}>مراجعة اليوم</p>
            <p className="font-bold text-sm" style={{ color: theme.primaryColor }}>
              {plan.todayEntry.surahStart === plan.todayEntry.surahEnd
                ? `${plan.todayEntry.surahStart} (${plan.todayEntry.ayahStart} – ${plan.todayEntry.ayahEnd})`
                : `${plan.todayEntry.surahStart} (${plan.todayEntry.ayahStart}) → ${plan.todayEntry.surahEnd} (${plan.todayEntry.ayahEnd})`}
            </p>
            <p className="text-xs mt-0.5 opacity-70" style={{ color: theme.accentColor }}>
              {plan.todayEntry.pages} وجه
              {plan.actualPagesForToday > 0 && ` · راجعتِ ${plan.actualPagesForToday} وجه`}
            </p>
          </div>
        )}

        {/* Day performance strip */}
        {plan.dayPerformance && plan.dayPerformance.length > 0 && (
          <div>
            <p className="text-[10px] opacity-50 mb-1" style={{ color: theme.accentColor }}>الأداء الأخير</p>
            <div className="flex gap-1">
              {plan.dayPerformance.slice(-10).map(d => (
                <div
                  key={d.dayNumber}
                  title={`يوم ${d.dayNumber}: ${d.absent ? "غياب" : d.exceeded ? "متقدمة ↑" : d.completed ? "مكتمل ✓" : d.partial ? "جزئي ≈" : "ناقص ✗"}`}
                  className="flex-1 rounded-full"
                  style={{
                    height: "6px",
                    background: d.absent
                      ? "#d1d5db"
                      : d.exceeded
                      ? "#3b82f6"
                      : d.completed
                      ? "#22c55e"
                      : d.partial
                      ? "#f59e0b"
                      : "#f43f5e",
                  }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: theme.primaryColor }}>{plan.totalPages}</p>
            <p className="text-[10px] opacity-60" style={{ color: theme.accentColor }}>وجه إجمالًا</p>
          </div>
          <div className="text-center">
            <p className={`text-lg font-bold ${plan.isStumbling ? "text-rose-500" : ""}`} style={plan.isStumbling ? {} : { color: theme.primaryColor }}>
              {plan.missedDaysLast30}
            </p>
            <p className="text-[10px] opacity-60" style={{ color: theme.accentColor }}>أيام تأخر</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold" style={{ color: theme.primaryColor }}>
              {plan.memorizedUpToSurah ? plan.memorizedUpToSurah.slice(0, 6) : "—"}
            </p>
            <p className="text-[10px] opacity-60" style={{ color: theme.accentColor }}>آخر حفظ</p>
          </div>
        </div>

        {/* آخر تعديل */}
        {plan.lastEditedByName && (
          <p className="text-[10px] opacity-50 text-center mt-1" style={{ color: theme.accentColor }}>
            آخر تعديل: {plan.lastEditedByName}
          </p>
        )}
      </div>
    </div>
  );
}

interface Props {
  studentId: number;
  studentName: string;
  circleName: string;
  trackType: string;
  plan: ReviewPlan | null | undefined;
  onPlanChange: (plan: ReviewPlan | null) => void;
  readOnly?: boolean;
  onAfterSave?: () => void;
  userRole?: string;
}

function StepIndicator({ current }: { current: number }) {
  const labels = ["المحتوى", "النوع", "التاريخ", "الثيم"];
  return (
    <div className="flex items-center justify-between mb-3 px-1">
      {labels.map((label, i) => (
        <div key={i} className="flex flex-col items-center gap-0.5 flex-1">
          <div className={`w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center mx-auto ${
            i + 1 < current ? "bg-emerald-500 text-white" : i + 1 === current ? "bg-primary text-white" : "bg-muted text-muted-foreground"
          }`}>
            {i + 1 < current ? "✓" : i + 1}
          </div>
          <span className={`text-[9px] text-center ${i + 1 === current ? "text-primary font-semibold" : "text-muted-foreground"}`}>{label}</span>
        </div>
      ))}
    </div>
  );
}

export default function ReviewPlanTab({ studentId, studentName, circleName, trackType, plan, onPlanChange, readOnly = false, onAfterSave, userRole }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState<"view" | "pick_content" | "plan_type" | "start_date" | "choose" | "theme" | "manual" | "renew_theme" | "renew_surah" | "renew_confirm" | "fixation_quota" | "fixation_start" | "fixation_theme" | "fixation_date" | "fixation_manual" | "fixation_manual_date" | "fixation_manual_theme">("view");
  const [saving, setSaving] = useState(false);
  const [selectedTheme, setSelectedTheme] = useState<PlanTheme>(
    plan?.theme ?? THEME_PRESETS[0].theme
  );
  const [manualEntries, setManualEntries] = useState<PlanDayEntry[]>([]);
  const [showSchedule, setShowSchedule] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [renewPlanType, setRenewPlanType] = useState<"auto" | "manual">("auto");
  const [planMode, setPlanMode] = useState<"auto" | "manual">("auto");

  // Content picker state
  const [contentTab, setContentTab] = useState<"juz" | "surah">("juz");
  const [selectedJuz, setSelectedJuz] = useState<Set<number>>(new Set());
  const [surahSections, setSurahSections] = useState<Section[]>([]);
  const [draftSection, setDraftSection] = useState({ startSurah: "", startAyah: "1", endSurah: "", endAyah: "1" });

  // Surah/Ayah selector state (renewal flow)
  const [startSurah, setStartSurah] = useState("");
  const [startAyah, setStartAyah] = useState("");
  const [endSurah, setEndSurah] = useState(plan?.memorizedUpToSurah ?? "");
  const [endAyah, setEndAyah] = useState(plan?.memorizedUpToAyah?.toString() ?? "");
  const [cycleLength, setCycleLength] = useState(plan?.cycleLength?.toString() ?? "21");
  const [startDate, setStartDate] = useState("");
  const [autoDetecting, setAutoDetecting] = useState(false);

  // حالة خاصة بمسار التثبيت
  const [fixationQuota, setFixationQuota] = useState<0.5 | 1>(1);
  const [fixationPlanMode, setFixationPlanMode] = useState<"auto" | "manual">("auto");
  const [fixationStartMode, setFixationStartMode] = useState<"juz" | "surah">("juz");
  const [fixationStartJuz, setFixationStartJuz] = useState<number>(30);
  const [fixationStartSurahLocal, setFixationStartSurahLocal] = useState("");
  const [fixationStartAyahLocal, setFixationStartAyahLocal] = useState("1");
  const [fixationManualEntries, setFixationManualEntries] = useState<Array<{dayNumber: number; surahStart: string; ayahStart: string; surahEnd: string; ayahEnd: string}>>(() =>
    Array.from({ length: 24 }, (_, i) => ({ dayNumber: i + 1, surahStart: "البقرة", ayahStart: "1", surahEnd: "البقرة", ayahEnd: "10" }))
  );

  // نافذة اختيار الآية
  type AyahPickerState = {
    entryIdx: number;
    field: "ayahStart" | "ayahEnd";
    surahName: string;
    currentValue: number;
    source: "manual" | "fixation";
  };
  const [ayahPicker, setAyahPicker] = useState<AyahPickerState | null>(null);

  function AyahPickerOverlay() {
    if (!ayahPicker) return null;
    const surah = SURAHS.find(s => s.name === ayahPicker.surahName);
    const maxAyah = surah?.ayahs ?? 1;
    return (
      <div className="fixed inset-0 z-50 flex items-end justify-center" style={{ background: "rgba(0,0,0,0.45)" }} onClick={() => setAyahPicker(null)}>
        <div className="bg-background rounded-t-2xl w-full max-w-md pb-safe" onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between px-4 pt-4 pb-2">
            <p className="text-sm font-bold">{ayahPicker.surahName}</p>
            <p className="text-xs text-muted-foreground">{maxAyah} آية</p>
          </div>
          <div className="overflow-y-auto max-h-64 px-3 pb-6">
            <div className="grid grid-cols-8 gap-1.5">
              {Array.from({ length: maxAyah }, (_, i) => i + 1).map(n => (
                <button
                  key={n}
                  onClick={() => {
                    if (ayahPicker.source === "manual") {
                      setManualEntries(prev => prev.map((e, i) =>
                        i === ayahPicker.entryIdx ? { ...e, [ayahPicker.field]: n } : e
                      ));
                    } else {
                      setFixationManualEntries(prev => prev.map((e, i) =>
                        i === ayahPicker.entryIdx ? { ...e, [ayahPicker.field]: String(n) } : e
                      ));
                    }
                    setAyahPicker(null);
                  }}
                  className={`py-2 rounded-lg text-xs font-bold border transition-all ${ayahPicker.currentValue === n ? "bg-primary text-white border-primary" : "border-border bg-background hover:border-primary/50"}`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  async function autoDetectAndEnterPick() {
    setAutoDetecting(true);
    setSelectedJuz(new Set());
    setSurahSections([]);
    setContentTab("juz");
    try {
      const token = localStorage.getItem("sana_auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      const res = await fetch(`${BASE}/api/records?studentId=${studentId}`, { headers });
      if (res.ok) {
        const records: Array<{
          isAbsent: boolean;
          memorizePages: number | null;
          memorizeSurahStart: string | null;
          memorizeAyahStart: number | null;
          memorizeSurahEnd: string | null;
          memorizeAyahEnd: number | null;
          date: string;
        }> = await res.json();
        const memRecs = records
          .filter(r => !r.isAbsent && r.memorizeSurahStart && (r.memorizePages ?? 0) > 0)
          .sort((a, b) => a.date.localeCompare(b.date));
        if (memRecs.length > 0) {
          const first = memRecs[0];
          const last = memRecs[memRecs.length - 1];
          setSurahSections([{
            startSurah: first.memorizeSurahStart!,
            startAyah: first.memorizeAyahStart ?? 1,
            endSurah: last.memorizeSurahEnd ?? last.memorizeSurahStart!,
            endAyah: last.memorizeAyahEnd ?? 1,
          }]);
          setContentTab("surah");
        }
      }
    } catch {
      // ignore — user picks manually
    } finally {
      setAutoDetecting(false);
      setStep("pick_content");
    }
  }

  function getSelectedSections(): Section[] {
    if (contentTab === "juz") {
      return Array.from(selectedJuz).sort((a, b) => a - b).map(n => {
        const j = JUZ_RANGES.find(j => j.n === n)!;
        return { startSurah: j.startSurah, startAyah: j.startAyah, endSurah: j.endSurah, endAyah: j.endAyah };
      });
    }
    return surahSections;
  }

  function hasContent(): boolean {
    return contentTab === "juz" ? selectedJuz.size > 0 : surahSections.length > 0;
  }

  const authHeader = useCallback((): Record<string, string> => {
    const token = localStorage.getItem("sana_auth_token");
    const base: Record<string, string> = { "Content-Type": "application/json" };
    if (token) base["Authorization"] = `Bearer ${token}`;
    return base;
  }, []);

  async function deletePlan() {
    if (!window.confirm("هل أنتِ متأكدة من حذف الخطة نهائيًا؟ سيمكن الطالبة من إعادة إنشائها من جديد.")) return;
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/students/${studentId}/review-plan`, {
        method: "DELETE", headers: authHeader(),
      });
      if (res.ok) {
        onPlanChange(null);
        setStep("view");
        toast({ title: "تم حذف الخطة ✓" });
      } else {
        const err = await res.json();
        toast({ title: err.error ?? "حدث خطأ", variant: "destructive" });
      }
    } finally {
      setSaving(false);
    }
  }

  const canDeletePlan = ["leader", "deputy", "track_supervisor"].includes(userRole ?? "");
  const FIXATION_WEEKS = 6;
  const FIXATION_DAYS_PER_WEEK = 4;
  const FIXATION_CYCLE = FIXATION_WEEKS * FIXATION_DAYS_PER_WEEK; // 24

  // فقط مسار الفتيات (الحفظ المكثف)
  if (trackType !== "girls" && trackType !== "fixation") {
    return (
      <div className="text-center py-10 text-muted-foreground text-sm">
        خطة المراجعة غير متاحة لهذا المسار
      </div>
    );
  }

  // ── مسار التثبيت: خطوة ١ — اختيار النصاب (يدوي فقط) ─────────────────────
  if (step === "fixation_quota") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("view")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">١ · اختاري النصاب اليومي</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => { setFixationQuota(1); setStep("fixation_manual"); }}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-emerald-400 bg-emerald-50 hover:shadow-md transition-all"
          >
            <span className="text-3xl">📖</span>
            <p className="font-bold text-sm text-emerald-800">وجه كامل</p>
            <p className="text-[10px] text-emerald-700 text-center">وجه كامل لكل جلسة</p>
          </button>
          <button
            onClick={() => { setFixationQuota(0.5); setStep("fixation_manual"); }}
            className="flex flex-col items-center gap-2 p-5 rounded-2xl border-2 border-sky-400 bg-sky-50 hover:shadow-md transition-all"
          >
            <span className="text-3xl">📄</span>
            <p className="font-bold text-sm text-sky-800">نصف وجه</p>
            <p className="text-[10px] text-sky-700 text-center">نصف وجه لكل جلسة</p>
          </button>
        </div>
        <div className="rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground">
          <p>{FIXATION_CYCLE} جلسة · {FIXATION_WEEKS} أسابيع × {FIXATION_DAYS_PER_WEEK} أيام (الأحد – الأربعاء)</p>
        </div>
      </div>
    );
  }

  // ── مسار التثبيت: خطوة ٢ — نقطة البداية ──────────────────────────────
  if (step === "fixation_start") {
    const canProceed = fixationStartMode === "juz" ? fixationStartJuz > 0 : fixationStartSurahLocal !== "";
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("fixation_quota")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">٢ · من أين تبدئين التثبيت؟</h3>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl">
          {(["juz", "surah"] as const).map(m => (
            <button key={m} onClick={() => setFixationStartMode(m)}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${fixationStartMode === m ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}>
              {m === "juz" ? "جزء البداية" : "سورة البداية"}
            </button>
          ))}
        </div>
        {fixationStartMode === "juz" ? (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">اختاري الجزء الذي تبدئين منه (الطالبة ستراجع من هذا الجزء إلى الناس)</p>
            <div className="grid grid-cols-6 gap-1.5">
              {JUZ_RANGES.map(j => (
                <button key={j.n} onClick={() => setFixationStartJuz(j.n)}
                  className={`py-2.5 rounded-lg text-xs font-bold border-2 transition-all ${fixationStartJuz === j.n ? "border-emerald-500 bg-emerald-100 text-emerald-800 shadow-sm" : "border-border bg-background hover:border-emerald-300"}`}>
                  {j.n}
                </button>
              ))}
            </div>
            {fixationStartJuz > 0 && (
              <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-3 py-2">
                ✓ ابتداءً من الجزء {fixationStartJuz} — {JUZ_RANGES.find(j => j.n === fixationStartJuz)?.startSurah}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">اختاري السورة والآية التي تبدئين منها التثبيت</p>
            <div className="flex gap-2">
              <select className="flex-1 border rounded-lg px-2 py-2 text-sm bg-background"
                value={fixationStartSurahLocal}
                onChange={e => setFixationStartSurahLocal(e.target.value)}>
                <option value="">— اختاري السورة —</option>
                {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <input type="number" min="1" placeholder="آية" className="w-20 border rounded-lg px-2 py-2 text-sm bg-background"
                value={fixationStartAyahLocal}
                onChange={e => setFixationStartAyahLocal(e.target.value)} />
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 pt-1">
          <Button variant="outline" onClick={() => { setFixationPlanMode("manual"); setStep("fixation_manual"); }}>
            ✏️ إدخال يدوي
          </Button>
          <Button disabled={!canProceed}
            onClick={() => { setFixationPlanMode("auto"); setSelectedTheme(THEME_PRESETS[0].theme); setStep("fixation_theme"); }}>
            التالي ← الثيم
          </Button>
        </div>
      </div>
    );
  }

  // ── مسار التثبيت: خطوة ٣ — الثيم (تلقائي) ──────────────────────────
  if (step === "fixation_theme") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("fixation_start")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">٣ · اختاري لون الخطة</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {THEME_PRESETS.map(preset => (
            <button key={preset.name} onClick={() => setSelectedTheme(preset.theme)}
              className={`p-3 rounded-xl border-2 transition-all text-right ${selectedTheme.primaryColor === preset.theme.primaryColor ? "border-primary shadow-md" : "border-border hover:border-primary/40"}`}
              style={{ background: preset.theme.secondaryColor }}>
              <div className="w-6 h-6 rounded-full mb-1" style={{ background: preset.theme.primaryColor }} />
              <p className="text-xs font-bold" style={{ color: preset.theme.accentColor }}>{preset.name}</p>
            </button>
          ))}
        </div>
        <Button className="w-full" style={{ background: selectedTheme.primaryColor }}
          onClick={() => setStep("fixation_date")}>
          التالي ← تاريخ البداية
        </Button>
      </div>
    );
  }

  // ── مسار التثبيت: خطوة ٤ — تاريخ البداية + إنشاء (تلقائي) ──────────
  if (step === "fixation_date") {
    const todayStr = new Date().toISOString().slice(0, 10);
    const totalWajh = fixationQuota * FIXATION_CYCLE;
    const startLabel = fixationStartMode === "juz"
      ? `الجزء ${fixationStartJuz} (${JUZ_RANGES.find(j => j.n === fixationStartJuz)?.startSurah ?? ""})`
      : `${fixationStartSurahLocal} آية ${fixationStartAyahLocal}`;

    async function createFixationPlan() {
      setSaving(true);
      try {
        const body: Record<string, unknown> = {
          quota: fixationQuota,
          cycleLength: FIXATION_CYCLE,
          theme: selectedTheme,
        };
        if (fixationStartMode === "juz") {
          const juz = JUZ_RANGES.find(j => j.n === fixationStartJuz);
          if (juz) { body.startSurah = juz.startSurah; body.startAyah = juz.startAyah; }
        } else if (fixationStartSurahLocal) {
          body.startSurah = fixationStartSurahLocal;
          body.startAyah = parseInt(fixationStartAyahLocal) || 1;
        }
        if (startDate) body.startDate = startDate;
        const res = await fetch(`${BASE}/api/students/${studentId}/review-plan`, {
          method: "POST", headers: authHeader(), body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          onPlanChange(data);
          setStep("view");
          toast({ title: "تم إنشاء خطة التثبيت ✓" });
          onAfterSave?.();
        } else {
          const err = await res.json();
          toast({ title: err.error ?? "حدث خطأ", variant: "destructive" });
        }
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("fixation_theme")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">٤ · تاريخ البداية</h3>
        </div>
        <div className="rounded-xl bg-muted/40 p-4">
          <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
            value={startDate || todayStr} min={todayStr}
            onChange={e => setStartDate(e.target.value)} />
          {!startDate && <p className="text-xs text-emerald-700 font-medium mt-2">✓ سيبدأ اليوم تلقائيًا إذا لم تختاري تاريخًا</p>}
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs space-y-1 text-blue-800">
          <p className="font-semibold">ملخص الخطة:</p>
          <p>• النصاب: <span className="font-bold">{fixationQuota === 1 ? "وجه كامل" : "نصف وجه"}</span> / جلسة</p>
          <p>• البداية: <span className="font-bold">{startLabel}</span></p>
          <p>• المدة: {FIXATION_WEEKS} أسابيع × {FIXATION_DAYS_PER_WEEK} أيام ({FIXATION_CYCLE} جلسة)</p>
          <p>• إجمالي النصاب: <span className="font-bold">{totalWajh} وجه</span></p>
          <p>• أيام العمل: الأحد، الاثنين، الثلاثاء، الأربعاء</p>
        </div>
        <Button className="w-full font-bold" style={{ background: selectedTheme.primaryColor }}
          onClick={createFixationPlan} disabled={saving}>
          {saving ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin inline-block ml-2" /> : null}
          إنشاء خطة التثبيت ✓
        </Button>
      </div>
    );
  }

  // ── مسار التثبيت: خطوة ٢ — الطالبة تملأ جدولها بنفسها ──
  if (step === "fixation_manual") {
    const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"];

    const updateEntry = (idx: number, field: string, value: string) => {
      setFixationManualEntries(prev => prev.map((e, i) => i === idx ? { ...e, [field]: value } : e));
    };

    // زر "تابعي من السابق": تملأ بداية كل جلسة من نهاية الجلسة التي قبلها
    function fillFromPrevious() {
      setFixationManualEntries(prev => {
        const next = [...prev];
        for (let i = 1; i < next.length; i++) {
          const pr = next[i - 1];
          const surah = SURAHS.find(s => s.name === pr.surahEnd);
          const ayahNum = parseInt(pr.ayahEnd) || 1;
          if (surah && ayahNum >= surah.ayahs) {
            const nextSurah = SURAHS.find(s => s.number === surah.number + 1);
            if (nextSurah) next[i] = { ...next[i], surahStart: nextSurah.name, ayahStart: "1" };
          } else {
            next[i] = { ...next[i], surahStart: pr.surahEnd, ayahStart: String(ayahNum + 1) };
          }
        }
        return next;
      });
    }

    // حساب وجوه الجلسة ومقارنتها بالنصاب
    function entryStatus(entry: typeof fixationManualEntries[0]) {
      const pages = calculatePages(entry.surahStart, parseInt(entry.ayahStart) || 1, entry.surahEnd, parseInt(entry.ayahEnd) || 1);
      const diff = Math.round((pages - fixationQuota) * 10) / 10;
      return { pages, diff };
    }

    const allEntries = fixationManualEntries;
    const wrongCount = allEntries.filter(e => Math.abs(entryStatus(e).diff) >= 0.1).length;

    return (
      <>
        <AyahPickerOverlay />
        <div className="space-y-4">
          <div className="flex items-center gap-2 mb-1">
            <button onClick={() => setStep("fixation_quota")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
            <h3 className="font-bold text-sm">٢ · أدخلي نصيب كل جلسة يدويًا</h3>
          </div>

          {/* شريط معلومات + زر التعبئة */}
          <div className="flex items-center gap-2 bg-muted/40 rounded-xl px-3 py-2">
            <span className="text-lg">{fixationQuota === 1 ? "📖" : "📄"}</span>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">
                النصاب: <span className="font-bold text-foreground">{fixationQuota === 1 ? "وجه كامل" : "نصف وجه"}</span> / جلسة · اضغطي على الآية لتختاريها
              </p>
              {wrongCount > 0 && (
                <p className="text-[10px] text-orange-600 font-medium mt-0.5">⚠ {wrongCount} جلسة لا تساوي النصاب المطلوب</p>
              )}
            </div>
            <button
              onClick={fillFromPrevious}
              className="shrink-0 text-[10px] bg-primary/10 text-primary font-semibold px-2 py-1 rounded-lg hover:bg-primary/20 transition-colors"
              title="تملأ بداية كل جلسة من نهاية الجلسة السابقة"
            >
              ↕ تابعي
            </button>
          </div>

          {/* 24-row table */}
          <div className="space-y-2 max-h-[55vh] overflow-y-auto pr-1">
            {Array.from({ length: FIXATION_WEEKS }, (_, wi) => (
              <div key={wi} className="rounded-xl border border-border overflow-hidden">
                <div className="bg-muted/50 px-3 py-1.5">
                  <p className="text-xs font-bold text-foreground">الأسبوع {wi + 1}</p>
                </div>
                <div className="divide-y divide-border">
                  {Array.from({ length: FIXATION_DAYS_PER_WEEK }, (_, di) => {
                    const idx = wi * FIXATION_DAYS_PER_WEEK + di;
                    const entry = fixationManualEntries[idx];
                    const { pages, diff } = entryStatus(entry);
                    const isExact = Math.abs(diff) < 0.1;
                    const isOver  = diff > 0.1;
                    const isUnder = diff < -0.1;
                    return (
                      <div key={di} className="px-3 py-2 space-y-1.5">
                        <div className="flex items-center justify-between">
                          <p className="text-[11px] font-semibold text-muted-foreground">{DAY_NAMES[di]} — اليوم {idx + 1}</p>
                          {/* شارة الوجوه */}
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isExact ? "bg-emerald-100 text-emerald-700"
                            : isOver  ? "bg-orange-100 text-orange-700"
                            : isUnder ? "bg-red-100 text-red-700"
                            : ""
                          }`}>
                            {pages === 0 ? "—" : `${pages} وجه${isOver ? " ▲" : isUnder ? " ▼" : " ✓"}`}
                          </span>
                        </div>
                        {/* تنبيه إذا لم يطابق النصاب */}
                        {!isExact && pages > 0 && (
                          <p className={`text-[10px] font-medium rounded px-1.5 py-0.5 ${isOver ? "bg-orange-50 text-orange-600" : "bg-red-50 text-red-600"}`}>
                            {isOver
                              ? `النصاب ${fixationQuota} وجه · أدخلتِ ${pages} (زيادة ${Math.abs(diff)} وجه)`
                              : `النصاب ${fixationQuota} وجه · أدخلتِ ${pages} (ناقص ${Math.abs(diff)} وجه)`}
                          </p>
                        )}
                        <div className="grid grid-cols-2 gap-1.5">
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">سورة البداية</p>
                            <select value={entry.surahStart}
                              onChange={e => {
                                const s = SURAHS.find(s => s.name === e.target.value);
                                updateEntry(idx, "surahStart", e.target.value);
                                if (s && parseInt(entry.ayahStart) > s.ayahs) updateEntry(idx, "ayahStart", "1");
                              }}
                              className="w-full h-7 border border-input rounded-lg text-xs px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/20">
                              {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">آية البداية</p>
                            <button
                              onClick={() => setAyahPicker({ entryIdx: idx, field: "ayahStart", surahName: entry.surahStart, currentValue: parseInt(entry.ayahStart) || 1, source: "fixation" })}
                              className="w-full h-7 border border-input rounded-lg text-xs px-2 bg-background text-center font-semibold hover:border-primary/60 transition-colors"
                            >
                              {entry.ayahStart}
                            </button>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">سورة النهاية</p>
                            <select value={entry.surahEnd}
                              onChange={e => {
                                const s = SURAHS.find(s => s.name === e.target.value);
                                updateEntry(idx, "surahEnd", e.target.value);
                                if (s && parseInt(entry.ayahEnd) > s.ayahs) updateEntry(idx, "ayahEnd", String(s.ayahs));
                              }}
                              className="w-full h-7 border border-input rounded-lg text-xs px-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/20">
                              {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                            </select>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground mb-0.5">آية النهاية</p>
                            <button
                              onClick={() => setAyahPicker({ entryIdx: idx, field: "ayahEnd", surahName: entry.surahEnd, currentValue: parseInt(entry.ayahEnd) || 1, source: "fixation" })}
                              className="w-full h-7 border border-input rounded-lg text-xs px-2 bg-background text-center font-semibold hover:border-primary/60 transition-colors"
                            >
                              {entry.ayahEnd}
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          <Button className="w-full" onClick={() => setStep("fixation_manual_date")}>
            التالي ← اختاري تاريخ البداية
          </Button>
        </div>
      </>
    );
  }

  // ── مسار التثبيت: خطوة ٣ — تاريخ البداية (يدوي) ─────────────────────
  if (step === "fixation_manual_date") {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("fixation_manual")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">٣ · اختاري تاريخ البداية</h3>
        </div>
        <div className="rounded-xl bg-muted/40 p-4">
          <input type="date" className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
            value={startDate || todayStr} min={todayStr}
            onChange={e => setStartDate(e.target.value)} />
          {!startDate && <p className="text-xs text-emerald-700 font-medium mt-2">✓ سيبدأ اليوم تلقائيًا إذا لم تختاري تاريخًا</p>}
        </div>
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-800 space-y-1">
          <p className="font-semibold">ملخص الخطة:</p>
          <p>• النصاب: <span className="font-bold">{fixationQuota === 1 ? "وجه كامل" : "نصف وجه"}</span> / جلسة</p>
          <p>• المدة: {FIXATION_WEEKS} أسابيع × {FIXATION_DAYS_PER_WEEK} أيام ({FIXATION_CYCLE} جلسة)</p>
          <p>• أيام العمل: الأحد، الاثنين، الثلاثاء، الأربعاء</p>
        </div>
        <Button className="w-full" onClick={() => setStep("fixation_manual_theme")}>
          التالي ← اختاري التنسيق
        </Button>
      </div>
    );
  }

  // ── مسار التثبيت: خطوة ٤ — الثيم (يدوي) + حفظ ─────────────────────
  if (step === "fixation_manual_theme") {
    const todayStr = new Date().toISOString().slice(0, 10);

    async function saveManualFixation() {
      setSaving(true);
      try {
        const entries = fixationManualEntries.map(e => ({
          dayNumber: e.dayNumber,
          surahStart: e.surahStart,
          ayahStart: parseInt(e.ayahStart) || 1,
          surahEnd: e.surahEnd,
          ayahEnd: parseInt(e.ayahEnd) || 1,
          pages: fixationQuota,
        }));
        const totalPagesFixed = Math.round(entries.reduce((s, e) => s + (e.pages || 0), 0) * 10) / 10;
        const body: Record<string, unknown> = {
          planType: "manual",
          cycleLength: 24,
          planEntries: entries,
          totalPages: totalPagesFixed,
          theme: selectedTheme,
          startDate: startDate || todayStr,
        };
        const res = await fetch(`${BASE}/api/students/${studentId}/review-plan`, {
          method: "POST", headers: authHeader(), body: JSON.stringify(body),
        });
        if (res.ok) {
          const data = await res.json();
          onPlanChange(data);
          setStep("view");
          toast({ title: "تم حفظ خطة التثبيت ✓" });
          onAfterSave?.();
        } else {
          let errMsg = "حدث خطأ أثناء الحفظ";
          try { const err = await res.json(); errMsg = err.error ?? errMsg; } catch { /* ignore */ }
          toast({ title: errMsg, variant: "destructive" });
        }
      } catch (err) {
        toast({ title: "تعذّر الاتصال بالسيرفر، حاولي مجدداً", variant: "destructive" });
        console.error("saveManualFixation error:", err);
      } finally {
        setSaving(false);
      }
    }

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("fixation_manual_date")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">٤ · اختاري لون الخطة</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {THEME_PRESETS.map(preset => (
            <button key={preset.name} onClick={() => setSelectedTheme(preset.theme)}
              className={`p-3 rounded-xl border-2 transition-all text-right ${selectedTheme.primaryColor === preset.theme.primaryColor ? "border-primary shadow-md" : "border-border hover:border-primary/40"}`}
              style={{ background: preset.theme.secondaryColor }}>
              <div className="w-6 h-6 rounded-full mb-1" style={{ background: preset.theme.primaryColor }} />
              <p className="text-xs font-bold" style={{ color: preset.theme.accentColor }}>{preset.name}</p>
            </button>
          ))}
        </div>
        <Button className="w-full font-bold" style={{ background: selectedTheme.primaryColor }}
          onClick={saveManualFixation} disabled={saving}>
          {saving ? <span className="w-4 h-4 border-2 border-white/50 border-t-white rounded-full animate-spin inline-block ml-2" /> : null}
          حفظ خطة التثبيت ✓
        </Button>
      </div>
    );
  }

  async function createPlan(planType: "auto" | "manual", theme: PlanTheme, entries?: PlanDayEntry[]) {
    setSaving(true);
    try {
      const sections = getSelectedSections();
      const body: Record<string, unknown> = {
        planType,
        theme,
        cycleLength: parseInt(cycleLength) || 21,
      };
      if (sections.length) {
        body.memorizedSections = sections;
      } else {
        if (startSurah) body.startSurah = startSurah;
        if (startAyah) body.startAyah = parseInt(startAyah);
        if (endSurah) body.memorizedUpToSurah = endSurah;
        if (endAyah) body.memorizedUpToAyah = parseInt(endAyah);
      }
      if (planType === "manual" && entries) body.planEntries = entries;
      if (startDate) body.startDate = startDate;

      const res = await fetch(`${BASE}/api/students/${studentId}/review-plan`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        onPlanChange(data);
        setStep("view");
        toast({ title: data.renewed ? "تم تجديد دورة المراجعة ✓" : "تم إنشاء خطة المراجعة ✓" });
        onAfterSave?.();
      } else {
        let errMsg = "حدث خطأ أثناء إنشاء الخطة";
        try { const err = await res.json(); errMsg = err.error ?? errMsg; } catch { /* ignore */ }
        toast({ title: errMsg, variant: "destructive" });
      }
    } catch {
      toast({ title: "تعذّر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function saveTheme(theme: PlanTheme) {
    setSaving(true);
    try {
      const res = await fetch(`${BASE}/api/students/${studentId}/review-plan`, {
        method: "PATCH",
        headers: authHeader(),
        body: JSON.stringify({ theme }),
      });
      if (res.ok) {
        const data = await res.json();
        onPlanChange(data);
        setStep("view");
        toast({ title: "تم حفظ التنسيق ✓" });
      }
    } finally {
      setSaving(false);
    }
  }

  function buildAutoManualEntries(): PlanDayEntry[] {
    if (!plan) return [];
    const len = plan.cycleLength ?? 21;
    const pagesPerDay = plan.totalPages / len;
    return Array.from({ length: len }, (_, i) => ({
      ...(plan.planEntries[i] ?? { surahStart: "الفاتحة", ayahStart: 1, surahEnd: "الفاتحة", ayahEnd: 7 }),
      dayNumber: i + 1,
      pages: Math.round(pagesPerDay * 10) / 10,
    }));
  }

  function getWorkingDayDate(cycleStart: string, dayNum: number, trackType?: string): string {
    let count = 0;
    const cur = new Date(cycleStart);
    while (true) {
      const dow = cur.getDay(); // 0=Sun 4=Thu 5=Fri 6=Sat
      const isWorking = trackType === "fixation"
        ? [0, 1, 2, 3].includes(dow)   // Sun-Wed only for fixation
        : dow !== 5;                     // skip Friday for all others
      if (isWorking) {
        count++;
        if (count === dayNum) return cur.toISOString().slice(0, 10);
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const AR_DAYS_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

  function generatePlanPrintHTML(p: ReviewPlan, name: string, circle: string): string {
    const rows = p.planEntries.map((entry, idx) => {
      const dayDate = getWorkingDayDate(p.currentCycleStart, entry.dayNumber, p.trackType);
      const dayJs = new Date(dayDate);
      const dayName = AR_DAYS_NAMES[dayJs.getDay()];
      const dateLabel = dayJs.toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" });
      const isToday = idx === p.dayInCycle - 1;
      const isPast = idx < p.dayInCycle - 1;
      const perf = p.dayPerformance?.find(d => d.dayNumber === entry.dayNumber);
      const perfText = isPast && perf ? (perf.absent ? "—" : perf.exceeded ? "↑" : perf.completed ? "✓" : perf.partial ? "≈" : "✗") : "";
      const perfColor = perf?.absent ? "#9ca3af" : perf?.exceeded ? "#2563eb" : perf?.completed ? "#059669" : perf?.partial ? "#d97706" : "#dc2626";
      const rowBg = isToday ? p.theme.secondaryColor : isPast && perf?.exceeded ? "#eff6ff" : isPast && perf?.completed ? "#f0fdf4" : isPast && perf?.partial ? "#fffbeb" : isPast && perf && !perf.absent && !perf.completed ? "#fff1f2" : "white";
      const _ssIdx3 = SURAHS.findIndex(s => s.name === entry.surahStart);
      const _seIdx3 = SURAHS.findIndex(s => s.name === entry.surahEnd);
      const [_nS3, _nA3, _fS3, _fA3] = _seIdx3 > _ssIdx3
        ? [entry.surahEnd, entry.ayahEnd, entry.surahStart, entry.ayahStart]
        : [entry.surahStart, entry.ayahStart, entry.surahEnd, entry.ayahEnd];
      const section = _nS3 === _fS3
        ? `${_nS3} (${_nA3}–${_fA3})`
        : `${_nS3} ${_nA3} ← ${_fS3} ${_fA3}`;
      return `<tr style="background:${rowBg};font-weight:${isToday ? "bold" : "normal"}"><td style="text-align:center">${entry.dayNumber}</td><td>${dayName}</td><td>${dateLabel}</td><td>${section}</td><td style="text-align:center">${entry.pages}</td><td style="text-align:center;color:${perfColor};font-weight:bold;font-size:15px">${perfText}</td></tr>`;
    }).join("");
    const startDate = new Date(p.currentCycleStart).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
    const printDate = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>خطة مراجعة ${name}</title>
<style>*{font-family:'Segoe UI',Tahoma,Arial,sans-serif;box-sizing:border-box}
body{margin:0;padding:28px;color:#1e293b;font-size:13px;background:white}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${p.theme.primaryColor};padding-bottom:16px;margin-bottom:20px}
.hdr-l h1{color:${p.theme.primaryColor};font-size:22px;margin:0 0 6px 0;font-weight:800}
.hdr-l .nm{font-size:16px;font-weight:700;color:#334155;margin:2px 0}
.hdr-l .sub{color:#64748b;font-size:11px;margin:2px 0}.hdr-r{text-align:left}
.badge{background:${p.theme.secondaryColor};color:${p.theme.accentColor};border-radius:24px;padding:4px 14px;font-size:13px;font-weight:700;display:inline-block;margin-bottom:6px;border:1px solid ${p.theme.primaryColor}33}
.stat{color:#64748b;font-size:11px;margin:2px 0}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.li{display:flex;align-items:center;gap:6px;font-size:11px;color:#64748b}
table{width:100%;border-collapse:collapse}
th{background:${p.theme.primaryColor};color:white;padding:10px 12px;text-align:right;font-size:12px;font-weight:700}
td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
.ftr{margin-top:24px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:14px}
@media print{body{padding:10px}@page{size:A4 portrait;margin:12mm}}</style></head>
<body>
<div class="hdr"><div class="hdr-l"><h1>📖 خطة المراجعة القرآنية</h1>
<p class="nm">${name}</p><p class="sub">حلقة ${circle} · بدء الدورة: ${startDate}</p></div>
<div class="hdr-r"><div class="badge">الدورة #${p.cycleCount}</div>
<p class="stat">📚 ${p.totalPages} وجه إجمالًا</p>
<p class="stat">📅 ${p.cycleLength} يوم عمل</p>
<p class="stat">اليوم ${p.dayInCycle} من ${p.cycleLength}</p></div></div>
<div class="legend">
<div class="li"><span style="color:#2563eb;font-weight:bold;font-size:14px">↑</span> متقدمة (تجاوزت النصاب)</div>
<div class="li"><span style="color:#059669;font-weight:bold;font-size:14px">✓</span> أكملت النصاب</div>
<div class="li"><span style="color:#d97706;font-weight:bold;font-size:14px">≈</span> جزئي (٤٠–٧٩٪)</div>
<div class="li"><span style="color:#dc2626;font-weight:bold;font-size:14px">✗</span> لم تحقق النصاب</div>
<div class="li"><span style="color:#9ca3af;font-size:14px">—</span> غياب</div></div>
<table><thead><tr>
<th style="width:36px;text-align:center">#</th><th style="width:80px">اليوم</th>
<th style="width:110px">التاريخ</th><th>المقطع القرآني</th>
<th style="width:56px;text-align:center">الوجوه</th>
<th style="width:50px;text-align:center">الأداء</th>
</tr></thead><tbody>${rows}</tbody></table>
<div class="ftr">مقرأة سنا الآي · خطة المراجعة والتثبيت · طُبعت في ${printDate}</div>
</body></html>`;
  }

  async function downloadPDF() {
    if (!plan) return;
    setDownloading(true);
    try {
      const html = generatePlanPrintHTML(plan, studentName, circleName);
      const w = window.open("", "_blank", "width=920,height=720");
      if (w) {
        w.document.write(html);
        w.document.close();
        w.focus();
        setTimeout(() => { w.print(); }, 700);
        setDownloading(false);
        return;
      }
    } catch { /* ignore */ }
    window.print();
    setDownloading(false);
  }

  // ── Loading ─────────────────────────────────────────────────────
  if (saving) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
        <span className="mr-2 text-sm text-muted-foreground">جاري الحفظ...</span>
      </div>
    );
  }

  // ── Theme picker ────────────────────────────────────────────────
  if (step === "theme") {
    return (
      <div className="space-y-4">
        {!plan && <StepIndicator current={4} />}
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep(plan ? "view" : "start_date")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">اختاري تنسيق خطتك</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {THEME_PRESETS.map(preset => (
            <button
              key={preset.name}
              onClick={() => setSelectedTheme(preset.theme)}
              className={`p-3 rounded-xl border-2 transition-all text-right ${
                selectedTheme.primaryColor === preset.theme.primaryColor
                  ? "border-primary shadow-md"
                  : "border-border hover:border-primary/40"
              }`}
              style={{ background: preset.theme.secondaryColor }}
            >
              <div className="w-6 h-6 rounded-full mb-1" style={{ background: preset.theme.primaryColor }} />
              <p className="text-xs font-bold" style={{ color: preset.theme.accentColor }}>{preset.name}</p>
            </button>
          ))}
        </div>
        {/* Preview */}
        {plan && (
          <div>
            <p className="text-xs text-muted-foreground mb-2">معاينة:</p>
            <PlanCard plan={{ ...plan, theme: selectedTheme }} studentName={studentName} circleName={circleName} />
          </div>
        )}
        <Button
          className="w-full"
          style={{ background: selectedTheme.primaryColor }}
          onClick={() => {
            if (plan) { saveTheme(selectedTheme); return; }
            if (planMode === "manual") {
              const sections = getSelectedSections();
              const len = parseInt(cycleLength) || 21;
              setManualEntries(Array.from({ length: len }, (_, i) => ({
                dayNumber: i + 1,
                surahStart: sections[0]?.startSurah ?? "الفاتحة",
                ayahStart: sections[0]?.startAyah ?? 1,
                surahEnd: sections[sections.length - 1]?.endSurah ?? "الناس",
                ayahEnd: sections[sections.length - 1]?.endAyah ?? 6,
                pages: 0,
              })));
              setStep("manual");
              return;
            }
            createPlan("auto", selectedTheme);
          }}
        >
          {plan ? "حفظ التنسيق" : planMode === "manual" ? "التالي ← تحرير التوزيع" : "إنشاء الخطة التلقائية ⚡"}
        </Button>
      </div>
    );
  }

  // ── Pick memorized content (juz/surah) ──────────────────────────
  if (step === "pick_content") {
    const juzCount = selectedJuz.size;
    const secCount = surahSections.length;
    const ready = hasContent();
    return (
      <div className="space-y-4">
        <StepIndicator current={1} />
        <div className="flex items-center gap-2">
          <button onClick={() => setStep("view")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">ما الذي حفظتِه؟</h3>
        </div>

        {/* Tab: أجزاء / سور */}
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl">
          {(["juz", "surah"] as const).map(t => (
            <button
              key={t}
              onClick={() => setContentTab(t)}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${contentTab === t ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            >
              {t === "juz" ? "أجزاء" : "سور مخصصة"}
            </button>
          ))}
        </div>

        {contentTab === "juz" ? (
          <div>
            <p className="text-xs text-muted-foreground mb-2">اضغطي على كل جزء حفظتِه</p>
            <div className="grid grid-cols-6 gap-1.5">
              {JUZ_RANGES.map(j => {
                const sel = selectedJuz.has(j.n);
                return (
                  <button
                    key={j.n}
                    onClick={() => {
                      const s = new Set(selectedJuz);
                      if (sel) s.delete(j.n); else s.add(j.n);
                      setSelectedJuz(s);
                    }}
                    className={`py-2.5 rounded-lg text-xs font-bold border-2 transition-all ${sel ? "border-emerald-500 bg-emerald-100 text-emerald-800 shadow-sm" : "border-border bg-background hover:border-emerald-300"}`}
                  >
                    {j.n}
                  </button>
                );
              })}
            </div>
            {juzCount > 0 && (
              <p className="text-xs text-emerald-700 mt-2 font-semibold bg-emerald-50 rounded-lg px-3 py-2">
                ✓ {juzCount} جزء محدد — تقريبًا {juzCount * 20} صفحة
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {surahSections.length > 0 && (
              <div className="space-y-1.5">
                {surahSections.map((sec, i) => (
                  <div key={i} className="flex items-center justify-between p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <span className="text-xs font-semibold text-emerald-800">
                      {sec.startSurah} ({sec.startAyah}) → {sec.endSurah} ({sec.endAyah})
                    </span>
                    <button onClick={() => setSurahSections(s => s.filter((_, j) => j !== i))} className="text-muted-foreground hover:text-destructive text-xs px-1">✕</button>
                  </div>
                ))}
              </div>
            )}
            <div className="rounded-xl bg-muted/40 p-3 space-y-2">
              <p className="text-xs font-bold text-muted-foreground">أضيفي نطاقًا</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">من سورة</p>
                  <select
                    className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background"
                    value={draftSection.startSurah}
                    onChange={e => setDraftSection(d => ({ ...d, startSurah: e.target.value }))}
                  >
                    <option value="">— اختاري —</option>
                    {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">إلى سورة</p>
                  <select
                    className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background"
                    value={draftSection.endSurah}
                    onChange={e => setDraftSection(d => ({ ...d, endSurah: e.target.value }))}
                  >
                    <option value="">— اختاري —</option>
                    {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                  </select>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs"
                disabled={!draftSection.startSurah || !draftSection.endSurah}
                onClick={() => {
                  if (!draftSection.startSurah || !draftSection.endSurah) return;
                  const startIdx = SURAHS.findIndex(s => s.name === draftSection.startSurah);
                  const endIdx   = SURAHS.findIndex(s => s.name === draftSection.endSurah);
                  // إذا كان النطاق معكوسًا نعكسه تلقائيًا
                  const [fromSurah, fromAyah, toSurah, toAyah] = startIdx <= endIdx
                    ? [draftSection.startSurah, parseInt(draftSection.startAyah) || 1, draftSection.endSurah, parseInt(draftSection.endAyah) || 1]
                    : [draftSection.endSurah,   parseInt(draftSection.endAyah)   || 1, draftSection.startSurah, parseInt(draftSection.startAyah) || 1];
                  setSurahSections(s => [...s, { startSurah: fromSurah, startAyah: fromAyah, endSurah: toSurah, endAyah: toAyah }]);
                  setDraftSection({ startSurah: "", startAyah: "1", endSurah: "", endAyah: "1" });
                }}
              >
                + أضيفي هذا النطاق
              </Button>
            </div>
            {secCount > 0 && (
              <p className="text-xs text-emerald-700 font-semibold bg-emerald-50 rounded-lg px-3 py-2">
                ✓ {secCount} {secCount === 1 ? "نطاق محدد" : "نطاقات محددة"}
              </p>
            )}
          </div>
        )}


        {ready && (
          <Button
            className="w-full"
            onClick={() => { setPlanMode("auto"); setStep("plan_type"); }}
          >
            التالي ← اختاري نوع الخطة
          </Button>
        )}
        {!ready && (
          <p className="text-center text-xs text-muted-foreground py-2">
            اختاري ما حفظتِه أولًا لتظهر خيارات إنشاء الخطة
          </p>
        )}
      </div>
    );
  }

  // ── New plan: choose plan type (step 2) ──────────────────────────
  if (step === "plan_type") {
    return (
      <div className="space-y-4">
        <StepIndicator current={2} />
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("pick_content")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">اختاري نوع التوزيع</h3>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPlanMode("auto")}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all ${planMode === "auto" ? "border-emerald-400 bg-emerald-50 shadow-md" : "border-emerald-200 bg-emerald-50/50 hover:border-emerald-300"}`}
          >
            <span className="text-2xl">⚡</span>
            <p className="font-bold text-emerald-800 text-xs">تلقائية</p>
            <p className="text-[10px] text-emerald-700 text-center">النظام يوزع على {cycleLength} يوم</p>
          </button>
          <button
            onClick={() => setPlanMode("manual")}
            className={`flex flex-col items-center gap-1.5 p-4 rounded-2xl border-2 transition-all ${planMode === "manual" ? "border-teal-200 bg-teal-50 shadow-md" : "border-teal-200 bg-teal-50/50 hover:border-teal-300"}`}
          >
            <span className="text-2xl">✏️</span>
            <p className="font-bold text-teal-800 text-xs">يدوية</p>
            <p className="text-[10px] text-teal-700 text-center">أعبّئ التوزيع بنفسي</p>
          </button>
        </div>
        <Button className="w-full" onClick={() => setStep("start_date")}>
          التالي ←
        </Button>
      </div>
    );
  }

  // ── New plan: choose start date (step 3) ──────────────────────────
  if (step === "start_date") {
    const todayStr = new Date().toISOString().slice(0, 10);
    return (
      <div className="space-y-4">
        <StepIndicator current={3} />
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep("plan_type")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">اختاري تاريخ البداية</h3>
        </div>
        <div className="rounded-xl bg-muted/40 p-4 space-y-3">
          <p className="text-xs text-muted-foreground">يمكنك اختيار اليوم أو تاريخًا مستقبليًا لبدء الدورة</p>
          <div>
            <p className="text-xs font-semibold mb-1.5">تاريخ البدء</p>
            <input
              type="date"
              className="w-full border rounded-xl px-3 py-2 text-sm bg-background"
              value={startDate || todayStr}
              min={todayStr}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          {!startDate && (
            <p className="text-xs text-emerald-700 font-medium">✓ سيبدأ اليوم تلقائيًا إذا لم تختاري تاريخًا</p>
          )}
        </div>
        <Button
          className="w-full"
          onClick={() => { setSelectedTheme(THEME_PRESETS[0].theme); setStep("theme"); }}
        >
          التالي ← اختاري الثيم
        </Button>
      </div>
    );
  }

  // ── First-time: choose plan type ────────────────────────────────
  if (step === "choose") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep("theme")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">تفاصيل الخطة</h3>
        </div>

        {/* Start Surah */}
        <div className="rounded-xl bg-muted/40 p-3 space-y-3">
          <p className="text-xs font-bold text-muted-foreground">نطاق المراجعة</p>
          <div>
            <p className="text-xs text-muted-foreground mb-1">من سورة (البداية)</p>
            <div className="flex gap-2">
              <select className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-background" value={startSurah} onChange={e => setStartSurah(e.target.value)}>
                <option value="">— من السجلات تلقائيًا —</option>
                {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <input type="number" min="1" max="286" placeholder="آية" className="w-20 border rounded-lg px-2 py-1.5 text-sm bg-background" value={startAyah} onChange={e => setStartAyah(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">إلى سورة (آخر ما حفظتِ)</p>
            <div className="flex gap-2">
              <select className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-background" value={endSurah} onChange={e => setEndSurah(e.target.value)}>
                <option value="">— من السجلات تلقائيًا —</option>
                {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <input type="number" min="1" max="286" placeholder="آية" className="w-20 border rounded-lg px-2 py-1.5 text-sm bg-background" value={endAyah} onChange={e => setEndAyah(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3">
          <button onClick={() => createPlan("auto", selectedTheme)} className="flex items-start gap-3 p-4 rounded-xl border-2 border-emerald-200 bg-emerald-50/60 hover:border-emerald-400 transition-all text-right">
            <div className="text-2xl mt-0.5">⚡</div>
            <div>
              <p className="font-bold text-sm text-emerald-800">خطة تلقائية</p>
              <p className="text-xs text-emerald-700 mt-0.5">يُقسّم النظام محفوظاتك على 21 يوم عمل (بدون الجمعة)</p>
            </div>
          </button>
          <button onClick={() => { setManualEntries(buildAutoManualEntries()); setStep("manual"); }} className="flex items-start gap-3 p-4 rounded-xl border-2 border-teal-200 bg-teal-50/60 hover:border-teal-200 transition-all text-right">
            <div className="text-2xl mt-0.5">✏️</div>
            <div>
              <p className="font-bold text-sm text-teal-800">خطة يدوية</p>
              <p className="text-xs text-teal-700 mt-0.5">تعدّلين توزيع كل يوم بنفسك حسب قدرتك</p>
            </div>
          </button>
        </div>
      </div>
    );
  }

  // ── Renew Step 1: choose theme ───────────────────────────────────
  if (step === "renew_theme") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep("view")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">تجديد دورة المراجعة</h3>
        </div>

        {/* Progressive content notice */}
        <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex gap-3 items-start">
          <span className="text-xl mt-0.5">📈</span>
          <div>
            <p className="font-bold text-blue-800 text-xs">النصاب يتصاعد تلقائيًا</p>
            <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
              الدورة الجديدة ستشمل كل ما حفظتِه منذ آخر دورة.
              عدد الأيام يبقى {plan?.cycleLength ?? 21} يومًا والنصاب اليومي يزداد مع حفظك.
            </p>
          </div>
        </div>

        {/* Auto/Manual choice — upfront */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">كيف تريدين بناء الدورة؟</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRenewPlanType("auto")}
              className={`p-3 rounded-xl border-2 text-right transition-all ${renewPlanType === "auto" ? "border-emerald-400 bg-emerald-50 shadow-sm" : "border-border bg-muted/30 hover:border-emerald-200"}`}
            >
              <div className="text-xl mb-1">⚡</div>
              <p className="text-xs font-bold text-emerald-800">تلقائية</p>
              <p className="text-[10px] text-emerald-700 mt-0.5">النظام يُقسّم من سجلاتك</p>
            </button>
            <button
              onClick={() => setRenewPlanType("manual")}
              className={`p-3 rounded-xl border-2 text-right transition-all ${renewPlanType === "manual" ? "border-teal-200 bg-teal-50 shadow-sm" : "border-border bg-muted/30 hover:border-teal-200"}`}
            >
              <div className="text-xl mb-1">✏️</div>
              <p className="text-xs font-bold text-teal-800">يدوية</p>
              <p className="text-[10px] text-teal-700 mt-0.5">أعدّل التوزيع بنفسي</p>
            </button>
          </div>
        </div>

        {/* Theme picker */}
        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-2">لون الدورة الجديدة</p>
          <div className="grid grid-cols-4 gap-2">
            {THEME_PRESETS.map(preset => (
              <button
                key={preset.name}
                onClick={() => setSelectedTheme(preset.theme)}
                className={`p-2 rounded-xl border-2 transition-all text-center ${selectedTheme.primaryColor === preset.theme.primaryColor ? "border-primary shadow-md" : "border-border hover:border-primary/40"}`}
                style={{ background: preset.theme.secondaryColor }}
              >
                <div className="w-5 h-5 rounded-full mx-auto mb-1" style={{ background: preset.theme.primaryColor }} />
                <p className="text-[10px] font-bold" style={{ color: preset.theme.accentColor }}>{preset.name}</p>
              </button>
            ))}
          </div>
        </div>

        <Button
          className="w-full"
          style={{ background: selectedTheme.primaryColor }}
          onClick={() => {
            if (renewPlanType === "auto") { setStep("renew_confirm"); }
            else { setManualEntries(plan ? plan.planEntries.map(e => ({ ...e })) : buildAutoManualEntries()); setStep("renew_surah"); }
          }}
        >
          {renewPlanType === "auto" ? "تأكيد التجديد التلقائي ⚡" : "التالي — حدّدي السور ←"}
        </Button>
      </div>
    );
  }

  // ── Renew Step 2: choose surah & plan type ───────────────────────
  if (step === "renew_surah") {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep("renew_theme")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">٢ · نطاق الدورة الجديدة</h3>
        </div>

        <div className="rounded-xl bg-muted/40 p-3 space-y-3">
          <p className="text-xs font-bold text-muted-foreground">نطاق المراجعة</p>
          <div>
            <p className="text-xs text-muted-foreground mb-1">من سورة (البداية)</p>
            <div className="flex gap-2">
              <select className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-background" value={startSurah} onChange={e => setStartSurah(e.target.value)}>
                <option value="">— من السجلات تلقائيًا —</option>
                {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <input type="number" min="1" max="286" placeholder="آية" className="w-20 border rounded-lg px-2 py-1.5 text-sm bg-background" value={startAyah} onChange={e => setStartAyah(e.target.value)} />
            </div>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">إلى سورة (آخر ما حفظتِ)</p>
            <div className="flex gap-2">
              <select className="flex-1 border rounded-lg px-2 py-1.5 text-sm bg-background" value={endSurah} onChange={e => setEndSurah(e.target.value)}>
                <option value="">— من السجلات تلقائيًا —</option>
                {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
              </select>
              <input type="number" min="1" max="286" placeholder="آية" className="w-20 border rounded-lg px-2 py-1.5 text-sm bg-background" value={endAyah} onChange={e => setEndAyah(e.target.value)} />
            </div>
          </div>
        </div>

        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">نوع الخطة</p>
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => setRenewPlanType("auto")}
              className={`p-3 rounded-xl border-2 text-right transition-all ${renewPlanType === "auto" ? "border-emerald-400 bg-emerald-50" : "border-border bg-muted/30 hover:border-emerald-200"}`}
            >
              <div className="text-lg mb-1">⚡</div>
              <p className="text-xs font-bold text-emerald-800">تلقائية</p>
              <p className="text-[10px] text-emerald-700">النظام يُقسّم تلقائيًا</p>
            </button>
            <button
              onClick={() => setRenewPlanType("manual")}
              className={`p-3 rounded-xl border-2 text-right transition-all ${renewPlanType === "manual" ? "border-teal-200 bg-teal-50" : "border-border bg-muted/30 hover:border-teal-200"}`}
            >
              <div className="text-lg mb-1">✏️</div>
              <p className="text-xs font-bold text-teal-800">يدوية</p>
              <p className="text-[10px] text-teal-700">أعدّل التوزيع بنفسي</p>
            </button>
          </div>
        </div>

        <Button
          className="w-full"
          style={{ background: selectedTheme.primaryColor }}
          onClick={() => {
            if (renewPlanType === "manual") {
              setManualEntries(plan ? plan.planEntries.map(e => ({ ...e })) : buildAutoManualEntries());
              setStep("manual");
            } else {
              setStep("renew_confirm");
            }
          }}
        >
          التالي — معاينة الخطة ←
        </Button>
      </div>
    );
  }

  // ── Renew Step 3: preview & confirm ─────────────────────────────
  if (step === "renew_confirm") {
    const previewPlan = plan ? { ...plan, theme: selectedTheme } : null;
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <button onClick={() => setStep("renew_surah")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
          <h3 className="font-bold text-sm">٣ · تأكيد الدورة الجديدة</h3>
        </div>

        {previewPlan && (
          <PlanCard plan={previewPlan} studentName={studentName} circleName={circleName} />
        )}

        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-xs text-amber-800 space-y-1">
          <p className="font-semibold">ملاحظة قبل التأكيد:</p>
          <p>• {cycleLength} يوم عمل بدون الجمعة (الجمعة إجازة)</p>
          {startSurah && <p>• من سورة: <span className="font-semibold">{startSurah}{startAyah ? ` آية ${startAyah}` : ""}</span></p>}
          {endSurah && <p>• إلى سورة: <span className="font-semibold">{endSurah}{endAyah ? ` آية ${endAyah}` : ""}</span></p>}
          <p>• خطة {renewPlanType === "auto" ? "تلقائية (يقسّمها النظام)" : "يدوية (حسب تعديلك)"}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            onClick={() => setStep("renew_surah")}
            className="text-sm"
          >
            ← تعديل
          </Button>
          <Button
            className="text-sm font-bold"
            style={{ background: selectedTheme.primaryColor }}
            onClick={() => createPlan(renewPlanType, selectedTheme)}
            disabled={saving}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : null}
            خطتي جاهزة ✓
          </Button>
        </div>
      </div>
    );
  }

  // ── Manual plan editor ──────────────────────────────────────────
  if (step === "manual") {
    return (
      <>
        <AyahPickerOverlay />
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <button onClick={() => plan ? setStep("renew_surah") : setStep("pick_content")} className="text-sm text-muted-foreground hover:text-foreground">← رجوع</button>
            <h3 className="font-bold text-sm">توزيع {manualEntries.length} يوم عمل</h3>
          </div>
          <p className="text-xs text-muted-foreground">عدّلي السورة والآية لكل يوم حسب رغبتك · اضغطي على رقم الآية لتختاريه من قائمة</p>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {manualEntries.map((entry, idx) => (
              <div key={entry.dayNumber} className="bg-muted/40 rounded-xl p-3 space-y-2">
                <p className="text-xs font-bold text-primary">اليوم {entry.dayNumber}</p>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">من سورة</p>
                    <select
                      className="w-full border rounded px-2 py-1 text-xs bg-background"
                      value={entry.surahStart}
                      onChange={e => {
                        const s = SURAHS.find(s => s.name === e.target.value);
                        const updated = [...manualEntries];
                        updated[idx] = { ...entry, surahStart: e.target.value, ayahStart: Math.min(entry.ayahStart, s?.ayahs ?? 1) };
                        setManualEntries(updated);
                      }}
                    >
                      {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">آية البداية</p>
                    <button
                      className="w-full border rounded px-2 py-1 text-xs bg-background text-center font-semibold hover:border-primary/60 transition-colors"
                      onClick={() => setAyahPicker({ entryIdx: idx, field: "ayahStart", surahName: entry.surahStart, currentValue: entry.ayahStart, source: "manual" })}
                    >
                      {entry.ayahStart}
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">إلى سورة</p>
                    <select
                      className="w-full border rounded px-2 py-1 text-xs bg-background"
                      value={entry.surahEnd}
                      onChange={e => {
                        const s = SURAHS.find(s => s.name === e.target.value);
                        const updated = [...manualEntries];
                        updated[idx] = { ...entry, surahEnd: e.target.value, ayahEnd: Math.min(entry.ayahEnd, s?.ayahs ?? 1) };
                        setManualEntries(updated);
                      }}
                    >
                      {SURAHS.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground mb-1">آية النهاية</p>
                    <button
                      className="w-full border rounded px-2 py-1 text-xs bg-background text-center font-semibold hover:border-primary/60 transition-colors"
                      onClick={() => setAyahPicker({ entryIdx: idx, field: "ayahEnd", surahName: entry.surahEnd, currentValue: entry.ayahEnd, source: "manual" })}
                    >
                      {entry.ayahEnd}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <Button className="w-full" onClick={() => createPlan("manual", selectedTheme, manualEntries)}>
            حفظ الخطة
          </Button>
        </div>
      </>
    );
  }

  // ── Loading state (plan === undefined = still fetching) ──────────
  if (plan === undefined) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  // ── No plan yet ──────────────────────────────────────────────────
  if (!plan) {
    if (readOnly) {
      return (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            لا توجد خطة مراجعة نشطة لهذه الطالبة
          </CardContent>
        </Card>
      );
    }
    // مسار التثبيت: معالج منفصل
    if (trackType === "fixation") {
      return (
        <div className="space-y-4">
          <Card className="border-0 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                خطة التثبيت
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center pb-4">
                ٦ أسابيع · ٤ أيام في الأسبوع (الأحد–الأربعاء) · تختارين نصابك اليومي
              </p>
              <Button
                className="w-full gap-2 text-sm font-bold"
                style={{ background: THEME_PRESETS[0].theme.primaryColor }}
                onClick={() => setStep("fixation_quota")}
              >
                <BookOpen className="w-4 h-4" />
                ابدئي إنشاء خطة التثبيت ←
              </Button>
            </CardContent>
          </Card>
        </div>
      );
    }
    return (
      <div className="space-y-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-emerald-600" />
              خطة المراجعة والتثبيت
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center pb-4">
              ٢١ يوم عمل (بدون الجمعة) · مع كل حفظ جديد يزداد نصابك تلقائيًا في الدورة القادمة
            </p>
            <Button
              className="w-full gap-2 text-sm font-bold"
              style={{ background: THEME_PRESETS[0].theme.primaryColor }}
              onClick={autoDetectAndEnterPick}
              disabled={autoDetecting}
            >
              {autoDetecting
                ? <Loader2 className="w-4 h-4 animate-spin" />
                : <BookOpen className="w-4 h-4" />}
              {autoDetecting ? "جاري اكتشاف المحفوظات..." : "اختاري ما حفظتِه وابدئي ←"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ── View existing plan ───────────────────────────────────────────
  const isLocked = plan.isLocked === true;
  const canActuallyEdit = !readOnly && !isLocked;

  // حساب أيام العمل منذ بداية الدورة (خطة المراجعة: سبت–خميس، تخطي الجمعة فقط)
  function workingDaysSinceCycleStart(cycleStart: string): number {
    const meccaToday = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const start = new Date(cycleStart);
    const end = new Date(meccaToday);
    let count = 0;
    const cur = new Date(start);
    while (cur < end) {
      if (cur.getDay() !== 5) count++;
      cur.setDate(cur.getDate() + 1);
    }
    return count;
  }
  const workingDaysSince = plan.currentCycleStart ? workingDaysSinceCycleStart(plan.currentCycleStart) : 0;
  // يمكن التجديد عند: اكتمال الدورة (اليوم >= طول الدورة) أو مرور ٢١ يوم عمل
  const canRenewNow = plan.dayInCycle >= plan.cycleLength || workingDaysSince >= 21;

  return (
    <div className="space-y-4">
      {/* Lock notice */}
      {!readOnly && isLocked && (
        <div className="rounded-xl bg-muted/60 border border-border/60 p-3 flex items-center gap-2">
          <span className="text-base">🔒</span>
          <p className="text-xs text-muted-foreground">
            انتهت فترة تعديل هذه الخطة (٤٨ ساعة من الإنشاء). للتعديل يجب إنشاء دورة جديدة.
          </p>
        </div>
      )}

      {/* Friday holiday banner */}
      {plan.isFriday && (
        <div className="rounded-xl border p-3 flex items-center gap-2 text-xs font-medium" style={{ background: "#fdf9ee", borderColor: "#d4b06a44", color: "#7a5020" }}>
          <span className="text-base">🌙</span>
          يوم الجمعة إجازة — لا مراجعة اليوم، استريحي ✨
        </div>
      )}

      {/* Stumbling alert */}
      {plan.isStumbling && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
          <p className="text-xs text-amber-800">
            لاحظنا تأخرًا في المراجعة ({plan.missedDaysLast30} أيام) — ستظهرين في قائمة التعثر.
          </p>
        </div>
      )}
      {!plan.isStumbling && plan.missedDaysLast30 === 0 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800">أداء ممتاز! لا تأخر هذا الشهر ✨</p>
        </div>
      )}

      {/* Cycle complete banner — يظهر عند الانتهاء المبكر أو إكمال الأيام */}
      {(plan.isCompletedEarly || plan.dayInCycle >= plan.cycleLength) && !canActuallyEdit && !readOnly && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-center space-y-2">
          <p className="text-2xl">{plan.isCompletedEarly ? "⭐" : "🎉"}</p>
          <p className="font-bold text-emerald-800 text-sm">
            {plan.isCompletedEarly ? "أحسنتِ! أتممتِ المراجعة قبل نهاية الدورة" : "أكملتِ دورة المراجعة!"}
          </p>
          <p className="text-xs text-emerald-700">يمكن تجديد الدورة عبر المعلمة — ستشمل محفوظاتك الجديدة تلقائيًا</p>
        </div>
      )}
      {(plan.dayInCycle >= plan.cycleLength || (plan.isCompletedEarly && canRenewNow)) && canActuallyEdit && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-center space-y-2">
          <p className="text-2xl">{plan.isCompletedEarly ? "⭐" : "🎉"}</p>
          <p className="font-bold text-emerald-800 text-sm">
            {plan.isCompletedEarly ? "أحسنتِ! أتممتِ المراجعة قبل نهاية الدورة" : "أكملتِ دورة المراجعة!"}
          </p>
          <p className="text-xs text-emerald-700">الدورة القادمة ستشمل محفوظاتك الجديدة تلقائيًا ويزداد نصابك</p>
          <Button
            size="sm"
            className="w-full text-xs gap-1.5 mt-1"
            style={{ background: plan.theme.primaryColor }}
            onClick={() => { setSelectedTheme(plan.theme); setStep("renew_theme"); }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            جددي دورتك الآن ←
          </Button>
        </div>
      )}
      {plan.isCompletedEarly && !canRenewNow && canActuallyEdit && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-300 p-4 text-center space-y-2">
          <p className="text-2xl">⭐</p>
          <p className="font-bold text-emerald-800 text-sm">أحسنتِ! أتممتِ المراجعة قبل نهاية الدورة</p>
          <p className="text-xs text-emerald-700">
            يمكن التجديد بعد مرور ٢١ يوم عمل — باقي {Math.max(0, 21 - workingDaysSince)} يوم
          </p>
        </div>
      )}

      {/* Plan card */}
      <PlanCard plan={plan} studentName={studentName} circleName={circleName} />

      {/* Actions */}
      {(() => {
        const isFixation = plan.trackType === "fixation";
        const actionCount = (canActuallyEdit && !isFixation ? 2 : 0) + (canActuallyEdit ? 1 : 0) + 1 + (canDeletePlan ? 1 : 0);
        return (
          <div className={`grid gap-2 grid-cols-${Math.min(actionCount, 5)}`}
            style={{ gridTemplateColumns: `repeat(${Math.min(actionCount, 5)}, minmax(0, 1fr))` }}>
            {canActuallyEdit && !isFixation && (
              <button onClick={() => { setSelectedTheme(plan.theme); setStep("theme"); }}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <Palette className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">التنسيق</span>
              </button>
            )}
            {canActuallyEdit && !isFixation && (
              <button onClick={() => { setManualEntries(plan.planEntries.map(e => ({ ...e }))); setStep("manual"); }}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <Edit3 className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">تعديل</span>
              </button>
            )}
            {canActuallyEdit && canRenewNow && !isFixation && (
              <button onClick={() => { setSelectedTheme(THEME_PRESETS[0].theme); setStep("renew_theme"); }}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">تجديد</span>
              </button>
            )}
            {canActuallyEdit && !canRenewNow && !isFixation && (
              <button disabled title={`يمكن التجديد بعد إكمال الدورة أو مرور 21 يوم عمل (باقي ${Math.max(0, 21 - workingDaysSince)} يوم)`}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/30 opacity-40 cursor-not-allowed">
                <RefreshCw className="w-4 h-4 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">تجديد</span>
              </button>
            )}
            <button onClick={downloadPDF} disabled={downloading}
              className="flex flex-col items-center gap-1 p-3 rounded-xl bg-muted/50 hover:bg-muted transition-colors">
              {downloading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <Download className="w-4 h-4 text-muted-foreground" />}
              <span className="text-[10px] text-muted-foreground">PDF</span>
            </button>
            {canDeletePlan && (
              <button onClick={deletePlan} disabled={saving}
                className="flex flex-col items-center gap-1 p-3 rounded-xl bg-rose-50 hover:bg-rose-100 transition-colors border border-rose-200">
                <span className="text-base">🗑️</span>
                <span className="text-[10px] text-rose-600 font-semibold">حذف الخطة</span>
              </button>
            )}
          </div>
        );
      })()}

      {/* Schedule Calendar */}
      <button
        onClick={() => setShowSchedule(!showSchedule)}
        className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-colors text-right"
        style={showSchedule ? { background: plan.theme.secondaryColor, borderColor: `${plan.theme.primaryColor}44` } : {}}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={showSchedule ? { color: plan.theme.accentColor } : {}}>
            📅 الجدول الزمني للدورة #{plan.cycleCount}
          </span>
          <span className="text-[10px] text-muted-foreground">{plan.cycleLength} يوم عمل · {plan.totalPages} وجه</span>
        </div>
        {showSchedule
          ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: plan.theme.primaryColor }} />
          : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>

      {showSchedule && plan.trackType === "fixation" && (
        // ── جدول مسار التثبيت: عرض أسبوعي ٦ أسابيع × ٤ أيام ──────
        <div className="space-y-3">
          {Array.from({ length: 6 }, (_, weekIdx) => {
            const sortedEntries = [...plan.planEntries].sort((a, b) => a.dayNumber - b.dayNumber);
            const weekDays = sortedEntries.slice(weekIdx * 4, weekIdx * 4 + 4);
            if (!weekDays.length) return null;
            return (
              <div key={weekIdx} className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
                <div className="px-3 py-2 font-bold text-xs" style={{ background: plan.theme.primaryColor, color: "white" }}>
                  الأسبوع {weekIdx + 1}
                </div>
                <table className="w-full" style={{ fontSize: "12px" }}>
                  <thead>
                    <tr className="bg-muted/40 border-b border-border/30">
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground" style={{ width: "32px" }}>#</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground" style={{ width: "72px" }}>اليوم</th>
                      <th className="px-2 py-2 text-right font-semibold text-muted-foreground" style={{ width: "80px" }}>التاريخ</th>
                      <th className="px-3 py-2 text-right font-semibold text-muted-foreground">المقطع</th>
                      <th className="px-2 py-2 text-center font-semibold text-muted-foreground" style={{ width: "56px" }}>الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {weekDays.map((entry, i) => {
                      const idx = weekIdx * 4 + i;
                      const dayDate = getWorkingDayDate(plan.currentCycleStart, entry.dayNumber, plan.trackType);
                      const dayJs = new Date(dayDate);
                      const dayName = AR_DAYS_NAMES[dayJs.getDay()];
                      const dateLabel = dayJs.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
                      const isToday = idx === plan.dayInCycle - 1;
                      const isPast = idx < plan.dayInCycle - 1;
                      const perf = plan.dayPerformance?.find(d => d.dayNumber === entry.dayNumber);
                      // عرض النطاق بالاتجاه الصحيح: السورة القريبة (الأعلى رقمًا) على اليمين
                      const _ssIdx = SURAHS.findIndex(s => s.name === entry.surahStart);
                      const _seIdx = SURAHS.findIndex(s => s.name === entry.surahEnd);
                      const [_nS, _nA, _fS, _fA] = _seIdx > _ssIdx
                        ? [entry.surahEnd, entry.ayahEnd, entry.surahStart, entry.ayahStart]
                        : [entry.surahStart, entry.ayahStart, entry.surahEnd, entry.ayahEnd];
                      const section = _nS === _fS
                        ? `${_nS} (${_nA}–${_fA})`
                        : `${_nS} ${_nA} ← ${_fS} ${_fA}`;

                      // ألوان الحالة — أزرق / أخضر / أصفر / رمادي
                      const isExceeded  = isPast && perf && !perf.absent && perf.exceeded;
                      const isRegular   = isPast && perf && !perf.absent && !perf.exceeded && perf.completed;
                      const isLate      = isPast && perf && !perf.absent && !perf.completed;
                      const isAbsent    = isPast && perf?.absent;

                      const rowBg = isToday
                        ? plan.theme.secondaryColor
                        : isExceeded  ? "#dbeafe"   // أزرق فاتح
                        : isRegular   ? "#dcfce7"   // أخضر فاتح
                        : isLate      ? "#fef9c3"   // أصفر فاتح
                        : isAbsent    ? "#f3f4f6"   // رمادي خفيف
                        : "";

                      const accentColor = isExceeded  ? "#1d4ed8"
                        : isRegular   ? "#15803d"
                        : isLate      ? "#a16207"
                        : isAbsent    ? "#9ca3af"
                        : "#64748b";

                      const circleStyle = isToday
                        ? { background: plan.theme.primaryColor, color: "white", fontSize: "9px" }
                        : isExceeded  ? { background: "#2563eb", color: "white", fontSize: "9px" }
                        : isRegular   ? { background: "#16a34a", color: "white", fontSize: "9px" }
                        : isLate      ? { background: "#ca8a04", color: "white", fontSize: "9px" }
                        : isAbsent    ? { background: "#9ca3af", color: "white", fontSize: "9px" }
                        : { background: "#e5e7eb", color: "#6b7280", fontSize: "9px" };

                      const statusLabel = isToday
                        ? "← اليوم"
                        : isExceeded  ? "ممتازة ✨"
                        : isRegular   ? "منتظمة ✓"
                        : isLate      ? "متأخرة ⏳"
                        : isAbsent    ? "غائبة"
                        : "";

                      const borderColor = isExceeded ? "border-blue-200"
                        : isRegular   ? "border-green-200"
                        : isLate      ? "border-yellow-200"
                        : "border-border/30";

                      return (
                        <tr key={entry.dayNumber}
                          className={`border-b ${borderColor}`}
                          style={{ background: rowBg, fontWeight: isToday ? "bold" : "normal" }}>
                          <td className="px-2 py-2.5 text-center">
                            <span className="inline-flex w-6 h-6 rounded-full items-center justify-center font-bold"
                              style={circleStyle}>
                              {entry.dayNumber}
                            </span>
                          </td>
                          <td className="px-2 py-2.5 text-right text-[11px] font-semibold" style={{ color: isToday ? plan.theme.accentColor : accentColor }}>{dayName}</td>
                          <td className="px-2 py-2.5 text-right text-[11px]" style={{ color: accentColor }}>{dateLabel}</td>
                          <td className="px-3 py-2.5 text-right text-[11px]" style={{ color: isToday ? plan.theme.primaryColor : accentColor }}>{section}</td>
                          <td className="px-2 py-2.5 text-center">
                            <span className={`inline-block text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                              isToday     ? "bg-white/60 text-gray-700"
                              : isExceeded ? "bg-blue-200 text-blue-800"
                              : isRegular  ? "bg-green-200 text-green-800"
                              : isLate     ? "bg-yellow-200 text-yellow-800"
                              : isAbsent   ? "bg-gray-200 text-gray-500"
                              : ""
                            }`}>
                              {statusLabel}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      {showSchedule && plan.trackType !== "fixation" && (
        <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "12px" }}>
              <thead>
                <tr style={{ background: plan.theme.primaryColor }}>
                  <th className="text-white font-bold px-2 py-2.5 text-center" style={{ width: "32px" }}>#</th>
                  <th className="text-white font-bold px-2 py-2.5 text-right" style={{ width: "72px" }}>اليوم</th>
                  <th className="text-white font-bold px-2 py-2.5 text-right" style={{ width: "96px" }}>التاريخ</th>
                  <th className="text-white font-bold px-3 py-2.5 text-right">المقطع القرآني</th>
                  <th className="text-white font-bold px-2 py-2.5 text-center" style={{ width: "48px" }}>الوجوه</th>
                  <th className="text-white font-bold px-2 py-2.5 text-center" style={{ width: "40px" }}>✓</th>
                </tr>
              </thead>
              <tbody>
                {[...plan.planEntries].sort((a, b) => a.dayNumber - b.dayNumber).map((entry, idx) => {
                  const dayDate = getWorkingDayDate(plan.currentCycleStart, entry.dayNumber, plan.trackType);
                  const dayJs = new Date(dayDate);
                  const dayName = AR_DAYS_NAMES[dayJs.getDay()];
                  const dateLabel = dayJs.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
                  const isToday = idx === plan.dayInCycle - 1;
                  const isPast = idx < plan.dayInCycle - 1;
                  const perf = plan.dayPerformance?.find(d => d.dayNumber === entry.dayNumber);
                  const _ssIdx2 = SURAHS.findIndex(s => s.name === entry.surahStart);
                  const _seIdx2 = SURAHS.findIndex(s => s.name === entry.surahEnd);
                  const [_nS2, _nA2, _fS2, _fA2] = _seIdx2 > _ssIdx2
                    ? [entry.surahEnd, entry.ayahEnd, entry.surahStart, entry.ayahStart]
                    : [entry.surahStart, entry.ayahStart, entry.surahEnd, entry.ayahEnd];
                  const section = _nS2 === _fS2
                    ? `${_nS2} (${_nA2}–${_fA2})`
                    : `${_nS2} ${_nA2} ← ${_fS2} ${_fA2}`;
                  return (
                    <tr key={entry.dayNumber} className="border-b border-border/30"
                      style={{
                        background: isToday ? plan.theme.secondaryColor
                          : isPast && perf?.exceeded ? "#eff6ff"
                          : isPast && perf?.completed ? "#f0fdf4"
                          : isPast && perf?.partial ? "#fffbeb"
                          : isPast && perf && !perf.absent && !perf.completed ? "#fff1f2" : "",
                        fontWeight: isToday ? "bold" : "normal",
                      }}>
                      <td className="px-2 py-2 text-center">
                        <span className="inline-flex w-5 h-5 rounded-full items-center justify-center font-bold"
                          style={isToday ? { background: plan.theme.primaryColor, color: "white", fontSize: "9px" } : { background: "#e5e7eb", color: "#6b7280", fontSize: "9px" }}>
                          {entry.dayNumber}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right" style={isToday ? { color: plan.theme.accentColor } : { color: "#64748b" }}>{dayName}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{dateLabel}</td>
                      <td className="px-3 py-2 text-right" style={isToday ? { color: plan.theme.primaryColor } : {}}>{section}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground">{entry.pages}</td>
                      <td className="px-2 py-2 text-center">
                        {isPast && perf ? (
                          <span className={`font-bold ${perf.absent ? "text-gray-400" : perf.exceeded ? "text-blue-600" : perf.completed ? "text-emerald-600" : perf.partial ? "text-amber-500" : "text-rose-500"}`} style={{ fontSize: "14px" }}>
                            {perf.absent ? "—" : perf.exceeded ? "↑" : perf.completed ? "✓" : perf.partial ? "≈" : "✗"}
                          </span>
                        ) : isToday ? (
                          <span style={{ color: plan.theme.primaryColor }}>←</span>
                        ) : (
                          <span className="text-gray-200">·</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Previous cycles history — للطالبة فقط، لا للمشرفات ─────── */}
      {!readOnly && plan.history && plan.history.length > 0 && (
        <PlanHistory history={plan.history} theme={plan.theme} />
      )}
    </div>
  );
}

function PlanHistory({ history, theme }: { history: PlanSnapshot[]; theme: PlanTheme }) {
  const [open, setOpen] = useState(false);
  const sorted = [...history].sort((a, b) => b.cycleCount - a.cycleCount);

  function fmtDate(d: string) {
    return new Date(d).toLocaleDateString("ar-SA", { month: "short", day: "numeric", year: "numeric" });
  }

  return (
    <div className="rounded-xl border border-border/50 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted-foreground">الدورات السابقة</span>
          <span
            className="text-[10px] font-bold px-2 py-0.5 rounded-full"
            style={{ background: theme.secondaryColor, color: theme.accentColor }}
          >
            {history.length}
          </span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
      </button>

      {open && (
        <div className="divide-y divide-border/40">
          {sorted.map(snap => (
            <div key={snap.cycleCount} className="px-4 py-3 flex items-center gap-3 bg-background hover:bg-muted/20 transition-colors">
              <div
                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                style={{ background: theme.secondaryColor, color: theme.accentColor }}
              >
                {snap.cycleCount}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold truncate">
                  دورة #{snap.cycleCount}
                  {snap.memorizedUpToSurah && ` — حتى ${snap.memorizedUpToSurah}`}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {fmtDate(snap.startDate)} ← {fmtDate(snap.endDate)}
                </p>
              </div>
              <div className="text-center shrink-0">
                <p className="text-sm font-bold" style={{ color: theme.primaryColor }}>{snap.totalPages}</p>
                <p className="text-[10px] text-muted-foreground">وجه</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
