import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { getToken } from "@/lib/auth";
import { BookOpen, RefreshCw, Users, CalendarCheck, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

const DAY_NAMES = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء"];
const DAY_SHORT = ["أحد", "اثنين", "ثلاثاء", "أربعاء"];

type FixationDay = { date: string; hasEntry: boolean; isAbsent: boolean; pages: number };
type FixationStudent = {
  studentId: number; studentName: string; circleName: string;
  dayInCycle: number; cycleLength: number;
  days: FixationDay[];
  totalPages: number; daysAttended: number; daysMissed: number;
};
type ReportData = {
  weekStart: string; weekDates: string[]; students: FixationStudent[];
};

async function fetchReport(): Promise<ReportData> {
  const token = getToken();
  const res = await fetch(`${BASE}/api/review-plans/fixation-weekly-report`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("فشل تحميل التقرير");
  return res.json();
}

function DayBadge({ day, date, today }: { day: FixationDay; date: string; today: string }) {
  const isPast = date <= today;
  const isToday = date === today;

  let bg = "bg-gray-100 text-gray-400";
  let label = "—";

  if (day.isAbsent) {
    bg = "bg-gray-200 text-gray-500";
    label = "غ";
  } else if (day.hasEntry) {
    if (day.pages >= 0.9) {
      bg = "bg-emerald-100 text-emerald-700";
    } else if (day.pages > 0) {
      bg = "bg-amber-100 text-amber-700";
    } else {
      bg = "bg-emerald-50 text-emerald-500";
    }
    label = day.pages > 0 ? String(day.pages) : "✓";
  } else if (isPast) {
    bg = "bg-rose-100 text-rose-600";
    label = "✗";
  } else {
    bg = "bg-gray-50 text-gray-300";
    label = "—";
  }

  return (
    <div className={`flex flex-col items-center gap-0.5 ${isToday ? "ring-1 ring-primary/50 rounded-lg" : ""}`}>
      <span className={`w-9 h-7 rounded-lg text-[10px] font-bold flex items-center justify-center ${bg}`}>
        {label}
      </span>
    </div>
  );
}

function StudentRow({ student, weekDates, today }: { student: FixationStudent; weekDates: string[]; today: string }) {
  const pct = Math.min(100, Math.round((student.dayInCycle / student.cycleLength) * 100));
  const isBehind = student.daysMissed > 0;
  const isAhead = student.daysAttended === weekDates.filter(d => d <= today).length && student.daysMissed === 0;

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 border-b border-border/30 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-[13px] font-semibold text-foreground truncate">{student.studentName}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <p className="text-[10px] text-muted-foreground">{student.circleName}</p>
          <span className="text-[10px] text-muted-foreground">·</span>
          <p className="text-[10px] text-muted-foreground">
            يوم <span className="font-bold text-foreground">{student.dayInCycle}</span> / {student.cycleLength}
          </p>
        </div>
        <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden w-full">
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: pct >= 100 ? "#10b981" : isBehind ? "#f59e0b" : "#3b82f6",
            }}
          />
        </div>
      </div>

      <div className="flex gap-1 shrink-0">
        {weekDates.map((date, i) => (
          <div key={date} className="flex flex-col items-center gap-0.5">
            <span className="text-[8px] text-muted-foreground">{DAY_SHORT[i]}</span>
            <DayBadge day={student.days[i]} date={date} today={today} />
          </div>
        ))}
      </div>

      <div className="shrink-0 text-center w-10">
        {isBehind && <span className="text-rose-500 text-[10px] font-bold">✗ {student.daysMissed}</span>}
        {!isBehind && isAhead && <span className="text-emerald-500 text-[10px] font-bold">✓</span>}
        {!isBehind && !isAhead && <span className="text-gray-300 text-[10px]">—</span>}
      </div>
    </div>
  );
}

export default function FixationReportPage() {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const d = await fetchReport();
      setData(d);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "خطأ");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-48">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (error) return (
    <div className="p-4 text-center text-rose-500 text-sm">{error}</div>
  );
  if (!data || !data.students.length) return (
    <div className="p-6 text-center space-y-3">
      <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/40" />
      <p className="text-sm text-muted-foreground">لا توجد طالبات في مسار التثبيت حاليًا</p>
    </div>
  );

  const filtered = data.students.filter(s =>
    !search || s.studentName.includes(search) || s.circleName.includes(search)
  );

  const byCircle: Record<string, FixationStudent[]> = {};
  for (const s of filtered) {
    if (!byCircle[s.circleName]) byCircle[s.circleName] = [];
    byCircle[s.circleName].push(s);
  }

  const totalStudents = data.students.length;
  const attended = data.students.filter(s => s.daysAttended > 0).length;
  const missing = data.students.filter(s => s.daysMissed > 0).length;
  const perfect = data.students.filter(s =>
    s.daysMissed === 0 && s.daysAttended === data.weekDates.filter(d => d <= today).length
  ).length;

  const weekLabel = (() => {
    const d = new Date(data.weekStart);
    return d.toLocaleDateString("ar-SA", { day: "numeric", month: "long" });
  })();

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            تقرير التثبيت الأسبوعي
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">أسبوع {weekLabel} · {totalStudents} طالبة</p>
        </div>
        <button
          onClick={load}
          className="p-2 rounded-lg hover:bg-muted transition-colors"
          title="تحديث"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-3 pb-3 text-center">
            <Users className="w-4 h-4 mx-auto text-blue-500 mb-1" />
            <p className="text-lg font-bold text-blue-600">{totalStudents}</p>
            <p className="text-[10px] text-muted-foreground">إجمالي المثبّتات</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-3 pb-3 text-center">
            <CalendarCheck className="w-4 h-4 mx-auto text-emerald-500 mb-1" />
            <p className="text-lg font-bold text-emerald-600">{perfect}</p>
            <p className="text-[10px] text-muted-foreground">منتظمات هذا الأسبوع</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="pt-3 pb-3 text-center">
            <AlertTriangle className="w-4 h-4 mx-auto text-rose-400 mb-1" />
            <p className="text-lg font-bold text-rose-500">{missing}</p>
            <p className="text-[10px] text-muted-foreground">غائبات / متأخرات</p>
          </CardContent>
        </Card>
      </div>

      <input
        type="text"
        placeholder="بحث بالاسم أو الحلقة..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        className="w-full border border-input rounded-xl px-3 py-2 text-sm bg-background focus:outline-none focus:ring-1 focus:ring-primary/20"
      />

      <div className="flex items-center gap-1 px-1 text-[9px] text-muted-foreground">
        <span className="w-6 h-4 rounded bg-emerald-100 inline-block" />= نصاب كامل
        <span className="w-6 h-4 rounded bg-amber-100 inline-block mr-2" />= جزئي
        <span className="w-6 h-4 rounded bg-rose-100 inline-block mr-2" />= غياب/تقصير
        <span className="w-6 h-4 rounded bg-gray-100 inline-block mr-2" />= لم يحن موعده
      </div>

      <div className="space-y-3">
        {Object.entries(byCircle).sort(([a], [b]) => a.localeCompare(b, "ar")).map(([circle, students]) => {
          const circleMissing = students.filter(s => s.daysMissed > 0).length;
          return (
            <Card key={circle} className="border-0 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-muted/40 border-b border-border/30">
                <p className="text-xs font-bold text-foreground">{circle}</p>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{students.length} طالبة</span>
                  {circleMissing > 0 && (
                    <span className="text-[10px] font-semibold text-rose-500 bg-rose-50 px-1.5 py-0.5 rounded-full">
                      ⚠ {circleMissing}
                    </span>
                  )}
                </div>
              </div>
              <div className="px-1 py-0.5">
                <div className="flex items-center gap-3 px-3 py-1 border-b border-border/20">
                  <div className="flex-1" />
                  <div className="flex gap-1 shrink-0">
                    {data.weekDates.map((_, i) => (
                      <span key={i} className="w-9 text-center text-[8px] text-muted-foreground font-semibold">
                        {DAY_NAMES[i]}
                      </span>
                    ))}
                  </div>
                  <div className="w-10 text-center text-[8px] text-muted-foreground font-semibold">تقصير</div>
                </div>
                {students.map(s => (
                  <StudentRow key={s.studentId} student={s} weekDates={data.weekDates} today={today} />
                ))}
              </div>
            </Card>
          );
        })}
      </div>

      {!filtered.length && search && (
        <p className="text-sm text-muted-foreground text-center py-6">لا نتائج لـ "{search}"</p>
      )}
    </div>
  );
}
