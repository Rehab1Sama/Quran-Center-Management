import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { schoolConfig } from "@/lib/schoolConfig";
import {
  useGetMissingDataEntry,
  useCreateRecord,
  useGetCurrentUser,
  useListCircles,
  useListTracks,
  useGetRepeatedAbsences,
  useListRecords,
  useCheckTeacherAbsence,
  useMarkTeacherAbsent,
  useDeleteTeacherAbsence,
  useUpdateRecord,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { SURAHS, calculatePages, formatPages } from "@/lib/quran";
import { PenSquare, CheckCircle, AlertCircle, BookOpen, Users, CalendarDays, Search, UserX, Undo2, XCircle, Zap, Clock, CheckCircle2, Mic, TableIcon, LayoutList } from "lucide-react";
import { Input } from "@/components/ui/input";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const getToken = () => localStorage.getItem("sana_auth_token");

function resolveTrackType(dataEntryType?: string | null): "girls" | "girls_near" | "girls_far" | "girls_no_review" | "simple" | "mishkah" | "fixation" {
  if (dataEntryType === "recitation") return "mishkah";
  if (dataEntryType === "simple_review") return "simple";
  if (dataEntryType === "children") return "simple";
  if (dataEntryType === "mothers") return "girls";
  if (dataEntryType === "fixation") return "fixation";
  if (dataEntryType === "girls_near") return "girls_near";
  if (dataEntryType === "girls_far") return "girls_far";
  if (dataEntryType === "girls_no_review") return "girls_no_review";
  return "girls";
}

function isGirlsVariant(trackType: string) {
  return trackType === "girls" || trackType === "girls_near" || trackType === "girls_far" || trackType === "girls_no_review";
}

function hasListenToReciter(trackType: string) {
  return isGirlsVariant(trackType) || trackType === "fixation" || trackType === "mishkah";
}

function getInputFields(dataEntryType?: string | null): string[] {
  const configured = (schoolConfig.defaultTrackTypes as any[]).find(
    t => t.dataEntryType === dataEntryType || t.name === dataEntryType
  );
  if (configured?.inputFields?.length) return configured.inputFields as string[];
  const trackType = resolveTrackType(dataEntryType);
  if (trackType === "girls")          return ["memorize","review_near","review_far","listen"];
  if (trackType === "girls_near")     return ["memorize","review_near","listen"];
  if (trackType === "girls_far")      return ["memorize","review_far","listen"];
  if (trackType === "girls_no_review") return ["memorize","listen"];
  if (trackType === "simple")         return ["memorize","review"];
  if (trackType === "mishkah")        return ["recitation","listen"];
  if (trackType === "fixation")       return ["memorize","repetitions","review","listen"];
  return ["memorize","review_near","review_far","listen"];
}

function getMeccaToday(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// أيام عمل الأسبوع الحالي فقط: من أحد الأسبوع الحالي حتى اليوم، الأحد–الخميس فقط
function getCurrentWeekWorkingDays(): { label: string; value: string }[] {
  const dayNames = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
  const todayStr = getMeccaToday();
  const today = new Date(todayStr + "T12:00:00Z");
  const todayDow = today.getUTCDay();

  // إيجاد أحد الأسبوع الحالي
  // إذا كان اليوم جمعة(5) أو سبت(6) نرجع للأحد السابق
  let daysBackToSunday: number;
  if (todayDow === 5) daysBackToSunday = 5;
  else if (todayDow === 6) daysBackToSunday = 6;
  else daysBackToSunday = todayDow; // الأحد=0 ... الخميس=4

  const weekSunday = new Date(today.getTime() - daysBackToSunday * 86400000);

  const result: { label: string; value: string }[] = [];
  for (let i = 0; i <= daysBackToSunday; i++) {
    const d = new Date(weekSunday.getTime() + i * 86400000);
    const dow = d.getUTCDay();
    if (dow <= 4) { // الأحد(0) إلى الخميس(4) فقط
      const value = d.toISOString().slice(0, 10);
      const label = value === todayStr
        ? `اليوم (${dayNames[dow]})`
        : dayNames[dow];
      result.push({ label, value });
    }
  }
  // اليوم أولًا
  return result.reverse();
}

function SurahSelect({ value, onChange, testId }: {
  value: string; onChange: (v: string) => void; testId?: string;
}) {
  return (
    <select
      className="w-full border border-input rounded-md px-2 py-1.5 text-sm bg-background text-right"
      value={value}
      onChange={e => onChange(e.target.value)}
      data-testid={testId}
    >
      <option value="">اختر السورة</option>
      {SURAHS.map(s => (
        <option key={s.number} value={s.name}>{s.number}. {s.name}</option>
      ))}
    </select>
  );
}

function AyahSelect({ surahName, value, onChange, testId }: {
  surahName: string; value: string; onChange: (v: string) => void; testId?: string;
}) {
  const surah = SURAHS.find(s => s.name === surahName);
  const maxAyah = surah?.ayahs ?? 1;
  return (
    <select
      className="w-full border border-input rounded-md px-2 py-1.5 text-sm bg-background text-right"
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={!surahName}
      data-testid={testId}
    >
      <option value="">آية</option>
      {Array.from({ length: maxAyah }, (_, i) => i + 1).map(n => (
        <option key={n} value={n.toString()}>{n}</option>
      ))}
    </select>
  );
}

interface SectionState {
  surahStart: string;
  ayahStart: string;
  surahEnd: string;
  ayahEnd: string;
}

const emptySection = (): SectionState => ({ surahStart: "", ayahStart: "", surahEnd: "", ayahEnd: "" });

// ---- Voice Input helpers ----
function parseVoiceInput(
  text: string,
  onResult: (surahStart: string, ayahStart: string, surahEnd: string, ayahEnd: string) => void
) {
  const surah = SURAHS.find(s => text.includes(s.name));
  if (!surah) return;
  const normalized = text.replace(/[٠-٩]/g, (d: string) => String(d.charCodeAt(0) - 0x0660));
  const numbers = normalized.match(/\d+/g)?.map(Number) ?? [];
  if (numbers.length >= 2) {
    onResult(surah.name, String(numbers[0]), surah.name, String(numbers[1]));
  } else if (numbers.length === 1) {
    onResult(surah.name, String(numbers[0]), surah.name, String(numbers[0]));
  } else {
    onResult(surah.name, "1", surah.name, "1");
  }
}

function VoiceInputButton({
  onResult,
}: {
  onResult: (surahStart: string, ayahStart: string, surahEnd: string, ayahEnd: string) => void;
}) {
  const [isListening, setIsListening] = useState(false);
  const startListening = () => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { alert("متصفحك لا يدعم التعرف على الصوت. استخدمي Chrome أو Safari."); return; }
    const recognition = new SR();
    recognition.lang = "ar-SA";
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    recognition.onerror = () => setIsListening(false);
    recognition.onresult = (event: any) => {
      const text = event.results[0][0].transcript;
      parseVoiceInput(text, onResult);
    };
    recognition.start();
  };
  return (
    <button
      type="button"
      onClick={startListening}
      title={isListening ? "جاري الاستماع..." : "إدخال صوتي (مثال: البقرة 10 إلى 20)"}
      className={`p-1.5 rounded-lg transition-colors border ${
        isListening
          ? "bg-rose-100 border-rose-300 text-rose-600 animate-pulse"
          : "bg-muted/40 border-border text-muted-foreground hover:bg-muted hover:text-foreground"
      }`}
    >
      <Mic className="w-3.5 h-3.5" />
    </button>
  );
}

// ---- Bulk Entry Table ----
function BulkEntryTable({
  students,
  inputFields,
  bulkData,
  onChange,
  onSave,
  isSaving,
}: {
  students: any[];
  inputFields: string[];
  bulkData: Record<number, { absent: boolean; memorizePages: string; reviewNearPages: string; reviewFarPages: string; reviewPages: string; listenedToReciter: boolean | null }>;
  onChange: (studentId: number, field: string, value: any) => void;
  onSave: () => void;
  isSaving: boolean;
}) {
  const hasMemorize = inputFields.includes("memorize");
  const hasNear = inputFields.includes("review_near");
  const hasFar = inputFields.includes("review_far");
  const hasReview = inputFields.includes("review");
  const hasListen = inputFields.includes("listen");

  return (
    <div className="space-y-3" dir="rtl">
      <div className="overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b border-border">
              <th className="px-3 py-2 text-right font-semibold text-xs text-muted-foreground">الطالبة</th>
              <th className="px-2 py-2 text-center font-semibold text-xs text-rose-600">غائبة</th>
              {hasMemorize && <th className="px-2 py-2 text-center font-semibold text-xs text-teal-700">حفظ (ص)</th>}
              {(hasNear || hasReview) && <th className="px-2 py-2 text-center font-semibold text-xs text-blue-700">مراجعة قريبة (ص)</th>}
              {hasFar && <th className="px-2 py-2 text-center font-semibold text-xs text-sky-700">مراجعة بعيدة (ص)</th>}
              {hasListen && <th className="px-2 py-2 text-center font-semibold text-xs text-purple-700">سمعت</th>}
            </tr>
          </thead>
          <tbody>
            {students.map((student: any, idx: number) => {
              const d = bulkData[student.studentId] ?? { absent: false, memorizePages: "", reviewNearPages: "", reviewFarPages: "", reviewPages: "", listenedToReciter: null };
              return (
                <tr key={student.studentId} className={`border-b border-border/50 transition-colors ${d.absent ? "bg-rose-50/70" : idx % 2 === 0 ? "bg-background" : "bg-muted/15"}`}>
                  <td className="px-3 py-2 font-medium text-sm max-w-[130px]">
                    <div className="truncate">{student.studentName}</div>
                  </td>
                  <td className="px-2 py-2 text-center">
                    <input type="checkbox" checked={d.absent} onChange={e => onChange(student.studentId, "absent", e.target.checked)} className="w-4 h-4 accent-rose-500" />
                  </td>
                  {hasMemorize && (
                    <td className="px-2 py-2 text-center">
                      <input type="number" min="0" max="20" step="0.5" value={d.memorizePages} onChange={e => onChange(student.studentId, "memorizePages", e.target.value)} disabled={d.absent} className="w-14 border border-input rounded px-1.5 py-1 text-center text-xs bg-background disabled:opacity-40" placeholder="0" />
                    </td>
                  )}
                  {(hasNear || hasReview) && (
                    <td className="px-2 py-2 text-center">
                      <input type="number" min="0" max="20" step="0.5" value={d.reviewNearPages} onChange={e => onChange(student.studentId, "reviewNearPages", e.target.value)} disabled={d.absent} className="w-14 border border-input rounded px-1.5 py-1 text-center text-xs bg-background disabled:opacity-40" placeholder="0" />
                    </td>
                  )}
                  {hasFar && (
                    <td className="px-2 py-2 text-center">
                      <input type="number" min="0" max="20" step="0.5" value={d.reviewFarPages} onChange={e => onChange(student.studentId, "reviewFarPages", e.target.value)} disabled={d.absent} className="w-14 border border-input rounded px-1.5 py-1 text-center text-xs bg-background disabled:opacity-40" placeholder="0" />
                    </td>
                  )}
                  {hasListen && (
                    <td className="px-2 py-2 text-center">
                      <input type="checkbox" checked={d.listenedToReciter === true} onChange={e => onChange(student.studentId, "listenedToReciter", e.target.checked ? true : null)} disabled={d.absent} className="w-4 h-4 accent-purple-500 disabled:opacity-40" />
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-muted-foreground text-center">
        أدخلي عدد الصفحات فقط — الحقول الفارغة تُحفظ كـ 0
      </p>
      <Button
        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
        onClick={onSave}
        disabled={isSaving || students.length === 0}
      >
        <CheckCircle2 className="w-4 h-4" />
        {isSaving ? "جاري الحفظ..." : `حفظ الحلقة كاملة (${students.length} طالبة)`}
      </Button>
    </div>
  );
}

/** Returns the surah/ayah that comes right after the given position */
function nextPosition(surahName: string, ayah: number): { surah: string; ayah: string } {
  const surahIndex = SURAHS.findIndex(s => s.name === surahName);
  if (surahIndex === -1) return { surah: surahName, ayah: String(ayah + 1) };
  const currentSurah = SURAHS[surahIndex];
  if (ayah >= currentSurah.ayahs) {
    const nextSurah = SURAHS[surahIndex + 1];
    if (nextSurah) return { surah: nextSurah.name, ayah: "1" };
    return { surah: surahName, ayah: String(ayah) };
  }
  return { surah: surahName, ayah: String(ayah + 1) };
}

interface FormState {
  isAbsent: boolean;
  memorize: SectionState;
  reviewNear: SectionState;
  reviewFar: SectionState;
  review: SectionState;
  recitation: SectionState;
  repetitions: string;
  listenedToReciter: boolean | null;
  noReviewNear: boolean;
  noReviewFar: boolean;
  noReview: boolean;
}

function calcSectionPages(s: SectionState) {
  return calculatePages(s.surahStart, Number(s.ayahStart), s.surahEnd, Number(s.ayahEnd));
}

function SurahSection({
  title, color, section, onChange, showPages, autoSuggested, locked, onToggleLock, onVoiceFill,
}: {
  title: string; color: string; section: SectionState;
  onChange: (field: keyof SectionState, val: string) => void;
  showPages?: boolean;
  autoSuggested?: boolean;
  locked?: boolean;
  onToggleLock?: () => void;
  onVoiceFill?: (surahStart: string, ayahStart: string, surahEnd: string, ayahEnd: string) => void;
}) {
  const pages = calcSectionPages(section);
  return (
    <div className={`border rounded-xl p-4 space-y-3 ${locked ? "border-amber-300 bg-amber-50/60 opacity-80" : color}`}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold text-sm flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          {title}
          {autoSuggested && !locked && (
            <span className="text-[10px] font-normal bg-white/60 text-muted-foreground px-1.5 py-0.5 rounded-full border border-border/40">
              مقترح ✦
            </span>
          )}
          {locked && (
            <span className="text-[10px] font-semibold bg-amber-200 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1">
              <XCircle className="w-3 h-3" /> لم تراجع
            </span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {pages > 0 && !locked && (
            <Badge className="bg-white/70 text-foreground border-0 text-xs font-bold">
              {formatPages(pages)} وجه
            </Badge>
          )}
          {onVoiceFill && !locked && (
            <VoiceInputButton onResult={onVoiceFill} />
          )}
          {onToggleLock && (
            <button
              type="button"
              onClick={onToggleLock}
              className={`text-xs font-semibold px-2.5 py-1 rounded-lg border transition-colors ${
                locked
                  ? "bg-white border-amber-300 text-amber-700 hover:bg-amber-50"
                  : "bg-amber-100 border-amber-200 text-amber-800 hover:bg-amber-200"
              }`}
            >
              {locked ? "إلغاء" : "لم تراجع"}
            </button>
          )}
        </div>
      </div>
      {!locked && (
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">من سورة</Label>
            <SurahSelect
              value={section.surahStart}
              onChange={v => onChange("surahStart", v)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">آية البداية</Label>
            <AyahSelect
              surahName={section.surahStart}
              value={section.ayahStart}
              onChange={v => onChange("ayahStart", v)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">إلى سورة</Label>
            <SurahSelect
              value={section.surahEnd}
              onChange={v => onChange("surahEnd", v)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">آية النهاية</Label>
            <AyahSelect
              surahName={section.surahEnd}
              value={section.ayahEnd}
              onChange={v => onChange("ayahEnd", v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

const emptyForm = (): FormState => ({
  isAbsent: false,
  memorize: emptySection(),
  reviewNear: emptySection(),
  reviewFar: emptySection(),
  review: emptySection(),
  recitation: emptySection(),
  repetitions: "7",
  listenedToReciter: null,
  noReviewNear: false,
  noReviewFar: false,
  noReview: false,
});

function useDataEntryHeartbeat(isDataEntry: boolean) {
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isDataEntry) return;

    const sendHeartbeat = () => {
      const token = getToken();
      if (!token) return;
      fetch(`${BASE}/api/data-entry/session/heartbeat`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    };

    sendHeartbeat();
    timerRef.current = setInterval(sendHeartbeat, 2 * 60 * 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isDataEntry]);
}

function useDataEntryMyStats(isDataEntry: boolean) {
  const [stats, setStats] = useState<any>(null);

  const fetchStats = useCallback(() => {
    if (!isDataEntry) return;
    const token = getToken();
    if (!token) return;
    fetch(`${BASE}/api/data-entry/my-stats`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : null)
      .then(setStats)
      .catch(() => {});
  }, [isDataEntry]);

  useEffect(() => {
    fetchStats();
    const t = setInterval(fetchStats, 3 * 60 * 1000);
    return () => clearInterval(t);
  }, [fetchStats]);

  return stats;
}

export default function DataEntryPage() {
  const { data: user } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });
  const isDataEntry = (user as any)?.role === "data_entry";
  const [selectedDate, setSelectedDate] = useState(() => getCurrentWeekWorkingDays()[0].value);
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [selectedCircleId, setSelectedCircleId] = useState<number | null>(null);
  const { data: tracks } = useListTracks({ query: { queryKey: ["tracks"] } });
  const [studentSearch, setStudentSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [confirmAbsenceOpen, setConfirmAbsenceOpen] = useState(false);
  const [autoFilled, setAutoFilled] = useState(false);
  const [thursdayDialogOpen, setThursdayDialogOpen] = useState(false);
  const [thursdayLoading, setThursdayLoading] = useState(false);
  const [editingRecordId, setEditingRecordId] = useState<number | null>(null);
  const [submittedDays, setSubmittedDays] = useState<string[]>([]);
  const [bulkMode, setBulkMode] = useState(false);
  const [bulkData, setBulkData] = useState<Record<number, { absent: boolean; memorizePages: string; reviewNearPages: string; reviewFarPages: string; reviewPages: string; listenedToReciter: boolean | null }>>({});
  const [isBulkSaving, setIsBulkSaving] = useState(false);

  useDataEntryHeartbeat(isDataEntry);
  const myStats = useDataEntryMyStats(isDataEntry);

  const { data: circles } = useListCircles(undefined, {
    query: { queryKey: ["circles"] }
  });

  // حلقات مدخلة البيانات المُسندة لها (بدلاً من جميع الحلقات)
  const [assignedCircles, setAssignedCircles] = useState<any[]>([]);
  useEffect(() => {
    if (!isDataEntry) return;
    const token = getToken();
    if (!token) return;
    fetch(`${BASE}/api/data-entry/my-circles`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : [])
      .then(setAssignedCircles)
      .catch(() => {});
  }, [isDataEntry]);

  // Auto-select user's assigned track on load
  useEffect(() => {
    if ((user as any)?.track && !selectedTrack) {
      setSelectedTrack((user as any).track);
    }
  }, [(user as any)?.track]);

  // Fetch submitted days for selected circle (to hide from dropdown)
  useEffect(() => {
    if (!selectedCircleId) { setSubmittedDays([]); return; }
    const headers = { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` };
    fetch(`${BASE}/api/data-entry/circle-submitted-days?circleId=${selectedCircleId}`, { headers })
      .then(r => r.ok ? r.json() : [])
      .then((days: string[]) => {
        setSubmittedDays(days);
        // If selected date is now submitted, pick first available day
        setSelectedDate(prev => {
          if (days.includes(prev)) {
            const allDays = getCurrentWeekWorkingDays().map(d => d.value);
            return allDays.find(d => !days.includes(d)) ?? prev;
          }
          return prev;
        });
      })
      .catch(() => setSubmittedDays([]));
  }, [selectedCircleId]);

  // مدخلة البيانات ترى فقط الحلقات المُسندة لها، بينما القائدة ترى الكل مع فلتر المسار
  const filteredCirclesForEntry = isDataEntry
    ? assignedCircles
    : (circles ?? []).filter((c: any) => !selectedTrack || c.track === selectedTrack);

  const { data: repeatedAbsences } = useGetRepeatedAbsences(
    { minAbsences: 2 },
    { query: { queryKey: ["repeatedAbsencesEntry"] } }
  );

  const { data: missingData } = useGetMissingDataEntry(
    { date: selectedDate },
    { query: { queryKey: ["missingData", selectedDate] } }
  );

  // Fetch last record for selected student to suggest start positions
  const { data: studentRecords } = useListRecords(
    selectedStudent ? { studentId: selectedStudent.studentId } : undefined,
    { query: { queryKey: ["studentRecords", selectedStudent?.studentId], enabled: !!selectedStudent && dialogOpen } }
  );

  // Fetch review plan for selected student to suggest far review range
  const [reviewPlanToday, setReviewPlanToday] = useState<{ surahStart?: number; ayahStart?: number; surahEnd?: number; ayahEnd?: number; pages?: number } | null>(null);
  useEffect(() => {
    if (!selectedStudent || !dialogOpen) { setReviewPlanToday(null); return; }
    const token = getToken();
    fetch(`${BASE}/api/students/${selectedStudent.studentId}/review-plan`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then((data: any) => {
        if (data?.todayEntry?.surahStart && data?.todayEntry?.surahEnd) {
          setReviewPlanToday(data.todayEntry);
        } else {
          setReviewPlanToday(null);
        }
      })
      .catch(() => setReviewPlanToday(null));
  }, [selectedStudent?.studentId, dialogOpen]);

  // Fetch all records for selected circle+date (for "entered today" section)
  const { data: circleRecordsRaw } = useListRecords(
    selectedCircleId ? { circleId: selectedCircleId, date: selectedDate } : undefined,
    { query: { queryKey: ["circleRecords", selectedCircleId, selectedDate], enabled: !!selectedCircleId } }
  );
  const circleRecordsData: any[] = (circleRecordsRaw as any) ?? [];

  // Auto-fill start surah/ayah from last non-absent record
  useEffect(() => {
    if (!dialogOpen || !studentRecords || autoFilled) return;
    const sorted = [...studentRecords].sort((a: any, b: any) => b.date.localeCompare(a.date));
    const last = sorted.find((r: any) => !r.isAbsent);
    if (!last) return;
    const updates: Partial<FormState> = {};
    if ((last as any).memorizeSurahEnd && (last as any).memorizeAyahEnd) {
      const next = nextPosition((last as any).memorizeSurahEnd, (last as any).memorizeAyahEnd);
      updates.memorize = { ...emptySection(), surahStart: next.surah, ayahStart: next.ayah };
    }
    // مراجعة قريبة: نفس النطاق الذي أُدخل بالأمس (ذاكرة ذكية)
    if ((last as any).reviewNearSurahStart && (last as any).reviewNearSurahEnd) {
      updates.reviewNear = {
        surahStart: (last as any).reviewNearSurahStart,
        ayahStart: (last as any).reviewNearAyahStart?.toString() ?? "1",
        surahEnd: (last as any).reviewNearSurahEnd,
        ayahEnd: (last as any).reviewNearAyahEnd?.toString() ?? "1",
      };
    }
    // مراجعة بعيدة: نفس النطاق الذي أُدخل بالأمس
    if ((last as any).reviewFarSurahStart && (last as any).reviewFarSurahEnd) {
      updates.reviewFar = {
        surahStart: (last as any).reviewFarSurahStart,
        ayahStart: (last as any).reviewFarAyahStart?.toString() ?? "1",
        surahEnd: (last as any).reviewFarSurahEnd,
        ayahEnd: (last as any).reviewFarAyahEnd?.toString() ?? "1",
      };
    }
    if ((last as any).reviewSurahStart && (last as any).reviewSurahEnd) {
      updates.review = {
        surahStart: (last as any).reviewSurahStart,
        ayahStart: (last as any).reviewAyahStart?.toString() ?? "1",
        surahEnd: (last as any).reviewSurahEnd,
        ayahEnd: (last as any).reviewAyahEnd?.toString() ?? "1",
      };
    }
    if ((last as any).recitationSurahEnd && (last as any).recitationAyahEnd) {
      const next = nextPosition((last as any).recitationSurahEnd, (last as any).recitationAyahEnd);
      updates.recitation = { ...emptySection(), surahStart: next.surah, ayahStart: next.ayah };
    }
    if (Object.keys(updates).length > 0) {
      setForm(f => ({ ...f, ...updates }));
      setAutoFilled(true);
    }
  }, [studentRecords, dialogOpen, autoFilled]);

  const queryClient = useQueryClient();
  const createRecord = useCreateRecord();
  const updateRecord = useUpdateRecord();
  const { toast } = useToast();

  const { data: teacherAbsenceStatus, refetch: refetchTeacherAbsence } = useCheckTeacherAbsence(
    selectedCircleId ?? 0,
    { date: selectedDate },
    { query: { queryKey: ["teacherAbsence", selectedCircleId, selectedDate], enabled: !!selectedCircleId } }
  );
  const markTeacherAbsent = useMarkTeacherAbsent();
  const deleteTeacherAbsence = useDeleteTeacherAbsence();

  const isTeacherAbsent = !!teacherAbsenceStatus?.absent;

  const handleMarkTeacherAbsent = () => {
    if (!selectedCircleId) return;
    if (!confirm(`هل تريدين تسجيل غياب المعلمة لهذه الحلقة يوم ${selectedDate}؟\nسيتم تعطيل إدخال البيانات لهذا اليوم.`)) return;
    markTeacherAbsent.mutate(
      { id: selectedCircleId, data: { date: selectedDate } },
      {
        onSuccess: () => {
          toast({ title: "تم تسجيل غياب المعلمة" });
          refetchTeacherAbsence();
        },
        onError: () => toast({ title: "خطأ في التسجيل", variant: "destructive" }),
      }
    );
  };

  const handleUndoTeacherAbsence = () => {
    if (!selectedCircleId) return;
    deleteTeacherAbsence.mutate(
      { id: selectedCircleId, params: { date: selectedDate } },
      {
        onSuccess: () => {
          toast({ title: "تم إلغاء غياب المعلمة" });
          refetchTeacherAbsence();
        },
        onError: () => toast({ title: "خطأ في الإلغاء", variant: "destructive" }),
      }
    );
  };

  const studentsInCircle = useMemo(() => {
    if (!selectedCircleId || !missingData) return [];
    return ((missingData as unknown) as any[]).filter((s: any) => s.circleId === selectedCircleId);
  }, [missingData, selectedCircleId]);

  const filteredStudents = useMemo(() => {
    if (!studentSearch.trim()) return studentsInCircle;
    return studentsInCircle.filter((s: any) => s.studentName?.includes(studentSearch));
  }, [studentsInCircle, studentSearch]);

  const openEntry = (student: any) => {
    setSelectedStudent(student);
    setEditingRecordId(null);
    setForm(emptyForm());
    setAutoFilled(false);
    setDialogOpen(true);
  };

  const formFromRecord = (record: any): FormState => ({
    isAbsent: record.isAbsent ?? false,
    memorize: {
      surahStart: record.memorizeSurahStart ?? "",
      ayahStart: record.memorizeAyahStart?.toString() ?? "",
      surahEnd: record.memorizeSurahEnd ?? "",
      ayahEnd: record.memorizeAyahEnd?.toString() ?? "",
    },
    reviewNear: {
      surahStart: record.reviewNearSurahStart ?? "",
      ayahStart: record.reviewNearAyahStart?.toString() ?? "",
      surahEnd: record.reviewNearSurahEnd ?? "",
      ayahEnd: record.reviewNearAyahEnd?.toString() ?? "",
    },
    reviewFar: {
      surahStart: record.reviewFarSurahStart ?? "",
      ayahStart: record.reviewFarAyahStart?.toString() ?? "",
      surahEnd: record.reviewFarSurahEnd ?? "",
      ayahEnd: record.reviewFarAyahEnd?.toString() ?? "",
    },
    review: {
      surahStart: record.reviewSurahStart ?? "",
      ayahStart: record.reviewAyahStart?.toString() ?? "",
      surahEnd: record.reviewSurahEnd ?? "",
      ayahEnd: record.reviewAyahEnd?.toString() ?? "",
    },
    recitation: {
      surahStart: record.recitationSurahStart ?? "",
      ayahStart: record.recitationAyahStart?.toString() ?? "",
      surahEnd: record.recitationSurahEnd ?? "",
      ayahEnd: record.recitationAyahEnd?.toString() ?? "",
    },
    repetitions: record.repetitions?.toString() ?? "7",
    listenedToReciter: record.listenedToReciter ?? null,
    noReviewNear: !record.reviewNearSurahStart,
    noReviewFar: !record.reviewFarSurahStart,
    noReview: !record.reviewSurahStart,
  });

  const openEditRecord = (record: any) => {
    setSelectedStudent({
      studentId: record.studentId,
      studentName: record.studentName ?? `طالبة #${record.studentId}`,
      circleId: record.circleId,
      track: selectedCircle?.track ?? "",
    });
    setEditingRecordId(record.id);
    setForm(formFromRecord(record));
    setAutoFilled(true);
    setDialogOpen(true);
  };

  const updateSection = (section: keyof FormState, field: keyof SectionState, val: string) => {
    setForm(f => ({
      ...f,
      [section]: { ...(f[section] as SectionState), [field]: val },
    }));
  };

  const handleSave = () => {
    const inputFields = getInputFields(selectedCircle?.dataEntryType);
    const payload: any = {
      studentId: selectedStudent.studentId,
      circleId: selectedStudent.circleId,
      date: selectedDate,
      isAbsent: form.isAbsent,
      memorizePages: 0,
      reviewNearPages: 0,
      reviewFarPages: 0,
      reviewPages: 0,
      recitationPages: 0,
    };

    if (!form.isAbsent) {
      if (inputFields.includes("memorize") && form.memorize.surahStart && form.memorize.surahEnd) {
        payload.memorizeSurahStart = form.memorize.surahStart;
        payload.memorizeAyahStart = Number(form.memorize.ayahStart) || 1;
        payload.memorizeSurahEnd = form.memorize.surahEnd;
        payload.memorizeAyahEnd = Number(form.memorize.ayahEnd) || 1;
        payload.memorizePages = calcSectionPages(form.memorize);
      }
      if (inputFields.includes("review_near") && form.reviewNear.surahStart && form.reviewNear.surahEnd) {
        payload.reviewNearSurahStart = form.reviewNear.surahStart;
        payload.reviewNearAyahStart = Number(form.reviewNear.ayahStart) || 1;
        payload.reviewNearSurahEnd = form.reviewNear.surahEnd;
        payload.reviewNearAyahEnd = Number(form.reviewNear.ayahEnd) || 1;
        payload.reviewNearPages = calcSectionPages(form.reviewNear);
      }
      if (inputFields.includes("review_far") && form.reviewFar.surahStart && form.reviewFar.surahEnd) {
        payload.reviewFarSurahStart = form.reviewFar.surahStart;
        payload.reviewFarAyahStart = Number(form.reviewFar.ayahStart) || 1;
        payload.reviewFarSurahEnd = form.reviewFar.surahEnd;
        payload.reviewFarAyahEnd = Number(form.reviewFar.ayahEnd) || 1;
        payload.reviewFarPages = calcSectionPages(form.reviewFar);
      }
      if (inputFields.includes("review") && form.review.surahStart && form.review.surahEnd) {
        payload.reviewSurahStart = form.review.surahStart;
        payload.reviewAyahStart = Number(form.review.ayahStart) || 1;
        payload.reviewSurahEnd = form.review.surahEnd;
        payload.reviewAyahEnd = Number(form.review.ayahEnd) || 1;
        payload.reviewPages = calcSectionPages(form.review);
      }
      if (inputFields.includes("recitation") && form.recitation.surahStart && form.recitation.surahEnd) {
        payload.recitationSurahStart = form.recitation.surahStart;
        payload.recitationAyahStart = Number(form.recitation.ayahStart) || 1;
        payload.recitationSurahEnd = form.recitation.surahEnd;
        payload.recitationAyahEnd = Number(form.recitation.ayahEnd) || 1;
        payload.recitationPages = calcSectionPages(form.recitation);
      }
      if (inputFields.includes("repetitions")) {
        payload.repetitions = Number(form.repetitions) || null;
      }
      if (inputFields.includes("listen")) {
        payload.listenedToReciter = form.listenedToReciter;
      }
    }

    if (editingRecordId) {
      updateRecord.mutate(
        { id: editingRecordId, data: payload },
        {
          onSuccess: () => {
            toast({ title: "تم تحديث البيانات بنجاح ✓" });
            queryClient.invalidateQueries({ queryKey: ["missingData", selectedDate] });
            queryClient.invalidateQueries({ queryKey: ["circleRecords", selectedCircleId, selectedDate] });
            setDialogOpen(false);
            setEditingRecordId(null);
          },
          onError: (err: any) => {
            toast({ title: "خطأ في التحديث", description: err?.data?.error ?? err?.message, variant: "destructive" });
          },
        }
      );
    } else {
      createRecord.mutate(
        { data: payload },
        {
          onSuccess: () => {
            toast({ title: "تم حفظ البيانات بنجاح ✓" });
            queryClient.invalidateQueries({ queryKey: ["missingData", selectedDate] });
            queryClient.invalidateQueries({ queryKey: ["circleRecords", selectedCircleId, selectedDate] });
            setDialogOpen(false);
          },
          onError: (err: any) => {
            toast({ title: "خطأ في الحفظ", description: err?.data?.error ?? err?.message, variant: "destructive" });
          },
        }
      );
    }
  };

  // ---- إدخال دفعي سريع ----
  const initBulkData = () => {
    const init: typeof bulkData = {};
    studentsInCircle.forEach((s: any) => {
      init[s.studentId] = { absent: false, memorizePages: "", reviewNearPages: "", reviewFarPages: "", reviewPages: "", listenedToReciter: null };
    });
    setBulkData(init);
  };

  const handleBulkChange = (studentId: number, field: string, value: any) => {
    setBulkData(prev => ({
      ...prev,
      [studentId]: { ...( prev[studentId] ?? { absent: false, memorizePages: "", reviewNearPages: "", reviewFarPages: "", reviewPages: "", listenedToReciter: null }), [field]: value },
    }));
  };

  const handleBulkSave = async () => {
    if (!selectedCircleId) return;
    setIsBulkSaving(true);
    const token = getToken();
    const inputFields = getInputFields(selectedCircle?.dataEntryType);
    const hasNear = inputFields.includes("review_near");
    const hasFar = inputFields.includes("review_far");
    const hasReview = inputFields.includes("review");
    const hasListen = inputFields.includes("listen");
    let successCount = 0;
    let errorCount = 0;

    for (const student of studentsInCircle) {
      const d = bulkData[student.studentId] ?? { absent: false, memorizePages: "", reviewNearPages: "", reviewFarPages: "", reviewPages: "", listenedToReciter: null };
      const payload: any = {
        studentId: student.studentId,
        circleId: student.circleId,
        date: selectedDate,
        isAbsent: d.absent,
        memorizePages: d.absent ? 0 : parseFloat(d.memorizePages) || 0,
        reviewNearPages: d.absent || !hasNear ? 0 : parseFloat(d.reviewNearPages) || 0,
        reviewFarPages: d.absent || !hasFar ? 0 : parseFloat(d.reviewFarPages) || 0,
        reviewPages: d.absent || !hasReview ? 0 : parseFloat(d.reviewPages) || 0,
        recitationPages: 0,
      };
      if (!d.absent && hasListen && d.listenedToReciter !== null) {
        payload.listenedToReciter = d.listenedToReciter;
      }
      try {
        const res = await fetch(`${BASE}/api/records`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
        if (res.ok) successCount++; else errorCount++;
      } catch { errorCount++; }
    }

    queryClient.invalidateQueries({ queryKey: ["missingData", selectedDate] });
    queryClient.invalidateQueries({ queryKey: ["circleRecords", selectedCircleId, selectedDate] });
    setIsBulkSaving(false);
    setBulkMode(false);
    setBulkData({});
    toast({
      title: `تم حفظ ${successCount} طالبة بنجاح ✓`,
      description: errorCount > 0 ? `${errorCount} طالبة لم تُحفظ` : undefined,
      variant: errorCount > 0 ? "destructive" : "default",
    });
  };

  // إدخال الخميس تلقائيًا للقائدة
  const handleThursdayBulk = async () => {
    setThursdayLoading(true);
    try {
      const res = await fetch("/api/records/thursday-bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: selectedDate }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "حدث خطأ");
      toast({
        title: "تم إدخال بيانات الخميس",
        description: `تم إدخال ${data.created} طالبة · تخطي ${data.skipped}`,
      });
      setThursdayDialogOpen(false);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setThursdayLoading(false);
    }
  };

  const selectedCircle = circles?.find((c: any) => c.id === selectedCircleId);
  const trackType = resolveTrackType(selectedCircle?.dataEntryType);
  const inputFields = getInputFields(selectedCircle?.dataEntryType);

  // أيام العمل لإدخال البيانات: أحد–خميس دائمًا (الجمعة والسبت مستثنيان)
  // إذا كانت الحلقة محددة، تُخفى الأيام التي أُدخلت بياناتها بالفعل
  const days = useMemo(() => {
    const all = getCurrentWeekWorkingDays();
    if (!selectedCircleId || submittedDays.length === 0) return all;
    return all.filter(d => !submittedDays.includes(d.value));
  }, [submittedDays, selectedCircleId]);

  // هل اليوم المختار خميس؟
  const isThursdaySelected = new Date(selectedDate + "T12:00:00Z").getUTCDay() === 4;

  const memPages = calcSectionPages(form.memorize);
  const revNearPages = calcSectionPages(form.reviewNear);
  const revFarPages = calcSectionPages(form.reviewFar);
  const revPages = calcSectionPages(form.review);
  const recPages = calcSectionPages(form.recitation);

  // المعدل اليومي الاعتيادي للحفظ من آخر 10 سجلات بها حفظ
  const avgMemorize = useMemo(() => {
    if (!studentRecords) return null;
    const withMemo = [...(studentRecords as any[])]
      .filter(r => !r.isAbsent && (r.memorizePages ?? 0) > 0)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 10);
    if (withMemo.length < 3) return null;
    const avg = withMemo.reduce((s, r) => s + (r.memorizePages ?? 0), 0) / withMemo.length;
    return Math.round(avg * 2) / 2;
  }, [studentRecords]);

  // عتبة التحذير: 1.5× المعدل أو 2 وجه (صفحة كاملة) للطالبة الجديدة
  const memorizeWarning = memPages > 0 && (
    avgMemorize !== null ? memPages > avgMemorize * 1.5 : memPages > 2
  );

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">إدخال البيانات</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.track && `مسار ${user.track} · `}اختر اليوم والحلقة لإدخال بيانات الطالبات
        </p>
      </div>

      {/* لوحة إحصائيات مدخلة البيانات اليومية */}
      {isDataEntry && myStats && (
        <Card className="border-0 shadow-sm bg-gradient-to-l from-blue-50 to-indigo-50">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-indigo-800">
              <Clock className="w-4 h-4" />
              نشاطي اليوم
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <div className="bg-white rounded-xl p-2.5 text-center shadow-sm">
                <p className="text-lg font-bold text-indigo-700">{myStats.assignedCircles?.length ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">حلقة مُسندة</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 text-center shadow-sm">
                <p className="text-lg font-bold text-emerald-600">{myStats.enteredToday?.length ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">أُدخلت</p>
              </div>
              <div className="bg-white rounded-xl p-2.5 text-center shadow-sm">
                <p className="text-lg font-bold text-amber-600">{myStats.notEnteredToday?.length ?? 0}</p>
                <p className="text-[10px] text-muted-foreground">لم تُدخَل</p>
              </div>
            </div>
            {myStats.assignedCircles && myStats.assignedCircles.length > 0 && (
              <div className="space-y-1">
                {myStats.assignedCircles.map((c: any) => (
                  <div key={c.circleId} className="flex items-center gap-2 text-xs">
                    {c.entered ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    ) : c.teacherAbsent ? (
                      <span className="w-3.5 h-3.5 text-orange-400 shrink-0 flex items-center">✕</span>
                    ) : (
                      <span className="w-3.5 h-3.5 border border-gray-300 rounded-full shrink-0 flex" />
                    )}
                    <span className={c.entered ? "text-emerald-700 font-medium" : c.teacherAbsent ? "text-orange-500 line-through" : "text-foreground"}>
                      {c.circleName}
                    </span>
                    {c.teacherAbsent && <span className="text-orange-400 text-[10px]">(غائبة)</span>}
                  </div>
                ))}
              </div>
            )}
            {(!myStats.assignedCircles || myStats.assignedCircles.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-2">
                لم تُسند لكِ حلقات بعد — تواصلي مع القائدة
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Step 1: Date */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            اليوم
          </CardTitle>
        </CardHeader>
        <CardContent>
          <select
            className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background text-right font-medium"
            value={selectedDate}
            onChange={e => { setSelectedDate(e.target.value); setSelectedCircleId(null); }}
            data-testid="select-date"
          >
            {days.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
          {(user as any)?.role === "leader" && (
            <button
              className="mt-3 w-full rounded-xl bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white font-bold text-sm py-3.5 flex items-center justify-center gap-2.5 shadow-md transition-colors"
              onClick={() => setThursdayDialogOpen(true)}
            >
              <Zap className="w-5 h-5" />
              ⚡ إدخال مراجعة الخميس تلقائيًا
              {!isThursdaySelected && <span className="text-xs font-normal opacity-90">(ليوم الخميس)</span>}
            </button>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Track then Circle */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" />
            {isDataEntry ? "الحلقة" : "المسار والحلقة"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {!isDataEntry && (
            <select
              className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background text-right font-medium"
              value={selectedTrack}
              onChange={e => { setSelectedTrack(e.target.value); setSelectedCircleId(null); }}
              data-testid="select-track"
            >
              <option value="">كل المسارات</option>
              {(tracks ?? []).map((t: any) => (
                <option key={t.name} value={t.name}>{t.name}</option>
              ))}
            </select>
          )}
          {isDataEntry && assignedCircles.length === 0 ? (
            <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 text-center">
              <p className="text-sm text-amber-700 font-medium">لم تُسند لكِ حلقات بعد</p>
              <p className="text-xs text-amber-500 mt-1">تواصلي مع القائدة لإسناد حلقاتك</p>
            </div>
          ) : (
            <select
              className="w-full border border-input rounded-xl px-3 py-2.5 text-sm bg-background text-right font-medium"
              value={selectedCircleId?.toString() ?? ""}
              onChange={e => setSelectedCircleId(e.target.value ? parseInt(e.target.value) : null)}
              data-testid="select-circle"
            >
              <option value="">{!isDataEntry && !selectedTrack ? "اختر المسار أولًا" : "اختر الحلقة"}</option>
              {filteredCirclesForEntry.map((c: any) => (
                <option key={c.id} value={c.id}>{c.name}{isDataEntry && c.track ? ` — ${c.track}` : ""}</option>
              ))}
            </select>
          )}
        </CardContent>
      </Card>

      {/* Teacher Absence Banner */}
      {selectedCircleId && isTeacherAbsent && (
        <Card className="border-2 border-orange-300 bg-orange-50 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center shrink-0">
                  <UserX className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <p className="font-bold text-orange-800 text-sm">المعلمة غائبة</p>
                  <p className="text-xs text-orange-600 mt-0.5">إدخال البيانات مغلق لهذه الحلقة ليوم {selectedDate}</p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5 border-orange-300 text-orange-700 hover:bg-orange-100 shrink-0"
                onClick={handleUndoTeacherAbsence}
                disabled={deleteTeacherAbsence.isPending}
              >
                <Undo2 className="w-3.5 h-3.5" />
                إلغاء
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Student list */}
      {selectedCircleId && !isTeacherAbsent && (
        <Card className="border-0 shadow-sm" data-testid="card-students">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500" />
                طالبات لم تُدخل بياناتهن
                {studentsInCircle.length > 0 && (
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">
                    {studentsInCircle.length}
                  </Badge>
                )}
              </CardTitle>
              <div className="flex items-center gap-1.5 shrink-0">
                {studentsInCircle.length > 0 && (
                  <Button
                    size="sm"
                    variant="outline"
                    className={`gap-1.5 h-8 text-xs ${bulkMode ? "bg-violet-50 border-violet-300 text-violet-700 hover:bg-violet-100" : "text-violet-600 border-violet-200 hover:bg-violet-50"}`}
                    onClick={() => {
                      if (!bulkMode) { initBulkData(); }
                      setBulkMode(m => !m);
                    }}
                  >
                    {bulkMode ? <LayoutList className="w-3.5 h-3.5" /> : <TableIcon className="w-3.5 h-3.5" />}
                    {bulkMode ? "إدخال فردي" : "إدخال دفعي"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5 text-orange-600 border-orange-200 hover:bg-orange-50 hover:text-orange-700 h-8"
                  onClick={handleMarkTeacherAbsent}
                  disabled={markTeacherAbsent.isPending}
                >
                  <UserX className="w-3.5 h-3.5" />
                  المعلمة غائبة
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {studentsInCircle.length === 0 ? (
              <div className="text-center py-8">
                <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
                <p className="font-semibold text-emerald-700 text-sm">تم إدخال بيانات جميع طالبات هذه الحلقة ليوم {selectedDate}</p>
              </div>
            ) : bulkMode ? (
              <BulkEntryTable
                students={studentsInCircle}
                inputFields={getInputFields(selectedCircle?.dataEntryType)}
                bulkData={bulkData}
                onChange={handleBulkChange}
                onSave={handleBulkSave}
                isSaving={isBulkSaving}
              />
            ) : (
              <div className="space-y-2">
                {studentsInCircle.length > 5 && (
                  <div className="relative mb-3">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
                    <Input
                      value={studentSearch}
                      onChange={e => setStudentSearch(e.target.value)}
                      placeholder="ابحثي باسم الطالبة..."
                      className="pr-9 text-right"
                      dir="rtl"
                    />
                  </div>
                )}
                {filteredStudents.map((student: any) => (
                  <div
                    key={student.studentId}
                    className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${student.onLeave ? "border-blue-200 bg-blue-50/50" : "border-border hover:bg-muted/30"}`}
                    data-testid={`row-student-${student.studentId}`}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{student.studentName}</p>
                        {student.onLeave && (
                          <span className="text-[10px] font-bold bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-2 py-0.5">إجازة</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">{student.track}</p>
                    </div>
                    {student.onLeave ? (
                      <span className="text-xs text-blue-500 font-medium shrink-0">لا يُحاسب بالحضور</span>
                    ) : (
                      <div className="flex gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-rose-600 border-rose-200 hover:bg-rose-50 hover:text-rose-700 h-8 px-2.5"
                          onClick={() => {
                            setSelectedStudent(student);
                            setForm({ ...emptyForm(), isAbsent: true });
                            setAutoFilled(false);
                            setDialogOpen(true);
                          }}
                          data-testid={`button-absent-${student.studentId}`}
                        >
                          غائبة
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => openEntry(student)}
                          className="gap-1.5 h-8"
                          data-testid={`button-enter-${student.studentId}`}
                        >
                          <PenSquare className="w-3.5 h-3.5" />
                          إدخال
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Entered Today Section */}
      {selectedCircleId && !isTeacherAbsent && circleRecordsData.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <span className="w-4 h-4 text-emerald-500">✓</span>
              تم الإدخال اليوم
              <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">{circleRecordsData.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {circleRecordsData.map((record: any) => {
                const canEdit = (user as any)?.role === "leader" ||
                  (new Date(record.createdAt).getTime() > Date.now() - 2 * 60 * 60 * 1000);
                return (
                  <div key={record.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-border bg-emerald-50/30">
                    <div>
                      <p className="font-semibold text-sm">{record.studentName || `طالبة #${record.studentId}`}</p>
                      <p className="text-xs text-muted-foreground">{record.isAbsent ? "غائبة" : "حاضرة"}</p>
                    </div>
                    {canEdit && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 h-8"
                        onClick={() => openEditRecord(record)}
                      >
                        <PenSquare className="w-3.5 h-3.5" />
                        تعديل
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Entry Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) setEditingRecordId(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-right flex items-center gap-2">
              <span>{selectedStudent?.studentName}</span>
              <Badge variant="outline" className="text-xs">{selectedStudent?.track}</Badge>
              {editingRecordId && <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">تعديل</Badge>}
            </DialogTitle>
            <p className="text-xs text-muted-foreground text-right">{selectedDate}</p>
          </DialogHeader>

          <div className="space-y-4 py-2">
            {/* Absent toggle */}
            {(() => {
              const repeatedInfo = repeatedAbsences?.find((r: any) => r.studentId === selectedStudent?.studentId);
              return (
                <>
                  <label className="flex items-center gap-3 p-3 border border-rose-200 rounded-xl bg-rose-50/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.isAbsent}
                      onChange={e => {
                        if (e.target.checked && repeatedInfo) {
                          setConfirmAbsenceOpen(true);
                        } else {
                          setForm(f => ({ ...f, isAbsent: e.target.checked }));
                        }
                      }}
                      className="w-4 h-4 accent-rose-500"
                      data-testid="checkbox-absent"
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold text-rose-600">تسجيل غياب</span>
                      {repeatedInfo && (
                        <span className="mr-2 text-xs text-rose-400">
                          (غابت {repeatedInfo.absenceCount} مرة مؤخرًا)
                        </span>
                      )}
                    </div>
                  </label>

                  {/* Confirm absence dialog for repeated absentees */}
                  <Dialog open={confirmAbsenceOpen} onOpenChange={setConfirmAbsenceOpen}>
                    <DialogContent className="max-w-sm" dir="rtl">
                      <DialogHeader>
                        <DialogTitle className="text-rose-600 flex items-center gap-2">
                          <AlertCircle className="w-5 h-5" />
                          تأكيد الغياب
                        </DialogTitle>
                      </DialogHeader>
                      <div className="py-2 text-sm text-muted-foreground">
                        <p>
                          <strong className="text-foreground">{selectedStudent?.studentName}</strong> غابت{" "}
                          <strong className="text-rose-600">{repeatedInfo?.absenceCount} مرة</strong> في الفترة الأخيرة.
                        </p>
                        <p className="mt-2">هل أنتِ متأكدة من تسجيل غيابها مجددًا؟</p>
                      </div>
                      <DialogFooter className="gap-2">
                        <Button variant="outline" onClick={() => setConfirmAbsenceOpen(false)}>إلغاء</Button>
                        <Button
                          className="bg-rose-600 hover:bg-rose-700 text-white"
                          onClick={() => {
                            setForm(f => ({ ...f, isAbsent: true }));
                            setConfirmAbsenceOpen(false);
                          }}
                        >
                          نعم، تسجيل الغياب
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </>
              );
            })()}

            {!form.isAbsent && (
              <>
                {/* الحفظ */}
                {inputFields.includes("memorize") && (
                  <SurahSection
                    title="الحفظ"
                    color="border-teal-200 bg-teal-50/40"
                    section={form.memorize}
                    onChange={(f, v) => updateSection("memorize", f, v)}
                    autoSuggested={autoFilled && !!form.memorize.surahStart}
                    onVoiceFill={(ss, as, se, ae) => setForm(f => ({ ...f, memorize: { surahStart: ss, ayahStart: as, surahEnd: se, ayahEnd: ae } }))}
                  />
                )}

                {/* تحذير تجاوز المعدل الاعتيادي في الحفظ */}
                {inputFields.includes("memorize") && memorizeWarning && (
                  <div className="flex items-start gap-2.5 px-3.5 py-3 rounded-xl bg-amber-50 border border-amber-300 text-amber-800 text-sm">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                    <div>
                      <p className="font-semibold">الحفظ أعلى من المعتاد</p>
                      <p className="text-xs text-amber-600 mt-0.5">
                        {formatPages(memPages)} وجه اليوم
                        {avgMemorize !== null
                          ? ` · معدلها المعتاد ${formatPages(avgMemorize)} وجه`
                          : " · أكثر من وجه كامل"}
                      </p>
                    </div>
                  </div>
                )}

                {/* المراجعة القريبة */}
                {inputFields.includes("review_near") && (
                  <SurahSection
                    title="المراجعة القريبة"
                    color="border-blue-200 bg-blue-50/40"
                    section={form.reviewNear}
                    onChange={(f, v) => updateSection("reviewNear", f, v)}
                    autoSuggested={autoFilled && !!form.reviewNear.surahStart}
                    locked={form.noReviewNear}
                    onToggleLock={() => setForm(f => ({
                      ...f,
                      noReviewNear: !f.noReviewNear,
                      reviewNear: !f.noReviewNear ? emptySection() : f.reviewNear,
                    }))}
                    onVoiceFill={(ss, as, se, ae) => setForm(f => ({ ...f, reviewNear: { surahStart: ss, ayahStart: as, surahEnd: se, ayahEnd: ae }, noReviewNear: false }))}
                  />
                )}

                {/* المراجعة البعيدة */}
                {inputFields.includes("review_far") && (
                  <div className="space-y-1.5">
                    {reviewPlanToday && !form.noReviewFar && (
                      <div className="flex items-center gap-2 bg-teal-50 border border-teal-200 rounded-xl px-3 py-2">
                        <span className="text-xs text-teal-700 flex-1">
                          📋 خطة اليوم: {SURAHS.find(s => s.number === reviewPlanToday.surahStart)?.arabicName ?? reviewPlanToday.surahStart} ← {SURAHS.find(s => s.number === reviewPlanToday.surahEnd)?.arabicName ?? reviewPlanToday.surahEnd}
                          {reviewPlanToday.pages != null && <span className="font-bold mr-1">({formatPages(reviewPlanToday.pages)} وجه)</span>}
                        </span>
                        <button
                          type="button"
                          onClick={() => setForm(f => ({
                            ...f,
                            reviewFar: {
                              surahStart: reviewPlanToday.surahStart!,
                              ayahStart: reviewPlanToday.ayahStart?.toString() ?? "1",
                              surahEnd: reviewPlanToday.surahEnd!,
                              ayahEnd: reviewPlanToday.ayahEnd?.toString() ?? "1",
                            },
                            noReviewFar: false,
                          }))}
                          className="text-xs bg-teal-600 text-white px-2.5 py-1 rounded-lg font-semibold hover:bg-teal-700 transition-colors shrink-0"
                        >
                          تطبيق
                        </button>
                      </div>
                    )}
                    <SurahSection
                      title="المراجعة البعيدة"
                      color="border-teal-200 bg-teal-100/40"
                      section={form.reviewFar}
                      onChange={(f, v) => updateSection("reviewFar", f, v)}
                      autoSuggested={autoFilled && !!form.reviewFar.surahStart}
                      locked={form.noReviewFar}
                      onToggleLock={() => setForm(f => ({
                        ...f,
                        noReviewFar: !f.noReviewFar,
                        reviewFar: !f.noReviewFar ? emptySection() : f.reviewFar,
                      }))}
                      onVoiceFill={(ss, as, se, ae) => setForm(f => ({ ...f, reviewFar: { surahStart: ss, ayahStart: as, surahEnd: se, ayahEnd: ae }, noReviewFar: false }))}
                    />
                  </div>
                )}

                {/* المراجعة العامة */}
                {inputFields.includes("review") && (
                  <SurahSection
                    title="المراجعة"
                    color="border-blue-200 bg-blue-50/40"
                    section={form.review}
                    onChange={(f, v) => updateSection("review", f, v)}
                    autoSuggested={autoFilled && !!form.review.surahStart}
                    locked={form.noReview}
                    onToggleLock={() => setForm(f => ({
                      ...f,
                      noReview: !f.noReview,
                      review: !f.noReview ? emptySection() : f.review,
                    }))}
                    onVoiceFill={(ss, as, se, ae) => setForm(f => ({ ...f, review: { surahStart: ss, ayahStart: as, surahEnd: se, ayahEnd: ae }, noReview: false }))}
                  />
                )}

                {/* التلاوة */}
                {inputFields.includes("recitation") && (
                  <SurahSection
                    title="التلاوة"
                    color="border-emerald-200 bg-emerald-50/40"
                    section={form.recitation}
                    onChange={(f, v) => updateSection("recitation", f, v)}
                    autoSuggested={autoFilled && !!form.recitation.surahStart}
                    onVoiceFill={(ss, as, se, ae) => setForm(f => ({ ...f, recitation: { surahStart: ss, ayahStart: as, surahEnd: se, ayahEnd: ae } }))}
                  />
                )}

                {/* عدد التكرار */}
                {inputFields.includes("repetitions") && (
                  <div className="border border-amber-200 bg-amber-50/40 rounded-xl p-4">
                    <p className="font-semibold text-sm flex items-center gap-2 mb-3">
                      <BookOpen className="w-4 h-4" />
                      عدد مرات التكرار
                    </p>
                    <select
                      className="w-full border border-input rounded-md px-3 py-2 text-sm bg-background text-right"
                      value={form.repetitions}
                      onChange={e => setForm(f => ({ ...f, repetitions: e.target.value }))}
                    >
                      {Array.from({ length: 100 }, (_, i) => i + 1).map(n => (
                        <option key={n} value={n.toString()}>{n} {n === 7 ? "(افتراضي)" : ""}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* سماع القارئ */}
                {inputFields.includes("listen") && (
                  <div className="border border-teal-200 bg-teal-50/40 rounded-xl p-4">
                    <p className="font-semibold text-sm mb-3 flex items-center gap-2">
                      <span>🎧</span>
                      هل استمعت للقارئ؟
                    </p>
                    <div className="flex gap-3">
                      <button
                        onClick={() => setForm(f => ({ ...f, listenedToReciter: true }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                          form.listenedToReciter === true
                            ? "border-teal-500 bg-teal-100 text-teal-700"
                            : "border-border/50 text-muted-foreground hover:border-teal-300"
                        }`}
                      >
                        ✓ نعم
                      </button>
                      <button
                        onClick={() => setForm(f => ({ ...f, listenedToReciter: false }))}
                        className={`flex-1 py-2.5 rounded-xl text-sm font-semibold border-2 transition-all ${
                          form.listenedToReciter === false
                            ? "border-rose-400 bg-rose-50 text-rose-600"
                            : "border-border/50 text-muted-foreground hover:border-rose-300"
                        }`}
                      >
                        ✗ لا
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary */}
                {(memPages > 0 || revNearPages > 0 || revFarPages > 0 || revPages > 0 || recPages > 0) && (
                  <div className="border border-border rounded-xl p-3 bg-muted/30">
                    <p className="text-xs font-bold text-muted-foreground mb-2">ملخص الأوجه</p>
                    <div className="flex flex-wrap gap-2">
                      {memPages > 0 && (
                        <Badge className="bg-teal-100 text-teal-700 border-0">
                          حفظ: {formatPages(memPages)} وجه
                        </Badge>
                      )}
                      {revNearPages > 0 && (
                        <Badge className="bg-blue-100 text-blue-700 border-0">
                          م. قريبة: {formatPages(revNearPages)} وجه
                        </Badge>
                      )}
                      {revFarPages > 0 && (
                        <Badge className="bg-teal-100 text-teal-600 border-0">
                          م. بعيدة: {formatPages(revFarPages)} وجه
                        </Badge>
                      )}
                      {revPages > 0 && (
                        <Badge className="bg-blue-100 text-blue-700 border-0">
                          مراجعة: {formatPages(revPages)} وجه
                        </Badge>
                      )}
                      {recPages > 0 && (
                        <Badge className="bg-emerald-100 text-emerald-700 border-0">
                          تلاوة: {formatPages(recPages)} وجه
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={handleSave}
              disabled={createRecord.isPending}
              data-testid="button-save-record"
            >
              {createRecord.isPending ? "جاري الحفظ..." : "حفظ البيانات"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار تأكيد إدخال الخميس التلقائي */}
      <Dialog open={thursdayDialogOpen} onOpenChange={setThursdayDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-500" />
              إدخال مراجعة الخميس تلقائيًا
            </DialogTitle>
          </DialogHeader>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>سيتم إدخال <strong>مراجعة عامة</strong> يوم الخميس لجميع الطالبات تلقائيًا.</p>
            <p>المراجعة = مجموع ما حفظته كل طالبة من <strong>الأحد إلى الأربعاء</strong> هذا الأسبوع.</p>
            <p className="text-amber-700 bg-amber-50 rounded-lg px-3 py-2 text-xs">
              الطالبات اللاتي ليس لديهن حفظ هذا الأسبوع أو تم إدخال بياناتهن مسبقًا سيتم تخطيهن.
            </p>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setThursdayDialogOpen(false)}>إلغاء</Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white"
              onClick={handleThursdayBulk}
              disabled={thursdayLoading}
            >
              {thursdayLoading ? "جاري الإدخال..." : "نعم، أدخل للكل"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
