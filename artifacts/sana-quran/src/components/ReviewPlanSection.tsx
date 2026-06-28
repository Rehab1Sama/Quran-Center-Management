import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { SURAHS, calculatePages } from "@/lib/quran";
import { BookOpen, Plus, Trash2, RefreshCw, Loader2, AlertCircle, ChevronRight, ChevronLeft, CalendarDays, CheckCircle2, X } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const getToken = () => localStorage.getItem("sana_auth_token");
const authHeader = () => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
};

export const PLAN_COLORS = [
  { color: "#FFD6E0", name: "وردي" },
  { color: "#E8D5F5", name: "بنفسجي" },
  { color: "#D4EDFF", name: "سماوي" },
  { color: "#D4F5E9", name: "نعناعي" },
  { color: "#FFE8D4", name: "خوخي" },
  { color: "#FFF5CC", name: "ليموني" },
  { color: "#DDF0DD", name: "أخضر" },
  { color: "#EDD4F5", name: "ليلكي" },
  { color: "#FFD8CC", name: "مرجاني" },
  { color: "#D4DCF5", name: "رمادي-أزرق" },
];

const SURAH_OPTIONS = SURAHS.map(s => ({ value: s.name, label: `${s.number}. ${s.name}`, number: s.number, ayahs: s.ayahs }));

export function getMeccaToday(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function getDayDates(startDate: string, totalDays: number, mode: "girls" | "fixation"): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate + "T12:00:00Z");
  const firstDow = cur.getUTCDay();
  const firstValid = mode === "girls" ? firstDow !== 5 : firstDow <= 3;
  if (firstValid) dates.push(cur.toISOString().slice(0, 10));
  while (dates.length < totalDays) {
    cur.setDate(cur.getDate() + 1);
    const dow = cur.getUTCDay();
    const valid = mode === "girls" ? dow !== 5 : dow >= 0 && dow <= 3;
    if (valid) dates.push(cur.toISOString().slice(0, 10));
  }
  return dates;
}

export function getCurrentPlanDay(startDate: string, totalDays: number, mode: "girls" | "fixation"): number {
  const today = getMeccaToday();
  const dates = getDayDates(startDate, totalDays, mode);
  const idx = dates.findIndex(d => d === today);
  if (idx >= 0) return idx + 1;
  if (today < dates[0]) return 0;
  if (today > dates[dates.length - 1]) return totalDays + 1;
  return dates.filter(d => d <= today).length;
}

export function formatArDate(dateStr: string): string {
  const dow = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const d = new Date(dateStr + "T12:00:00Z");
  return `${dow[d.getUTCDay()]} ${d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" })}`;
}

function distribute(total: number, parts: number): number[] {
  const perDay = total / parts;
  const arr: number[] = [];
  let accumulated = 0;
  for (let i = 0; i < parts; i++) {
    accumulated += perDay;
    const val = Math.round(accumulated * 2) / 2 - Math.round((accumulated - perDay) * 2) / 2;
    arr.push(Math.round(val * 2) / 2);
  }
  return arr;
}

export interface DayEntry {
  dayNumber: number;
  surahStart?: string;
  ayahStart?: number;
  surahEnd?: string;
  ayahEnd?: number;
  pages?: number;
}

export interface ReviewPlan {
  id: number;
  planType: string;
  quotaType?: string;
  quotaJuz?: number;
  quotaSurahStart?: string;
  quotaAyahStart?: number;
  quotaSurahEnd?: string;
  quotaAyahEnd?: number;
  extraRanges?: string | null;
  planMode?: string;
  totalPages?: number;
  quantity?: string;
  startDate: string;
  themeColor: string;
  status: string;
  days: DayEntry[];
  studentName?: string;
  studentId?: number;
  circleId?: number;
}

interface SurahRange {
  surahStart: string;
  ayahStart: number;
  surahEnd: string;
  ayahEnd: number;
}

interface Props {
  studentId: number;
  circleId: number;
  trackType: string;
  canCreate: boolean;
}

export default function ReviewPlanSection({ studentId, circleId, trackType, canCreate }: Props) {
  const [plan, setPlan] = useState<ReviewPlan | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);
  const { toast } = useToast();

  const isGirls = trackType === "girls";
  const isFixation = trackType === "fixation";
  const planTitle = isFixation ? "خطة التثبيت" : "خطة المراجعة";
  const totalDays = isFixation ? 24 : 21;
  const planMode: "girls" | "fixation" = isFixation ? "fixation" : "girls";

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/students/${studentId}/review-plan?circleId=${circleId}`, { headers: authHeader() });
      if (!res.ok) { setPlan(null); return; }
      const data = await res.json();
      setPlan(data);
    } catch { setPlan(null); }
    finally { setLoading(false); }
  }, [studentId, circleId]);

  useEffect(() => { fetchPlan(); }, [fetchPlan]);

  const handleCancel = async () => {
    if (!plan || !confirm("هل تريدين إلغاء الخطة الحالية؟")) return;
    await fetch(`${BASE}/api/students/${studentId}/review-plan/${plan.id}`, { method: "DELETE", headers: authHeader() });
    fetchPlan();
    toast({ title: "تم إلغاء الخطة" });
  };

  if (!isGirls && !isFixation) return null;

  if (loading) {
    return (
      <Card className="border-0 shadow-sm">
        <CardContent className="py-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-0 shadow-sm overflow-hidden" style={plan ? { borderTop: `4px solid ${plan.themeColor}` } : {}}>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              {planTitle}
            </CardTitle>
            <div className="flex gap-2">
              {plan && canCreate && (
                <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1" onClick={handleCancel}>
                  <Trash2 className="w-3.5 h-3.5" />إلغاء
                </Button>
              )}
              {canCreate && (
                <Button size="sm" variant={plan ? "outline" : "default"} className="text-xs gap-1" onClick={() => setWizardOpen(true)}>
                  {plan ? <><RefreshCw className="w-3.5 h-3.5" />تجديد</> : <><Plus className="w-3.5 h-3.5" />إنشاء خطة</>}
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {!plan ? (
            <div className="text-center py-6 text-muted-foreground">
              <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-sm">لا توجد خطة نشطة</p>
              {canCreate && <p className="text-xs mt-1 opacity-70">اضغطي "إنشاء خطة" للبدء</p>}
            </div>
          ) : (
            <PlanDisplay plan={plan} totalDays={totalDays} planMode={planMode} />
          )}
        </CardContent>
      </Card>

      <PlanWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onSaved={() => { setWizardOpen(false); fetchPlan(); }}
        studentId={studentId}
        circleId={circleId}
        isFixation={isFixation}
        totalDays={totalDays}
        planMode={planMode}
        planTitle={planTitle}
      />
    </>
  );
}

function buildQuotaLabel(plan: ReviewPlan): string {
  if (plan.quotaType === "juz") return `${plan.quotaJuz} جزء`;
  if (plan.quotaType === "surah" && plan.quotaSurahStart) {
    const first = `${plan.quotaSurahStart}${plan.quotaAyahStart ? ` (${plan.quotaAyahStart})` : ""} ← ${plan.quotaSurahEnd}${plan.quotaAyahEnd ? ` (${plan.quotaAyahEnd})` : ""}`;
    if (plan.extraRanges) {
      try {
        const extra = JSON.parse(plan.extraRanges) as SurahRange[];
        const extraLabels = extra.map(r => `${r.surahStart}${r.ayahStart ? ` (${r.ayahStart})` : ""} ← ${r.surahEnd}${r.ayahEnd ? ` (${r.ayahEnd})` : ""}`);
        return [first, ...extraLabels].join(" + ");
      } catch { return first; }
    }
    return first;
  }
  return "";
}

function PlanDisplay({ plan, totalDays, planMode }: { plan: ReviewPlan; totalDays: number; planMode: "girls" | "fixation" }) {
  const today = getMeccaToday();
  const dates = getDayDates(plan.startDate, totalDays, planMode);
  const currentDay = getCurrentPlanDay(plan.startDate, totalDays, planMode);
  const todayEntry = plan.days.find(d => d.dayNumber === currentDay);
  const endDate = dates[dates.length - 1] ?? plan.startDate;
  const isCompleted = today > endDate;
  const notStarted = today < plan.startDate;

  const quotaLabel = buildQuotaLabel(plan);

  const totalLabel = plan.totalPages != null
    ? `${plan.totalPages} صفحة`
    : plan.quantity === "half" ? "نصف وجه/يوم" : plan.quantity === "full" ? "وجه/يوم" : "";

  const [expanded, setExpanded] = useState(false);
  const shownDays = expanded ? plan.days : plan.days.slice(0, 7);

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {[
          { label: "بداية الخطة", value: formatArDate(plan.startDate) },
          { label: "نهاية الخطة", value: formatArDate(endDate) },
          ...(quotaLabel ? [{ label: "النصاب", value: quotaLabel }] : []),
          ...(totalLabel ? [{ label: "الكمية", value: totalLabel }] : []),
        ].map(({ label, value }) => (
          <div key={label} className="bg-muted/40 rounded-xl p-2.5">
            <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
            <p className="font-semibold text-xs">{value}</p>
          </div>
        ))}
      </div>

      {isCompleted ? (
        <div className="flex items-center gap-2 text-emerald-700 bg-emerald-50 rounded-xl p-3">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span className="text-sm font-semibold">انتهت الخطة بنجاح!</span>
        </div>
      ) : notStarted ? (
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 rounded-xl p-3">
          <CalendarDays className="w-4 h-4 shrink-0" />
          <span className="text-sm">تبدأ الخطة {formatArDate(plan.startDate)}</span>
        </div>
      ) : (
        <div className="rounded-xl p-3" style={{ background: plan.themeColor + "99" }}>
          <p className="text-[10px] text-muted-foreground mb-1">اليوم الحالي</p>
          <p className="font-bold text-2xl">{currentDay} <span className="text-base font-normal text-muted-foreground">/ {totalDays}</span></p>
          {todayEntry && (
            <div className="mt-1.5 text-xs space-y-0.5">
              {todayEntry.surahStart && (
                <p className="text-muted-foreground">
                  {todayEntry.surahStart}{todayEntry.ayahStart ? ` (آية ${todayEntry.ayahStart}` : ""}
                  {todayEntry.surahEnd && todayEntry.surahEnd !== todayEntry.surahStart ? ` ← ${todayEntry.surahEnd}` : ""}
                  {todayEntry.ayahEnd ? ` ${todayEntry.ayahEnd})` : ""}
                </p>
              )}
              {todayEntry.pages != null && <p className="font-semibold">{todayEntry.pages} صفحة</p>}
            </div>
          )}
        </div>
      )}

      {plan.days.length > 0 && (
        <div>
          <div className="overflow-x-auto rounded-xl border border-border/40">
            <table className="w-full text-xs min-w-[280px]">
              <thead className="bg-muted/50">
                <tr>
                  <th className="py-2 px-2 text-right font-semibold text-muted-foreground w-8">يوم</th>
                  <th className="py-2 px-2 text-right font-semibold text-muted-foreground">التاريخ</th>
                  <th className="py-2 px-2 text-right font-semibold text-muted-foreground">النطاق</th>
                  <th className="py-2 px-2 text-center font-semibold text-muted-foreground w-14">صفحات</th>
                </tr>
              </thead>
              <tbody>
                {shownDays.map(day => {
                  const dateStr = dates[day.dayNumber - 1];
                  const isToday = day.dayNumber === currentDay;
                  const isPast = day.dayNumber < currentDay;
                  return (
                    <tr key={day.dayNumber} className={`border-t border-border/20 ${isToday ? "font-semibold" : ""}`}
                      style={isToday ? { background: plan.themeColor + "70" } : isPast ? { opacity: 0.45 } : {}}>
                      <td className="py-1.5 px-2 text-center text-muted-foreground font-mono">{day.dayNumber}</td>
                      <td className="py-1.5 px-2 text-muted-foreground text-[11px]">{dateStr ? formatArDate(dateStr) : "—"}</td>
                      <td className="py-1.5 px-2 text-[11px]">
                        {day.surahStart
                          ? `${day.surahStart}${day.ayahStart ? ` (${day.ayahStart}` : ""}${day.surahEnd && day.surahEnd !== day.surahStart ? ` ← ${day.surahEnd}` : ""}${day.ayahEnd ? ` ${day.ayahEnd})` : ""}`
                          : "—"}
                      </td>
                      <td className="py-1.5 px-2 text-center">{day.pages ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {plan.days.length > 7 && (
            <button onClick={() => setExpanded(!expanded)} className="mt-1.5 text-xs text-primary underline w-full text-center">
              {expanded ? "إخفاء الأيام" : `عرض جميع الأيام (${plan.days.length})`}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Mini colour picker ────────────────────────────────────────────────────────
function ColorPicker({ themeColor, setThemeColor }: { themeColor: string; setThemeColor: (v: string) => void }) {
  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">لون الخطة</p>
      <div className="flex gap-2 flex-wrap">
        {PLAN_COLORS.map(c => (
          <button
            key={c.color}
            onClick={() => setThemeColor(c.color)}
            title={c.name}
            className={`w-7 h-7 rounded-full border-2 transition-all ${themeColor === c.color ? "border-gray-800 scale-110 shadow" : "border-transparent"}`}
            style={{ background: c.color }}
          />
        ))}
      </div>
    </div>
  );
}

// ─── Ayah Select Dropdown ─────────────────────────────────────────────────────
function AyahSelect({ surahName, value, onChange, placeholder }: {
  surahName?: string; value?: number; onChange: (v: number | undefined) => void; placeholder: string;
}) {
  const surah = SURAHS.find(s => s.name === surahName);
  const count = surah?.ayahs ?? 0;
  return (
    <select
      className="border rounded p-1 text-xs bg-background w-full"
      value={value ?? ""}
      onChange={e => onChange(parseInt(e.target.value) || undefined)}
      disabled={!surahName || count === 0}
    >
      <option value="">{placeholder}</option>
      {Array.from({ length: count }, (_, i) => i + 1).map(n => (
        <option key={n} value={n}>{n}</option>
      ))}
    </select>
  );
}

// ─── Juz Grid (30 checkboxes) ─────────────────────────────────────────────────
function JuzGrid({ selectedJuz, onChange }: {
  selectedJuz: Set<number>;
  onChange: (updated: Set<number>) => void;
}) {
  const toggle = (juz: number) => {
    const next = new Set(selectedJuz);
    if (next.has(juz)) next.delete(juz);
    else next.add(juz);
    onChange(next);
  };

  const selectAll = () => onChange(new Set(Array.from({ length: 30 }, (_, i) => i + 1)));
  const clearAll = () => onChange(new Set());

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {selectedJuz.size > 0
            ? <><span className="font-bold text-foreground">{selectedJuz.size}</span> جزء محدد = <span className="font-bold text-primary">{selectedJuz.size * 20}</span> صفحة</>
            : "اختاري الأجزاء المراد مراجعتها"}
        </p>
        <div className="flex gap-1.5">
          <button onClick={selectAll} className="text-[10px] text-primary underline">الكل</button>
          <span className="text-muted-foreground text-[10px]">|</span>
          <button onClick={clearAll} className="text-[10px] text-muted-foreground underline">مسح</button>
        </div>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {Array.from({ length: 30 }, (_, i) => i + 1).map(juz => (
          <button
            key={juz}
            onClick={() => toggle(juz)}
            className={`aspect-square rounded-lg text-sm font-bold transition-all border-2 ${
              selectedJuz.has(juz)
                ? "bg-primary text-white border-primary shadow-sm"
                : "bg-background text-foreground border-border hover:border-primary/40 hover:bg-primary/5"
            }`}
          >
            {juz}
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Multi Surah Ranges ────────────────────────────────────────────────────────
const DEFAULT_RANGE: SurahRange = { surahStart: SURAHS[0].name, ayahStart: 1, surahEnd: SURAHS[0].name, ayahEnd: 7 };

function SurahRangesEditor({ ranges, onChange }: {
  ranges: SurahRange[];
  onChange: (r: SurahRange[]) => void;
}) {
  const updateRange = (idx: number, field: keyof SurahRange, value: string | number) => {
    const next = ranges.map((r, i) => i === idx ? { ...r, [field]: value } : r);
    onChange(next);
  };

  const addRange = () => onChange([...ranges, { ...DEFAULT_RANGE }]);
  const removeRange = (idx: number) => onChange(ranges.filter((_, i) => i !== idx));

  const totalPages = ranges.reduce((sum, r) => {
    const p = calculatePages(r.surahStart, r.ayahStart, r.surahEnd, r.ayahEnd);
    return sum + (p > 0 ? p : 0);
  }, 0);

  return (
    <div className="space-y-3">
      {ranges.map((range, idx) => {
        const startSurahObj = SURAHS.find(s => s.name === range.surahStart);
        const endSurahObj = SURAHS.find(s => s.name === range.surahEnd);
        const rangePages = calculatePages(range.surahStart, range.ayahStart, range.surahEnd, range.ayahEnd);

        return (
          <div key={idx} className="bg-muted/30 rounded-xl p-3 space-y-2 relative">
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-semibold text-muted-foreground">
                النطاق {ranges.length > 1 ? idx + 1 : ""}
                {rangePages > 0 && <span className="text-primary font-bold mr-1">({rangePages} صفحة)</span>}
              </p>
              {ranges.length > 1 && (
                <button onClick={() => removeRange(idx)} className="text-rose-400 hover:text-rose-600 p-0.5">
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">من سورة</Label>
                <select
                  className="w-full border rounded-lg p-1.5 text-xs mt-0.5 bg-background"
                  value={range.surahStart}
                  onChange={e => {
                    const s = SURAHS.find(s => s.name === e.target.value);
                    updateRange(idx, "surahStart", e.target.value);
                    if (s) updateRange(idx, "ayahStart", 1);
                  }}
                >
                  {SURAH_OPTIONS.map(s => <option key={s.number} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">من آية</Label>
                <AyahSelect
                  surahName={range.surahStart}
                  value={range.ayahStart}
                  onChange={v => updateRange(idx, "ayahStart", v ?? 1)}
                  placeholder="آية البداية"
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">إلى سورة</Label>
                <select
                  className="w-full border rounded-lg p-1.5 text-xs mt-0.5 bg-background"
                  value={range.surahEnd}
                  onChange={e => {
                    const s = SURAHS.find(s => s.name === e.target.value);
                    updateRange(idx, "surahEnd", e.target.value);
                    if (s) updateRange(idx, "ayahEnd", s.ayahs);
                  }}
                >
                  {SURAH_OPTIONS.map(s => <option key={s.number} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">إلى آية</Label>
                <AyahSelect
                  surahName={range.surahEnd}
                  value={range.ayahEnd}
                  onChange={v => updateRange(idx, "ayahEnd", v ?? (endSurahObj?.ayahs ?? 1))}
                  placeholder="آية النهاية"
                />
              </div>
            </div>
          </div>
        );
      })}

      <button
        onClick={addRange}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium w-full justify-center py-2 border-2 border-dashed border-primary/30 rounded-xl hover:border-primary/50 hover:bg-primary/5 transition-colors"
      >
        <Plus className="w-3.5 h-3.5" />
        إضافة نطاق آخر
      </button>

      {totalPages > 0 && (
        <p className="text-sm text-center text-muted-foreground">
          إجمالي النصاب: <span className="font-bold text-foreground">{totalPages} صفحة</span>
        </p>
      )}
    </div>
  );
}

// ─── Wizard ────────────────────────────────────────────────────────────────────
function PlanWizard({ open, onClose, onSaved, studentId, circleId, isFixation, totalDays, planMode, planTitle }: {
  open: boolean; onClose: () => void; onSaved: () => void;
  studentId: number; circleId: number; isFixation: boolean;
  totalDays: number; planMode: "girls" | "fixation"; planTitle: string;
}) {
  const { toast } = useToast();
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const today = getMeccaToday();

  // Girls: 4 steps (quota → mode → days → date+color)
  // Fixation: 3 steps (quantity → date+color → weeks)
  const maxSteps = isFixation ? 3 : 4;

  const [quotaType, setQuotaType] = useState<"juz" | "surah">("juz");
  // Juz: set of selected Juz numbers (1-30)
  const [selectedJuz, setSelectedJuz] = useState<Set<number>>(new Set());
  // Surah: multiple ranges
  const [surahRanges, setSurahRanges] = useState<SurahRange[]>([{ ...DEFAULT_RANGE }]);

  const [wizardMode, setWizardMode] = useState<"auto" | "manual">("auto");
  const [daysInitMode, setDaysInitMode] = useState<"none" | "auto" | "manual">("none");
  const [quantity, setQuantity] = useState<"full" | "half">("full");
  const [startDate, setStartDate] = useState(today);
  const [themeColor, setThemeColor] = useState(PLAN_COLORS[1].color);
  const [days, setDays] = useState<DayEntry[]>([]);
  const [totalPages, setTotalPages] = useState(0);

  const computedPages = quotaType === "juz"
    ? selectedJuz.size * 20
    : surahRanges.reduce((sum, r) => {
        const p = calculatePages(r.surahStart, r.ayahStart, r.surahEnd, r.ayahEnd);
        return sum + (p > 0 ? p : 0);
      }, 0);

  useEffect(() => {
    if (!open) {
      setStep(1);
      setDays([]);
      setDaysInitMode("none");
      setStartDate(today);
      setThemeColor(PLAN_COLORS[1].color);
      setQuotaType("juz");
      setSelectedJuz(new Set());
      setSurahRanges([{ ...DEFAULT_RANGE }]);
      setWizardMode("auto");
      setQuantity("full");
      setTotalPages(0);
    }
  }, [open]);

  const generateAutoDays = useCallback(() => {
    const total = computedPages;
    setTotalPages(total);
    const dist = distribute(total, totalDays);
    setDays(dist.map((pages, i) => ({ dayNumber: i + 1, pages })));
  }, [computedPages, totalDays]);

  const initManualDays = useCallback(() => {
    setDays(Array.from({ length: totalDays }, (_, i) => ({ dayNumber: i + 1 })));
  }, [totalDays]);

  const goNext = () => {
    if (!isFixation && step === 2) {
      if (wizardMode === "auto") {
        generateAutoDays();
        setDaysInitMode("auto");
      } else if (days.length === 0 || daysInitMode !== "manual") {
        initManualDays();
        setDaysInitMode("manual");
      }
    }
    if (isFixation && step === 1 && days.length === 0) {
      initManualDays();
    }
    setStep(s => s + 1);
  };

  const updateDay = (idx: number, field: keyof DayEntry, value: any) => {
    setDays(prev => prev.map((d, i) => i === idx ? { ...d, [field]: value } : d));
  };

  const canGoNext = (): boolean => {
    if (isFixation) {
      if (step === 2) return startDate >= today;
      return true;
    }
    if (step === 1) {
      if (quotaType === "juz") return selectedJuz.size > 0;
      return computedPages > 0;
    }
    if (step === 4) return startDate >= today;
    return true;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const body: any = {
        circleId, startDate, themeColor, days,
        planMode: isFixation ? "manual" : wizardMode,
      };
      if (isFixation) {
        body.quantity = quantity;
      } else {
        body.quotaType = quotaType;
        if (quotaType === "juz") {
          body.quotaJuz = selectedJuz.size;
        } else {
          const firstRange = surahRanges[0];
          if (firstRange) {
            body.quotaSurahStart = firstRange.surahStart;
            body.quotaAyahStart = firstRange.ayahStart;
            body.quotaSurahEnd = firstRange.surahEnd;
            body.quotaAyahEnd = firstRange.ayahEnd;
          }
          if (surahRanges.length > 1) {
            body.extraRanges = JSON.stringify(surahRanges.slice(1));
          }
        }
        body.totalPages = totalPages || computedPages || undefined;
      }
      const res = await fetch(`${BASE}/api/students/${studentId}/review-plan`, {
        method: "POST", headers: authHeader(), body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      toast({ title: "✓ تم حفظ الخطة!" });
      onSaved();
    } catch (e: any) {
      toast({ title: "خطأ في حفظ الخطة", description: e.message, variant: "destructive" });
    } finally { setSaving(false); }
  };

  // ─── Step labels ──────────────────────────────────────────────────────────
  const stepLabels = isFixation
    ? ["الكمية", "تاريخ البداية", "جدول الأسابيع"]
    : ["النصاب", "نوع الخطة", "الأنصبة", "تاريخ البداية"];

  // ─── Step renderers ───────────────────────────────────────────────────────
  const renderStep = () => {
    if (isFixation) {
      switch (step) {
        case 1:
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">اختاري الكمية اليومية لخطة التثبيت (٦ أسابيع × ٤ أيام)</p>
              <div className="grid grid-cols-2 gap-3">
                {(["full", "half"] as const).map(q => (
                  <button key={q} onClick={() => setQuantity(q)}
                    className={`rounded-xl p-5 border-2 text-center transition-colors ${quantity === q ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <p className="text-2xl font-bold mb-1">{q === "full" ? "1" : "½"}</p>
                    <p className="font-bold text-sm">{q === "full" ? "وجه كامل" : "نصف وجه"}</p>
                    <p className="text-xs text-muted-foreground mt-1">يومياً لكل يوم تثبيت</p>
                  </button>
                ))}
              </div>
            </div>
          );
        case 2:
          return (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">اختاري تاريخ بداية الخطة</p>
                <Label className="text-sm">تاريخ البداية</Label>
                <Input type="date" value={startDate} min={today} onChange={e => setStartDate(e.target.value)} className="mt-1 text-right" />
                {startDate >= today && (
                  <div className="bg-muted/40 rounded-xl p-3 text-sm mt-2">
                    <p className="text-muted-foreground text-xs mb-0.5">التاريخ المختار</p>
                    <p className="font-semibold">{formatArDate(startDate)}</p>
                  </div>
                )}
              </div>
              <ColorPicker themeColor={themeColor} setThemeColor={setThemeColor} />
            </div>
          );
        case 3:
          return (
            <StepFixationWeeks days={days} updateDay={updateDay} quantity={quantity} startDate={startDate} />
          );
      }
    } else {
      switch (step) {
        // Step 1: quota
        case 1:
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                {(["juz", "surah"] as const).map(t => (
                  <button key={t} onClick={() => setQuotaType(t)}
                    className={`rounded-xl p-4 border-2 text-center transition-colors ${quotaType === t ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <p className="font-bold text-sm">{t === "juz" ? "أجزاء" : "سور محددة"}</p>
                    <p className="text-xs text-muted-foreground mt-1">{t === "juz" ? "تحددين الأجزاء المراد مراجعتها" : "تحددين نطاق سور بآياتهن"}</p>
                  </button>
                ))}
              </div>
              {quotaType === "juz" ? (
                <JuzGrid selectedJuz={selectedJuz} onChange={setSelectedJuz} />
              ) : (
                <SurahRangesEditor ranges={surahRanges} onChange={setSurahRanges} />
              )}
            </div>
          );
        // Step 2: auto or manual
        case 2:
          return (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">هل تريدين أن يقسّم الموقع الخطة تلقائياً أم تريدين التقسيم يدوياً؟</p>
              <div className="grid grid-cols-2 gap-3">
                {(["auto", "manual"] as const).map(m => (
                  <button key={m} onClick={() => setWizardMode(m)}
                    className={`rounded-xl p-4 border-2 text-center transition-colors ${wizardMode === m ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                    <p className="text-xl mb-1">{m === "auto" ? "✨" : "✏️"}</p>
                    <p className="font-bold text-sm">{m === "auto" ? "تلقائية" : "يدوية"}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {m === "auto" ? "الموقع يوزّع النصاب على ٢١ يوم" : "أنتِ تحددين لكل يوم نصابه"}
                    </p>
                  </button>
                ))}
              </div>
              {computedPages > 0 && (
                <div className="bg-muted/30 rounded-xl p-3 text-sm text-center">
                  إجمالي النصاب: <span className="font-bold text-primary">{computedPages} صفحة</span>
                  {wizardMode === "auto" && (
                    <span className="text-muted-foreground text-xs block mt-0.5">
                      ≈ {(computedPages / totalDays).toFixed(1)} صفحة / يوم
                    </span>
                  )}
                </div>
              )}
              {daysInitMode !== "none" && daysInitMode !== wizardMode && (
                <p className="text-xs text-amber-600 bg-amber-50 rounded-lg p-2">
                  ⚠️ تغيير النوع سيعيد توزيع الأيام من جديد
                </p>
              )}
            </div>
          );
        // Step 3: day distribution
        case 3:
          return (
            <StepGirlsDays
              days={days}
              updateDay={updateDay}
              isAuto={wizardMode === "auto"}
              totalPages={totalPages || computedPages}
              totalDays={totalDays}
              onRegenerate={() => { generateAutoDays(); setDaysInitMode("auto"); }}
            />
          );
        // Step 4: start date + colour
        case 4:
          return (
            <div className="space-y-5">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">اختاري تاريخ بداية الخطة</p>
                <Label className="text-sm">تاريخ البداية</Label>
                <Input type="date" value={startDate} min={today} onChange={e => setStartDate(e.target.value)} className="mt-1 text-right" />
                {startDate >= today && (
                  <div className="bg-muted/40 rounded-xl p-3 text-sm mt-2">
                    <p className="text-muted-foreground text-xs mb-0.5">التاريخ المختار</p>
                    <p className="font-semibold">{formatArDate(startDate)}</p>
                  </div>
                )}
              </div>
              <ColorPicker themeColor={themeColor} setThemeColor={setThemeColor} />
            </div>
          );
      }
    }
    return null;
  };

  const isLastStep = step === maxSteps;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            إنشاء {planTitle}
          </DialogTitle>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: maxSteps }, (_, i) => (
              <div key={i} className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-primary" : "bg-muted"}`} />
            ))}
          </div>
          <p className="text-xs text-muted-foreground text-right mt-1">
            الخطوة {step} / {maxSteps}: {stepLabels[step - 1]}
          </p>
        </DialogHeader>

        <div className="py-2 min-h-[220px]">{renderStep()}</div>

        <DialogFooter className="flex-row-reverse gap-2 mt-2">
          {step > 1 && (
            <Button variant="outline" onClick={() => setStep(s => s - 1)} disabled={saving}>
              <ChevronRight className="w-4 h-4 ml-1" />السابق
            </Button>
          )}
          {!isLastStep ? (
            <Button onClick={goNext} disabled={!canGoNext()}>
              التالي<ChevronLeft className="w-4 h-4 mr-1" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={saving || !canGoNext()}>
              {saving
                ? <><Loader2 className="w-4 h-4 animate-spin ml-1" />جاري الحفظ...</>
                : "✓ حفظ وإنهاء"}
            </Button>
          )}
          <Button variant="ghost" onClick={onClose} disabled={saving}>إلغاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Girls Days Step ──────────────────────────────────────────────────────────
function StepGirlsDays({ days, updateDay, isAuto, totalPages, totalDays, onRegenerate }: {
  days: DayEntry[]; updateDay: (i: number, f: keyof DayEntry, v: any) => void;
  isAuto: boolean; totalPages: number; totalDays: number; onRegenerate: () => void;
}) {
  const assignedTotal = days.reduce((s, d) => s + (d.pages ?? 0), 0);
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold">
            {isAuto ? "التوزيع التلقائي (قابل للتعديل)" : "إدخال الأنصبة يدوياً"}
          </p>
          {totalPages > 0 && (
            <p className="text-xs text-muted-foreground mt-0.5">
              المُخصص: <span className={`font-bold ${Math.abs(assignedTotal - totalPages) < 0.6 ? "text-emerald-600" : "text-amber-600"}`}>{Math.round(assignedTotal * 2) / 2}</span> / {totalPages} صفحة
            </p>
          )}
        </div>
        {isAuto && (
          <Button variant="outline" size="sm" className="text-xs gap-1" onClick={onRegenerate}>
            <RefreshCw className="w-3.5 h-3.5" />إعادة التوزيع
          </Button>
        )}
      </div>

      {!isAuto && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 text-xs text-amber-700">
          الجدول فارغ — أدخلي السورة والآيات وعدد الصفحات لكل يوم
        </div>
      )}

      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {days.map((day, idx) => (
          <div key={day.dayNumber} className="bg-muted/30 rounded-xl p-2">
            <p className="text-[11px] font-mono text-muted-foreground mb-1.5">يوم {day.dayNumber}</p>
            <div className="grid grid-cols-2 gap-1.5">
              <div>
                <select className="border rounded p-1 text-xs bg-background w-full" value={day.surahStart ?? ""}
                  onChange={e => { updateDay(idx, "surahStart", e.target.value || undefined); updateDay(idx, "ayahStart", undefined); }}>
                  <option value="">— سورة البداية —</option>
                  {SURAH_OPTIONS.map(s => <option key={s.number} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <AyahSelect surahName={day.surahStart} value={day.ayahStart} onChange={v => updateDay(idx, "ayahStart", v)} placeholder="آية البداية" />
              <div>
                <select className="border rounded p-1 text-xs bg-background w-full" value={day.surahEnd ?? ""}
                  onChange={e => { updateDay(idx, "surahEnd", e.target.value || undefined); updateDay(idx, "ayahEnd", undefined); }}>
                  <option value="">— سورة النهاية —</option>
                  {SURAH_OPTIONS.map(s => <option key={s.number} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <AyahSelect surahName={day.surahEnd} value={day.ayahEnd} onChange={v => updateDay(idx, "ayahEnd", v)} placeholder="آية النهاية" />
            </div>
            <input type="number" step="0.5" min="0" placeholder="عدد الصفحات" value={day.pages ?? ""}
              onChange={e => updateDay(idx, "pages", parseFloat(e.target.value) || undefined)}
              className="border rounded p-1 text-xs w-full text-center bg-background mt-1.5" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Fixation Weeks Step ──────────────────────────────────────────────────────
function StepFixationWeeks({ days, updateDay, quantity, startDate }: {
  days: DayEntry[]; updateDay: (i: number, f: keyof DayEntry, v: any) => void;
  quantity: "full" | "half"; startDate: string;
}) {
  const weeks = Array.from({ length: 6 }, (_, w) => ({
    weekNum: w + 1,
    days: days.slice(w * 4, w * 4 + 4),
    startIdx: w * 4,
  }));

  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"];

  const getDate = (dayNumber: number): string => {
    if (!startDate) return "";
    const dates: string[] = [];
    const cur = new Date(startDate + "T12:00:00Z");
    const firstDow = cur.getUTCDay();
    if (firstDow <= 3) dates.push(cur.toISOString().slice(0, 10));
    while (dates.length < 24) {
      cur.setDate(cur.getDate() + 1);
      const dow = cur.getUTCDay();
      if (dow <= 3) dates.push(cur.toISOString().slice(0, 10));
    }
    return dates[dayNumber - 1] ?? "";
  };

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">
        أدخلي السورة والآيات لكل يوم ({quantity === "full" ? "وجه كامل" : "نصف وجه"} / يوم)
      </p>
      <div className="max-h-72 overflow-y-auto space-y-4">
        {weeks.map(({ weekNum, days: wDays, startIdx }) => (
          <div key={weekNum}>
            <p className="text-xs font-bold text-muted-foreground mb-2">الأسبوع {weekNum}</p>
            <div className="space-y-2">
              {wDays.map((day, i) => {
                const globalIdx = startIdx + i;
                const dateStr = getDate(day.dayNumber);
                return (
                  <div key={day.dayNumber} className="bg-muted/30 rounded-xl p-2.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-semibold">{dayNames[i]}</span>
                      {dateStr && <span className="text-[10px] text-muted-foreground">{formatArDate(dateStr)}</span>}
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <select className="border rounded p-1 text-xs bg-background w-full" value={day.surahStart ?? ""}
                          onChange={e => { updateDay(globalIdx, "surahStart", e.target.value || undefined); updateDay(globalIdx, "ayahStart", undefined); }}>
                          <option value="">— سورة البداية —</option>
                          {SURAH_OPTIONS.map(s => <option key={s.number} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <AyahSelect surahName={day.surahStart} value={day.ayahStart} onChange={v => updateDay(globalIdx, "ayahStart", v)} placeholder="آية البداية" />
                      <div>
                        <select className="border rounded p-1 text-xs bg-background w-full" value={day.surahEnd ?? ""}
                          onChange={e => { updateDay(globalIdx, "surahEnd", e.target.value || undefined); updateDay(globalIdx, "ayahEnd", undefined); }}>
                          <option value="">— سورة النهاية —</option>
                          {SURAH_OPTIONS.map(s => <option key={s.number} value={s.value}>{s.label}</option>)}
                        </select>
                      </div>
                      <AyahSelect surahName={day.surahEnd} value={day.ayahEnd} onChange={v => updateDay(globalIdx, "ayahEnd", v)} placeholder="آية النهاية" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
