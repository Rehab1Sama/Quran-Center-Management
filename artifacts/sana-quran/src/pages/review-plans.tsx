import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { getToken } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen, CheckCircle2, AlertTriangle, XCircle,
  Users, Download, ChevronDown, ChevronUp, Loader2,
  RefreshCw, TrendingUp, BarChart2, Bell,
} from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type DayProgress = {
  date: string;
  planned: number;
  actual: number;
  absent: boolean;
  hasRecord: boolean;
};

type StudentWithPlan = {
  id: number;
  name: string;
  circleId: number;
  circleName: string;
  trackType: string;
  track: string;
  planType: string;
  cycleCount: number;
  cycleLength: number;
  totalPages: number;
  dayInCycle: number;
  isCompleted: boolean;
  isCompletedEarly: boolean;
  justRenewed: boolean;
  missedDaysLast30: number;
  isStumbling: boolean;
  memorizedUpToSurah?: string;
  currentCycleStart: string;
  theme: { primaryColor: string; secondaryColor: string; accentColor: string };
  weeklyProgress?: DayProgress[];
  weekDates?: string[];
};

type StudentWithoutPlan = {
  id: number;
  name: string;
  circleId: number;
  circleName: string;
  trackType: string;
  track: string;
};

type CircleStudentDetail = {
  id: number;
  name: string;
  hasPlan: boolean;
  dayInCycle?: number;
  cycleLength?: number;
  pct?: number;
  isCompleted?: boolean;
  isCompletedEarly?: boolean;
  isStumbling?: boolean;
  memorizedUpToSurah?: string;
};

type CircleDetail = {
  circleId: number;
  circleName: string;
  students: CircleStudentDetail[];
};

type PlansData = {
  withPlan: StudentWithPlan[];
  withoutPlan: StudentWithoutPlan[];
  byCircle?: CircleDetail[];
};

// ── Shared PDF helpers ───────────────────────────────────────────────────────
const AR_DAYS_RP = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];

function getWorkingDayDateRP(cycleStart: string, dayNum: number): string {
  let count = 0;
  const cur = new Date(cycleStart);
  while (true) {
    if (cur.getDay() !== 5) {
      count++;
      if (count === dayNum) return cur.toISOString().slice(0, 10);
    }
    cur.setDate(cur.getDate() + 1);
  }
}

function generateReviewPlanHTML(plan: any): string {
  const theme = plan.theme;
  const rows = (plan.planEntries ?? []).map((entry: any, idx: number) => {
    const dayDate = getWorkingDayDateRP(plan.currentCycleStart, entry.dayNumber);
    const dayJs = new Date(dayDate);
    const dayName = AR_DAYS_RP[dayJs.getDay()];
    const dateLabel = dayJs.toLocaleDateString("ar-SA", { day: "numeric", month: "short", year: "numeric" });
    const isToday = idx === plan.dayInCycle - 1;
    const isPast = idx < plan.dayInCycle - 1;
    const perf = (plan.dayPerformance ?? []).find((d: any) => d.dayNumber === entry.dayNumber);
    let perfText = "";
    let perfColor = "#94a3b8";
    let rowBg = isToday ? theme.secondaryColor : "white";
    if (isPast && perf) {
      if (perf.absent) { perfText = "—"; perfColor = "#9ca3af"; }
      else if (perf.exceeded) { perfText = "↑"; perfColor = "#2563eb"; rowBg = isToday ? theme.secondaryColor : "#eff6ff"; }
      else if (perf.completed) { perfText = "✓"; perfColor = "#059669"; rowBg = isToday ? theme.secondaryColor : "#f0fdf4"; }
      else if (perf.partial) { perfText = "≈"; perfColor = "#d97706"; rowBg = isToday ? theme.secondaryColor : "#fffbeb"; }
      else { perfText = "✗"; perfColor = "#dc2626"; rowBg = isToday ? theme.secondaryColor : "#fff1f2"; }
    }
    const section = entry.surahStart === entry.surahEnd
      ? `${entry.surahStart} (${entry.ayahStart}–${entry.ayahEnd})`
      : `${entry.surahStart} ${entry.ayahStart} ← ${entry.surahEnd} ${entry.ayahEnd}`;
    return `<tr style="background:${rowBg};font-weight:${isToday ? "bold" : "normal"}">
      <td style="text-align:center;color:#64748b">${entry.dayNumber}</td>
      <td style="color:#334155">${dayName}</td><td style="color:#64748b">${dateLabel}</td>
      <td style="color:${isToday ? theme.primaryColor : "#1e293b"}">${section}</td>
      <td style="text-align:center;color:#64748b">${entry.pages}</td>
      <td style="text-align:center;color:${perfColor};font-weight:bold;font-size:15px">${perfText}</td>
    </tr>`;
  }).join("");
  const startDateFmt = new Date(plan.currentCycleStart).toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  const printDate = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  const studentName = plan.studentName ?? "";
  const circleName = plan.circleName ?? "";
  return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8">
<title>خطة مراجعة ${studentName}</title>
<style>*{font-family:'Segoe UI',Tahoma,Arial,sans-serif;box-sizing:border-box}
body{margin:0;padding:28px;color:#1e293b;font-size:13px;background:white}
.hdr{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid ${theme.primaryColor};padding-bottom:16px;margin-bottom:20px}
.hdr-l h1{color:${theme.primaryColor};font-size:22px;margin:0 0 6px 0;font-weight:800}
.hdr-l .nm{font-size:16px;font-weight:700;color:#334155;margin:2px 0}
.hdr-l .sub{color:#64748b;font-size:11px;margin:2px 0}.hdr-r{text-align:left}
.badge{background:${theme.secondaryColor};color:${theme.accentColor};border-radius:24px;padding:4px 14px;font-size:13px;font-weight:700;display:inline-block;margin-bottom:6px;border:1px solid ${theme.primaryColor}33}
.stat{color:#64748b;font-size:11px;margin:2px 0}
.legend{display:flex;gap:16px;flex-wrap:wrap;margin-bottom:14px;padding:10px 14px;background:#f8fafc;border-radius:8px;border:1px solid #e2e8f0}
.li{display:flex;align-items:center;gap:6px;font-size:11px;color:#64748b}
table{width:100%;border-collapse:collapse}
th{background:${theme.primaryColor};color:white;padding:10px 12px;text-align:right;font-size:12px;font-weight:700}
td{padding:9px 12px;border-bottom:1px solid #e2e8f0;font-size:12px}
.ftr{margin-top:24px;text-align:center;color:#94a3b8;font-size:11px;border-top:1px solid #e2e8f0;padding-top:14px}
@media print{body{padding:10px}@page{size:A4 portrait;margin:12mm}}</style></head>
<body>
<div class="hdr"><div class="hdr-l"><h1>📖 خطة المراجعة القرآنية</h1>
<p class="nm">${studentName}</p><p class="sub">حلقة ${circleName} · بدء الدورة: ${startDateFmt}</p></div>
<div class="hdr-r"><div class="badge">الدورة #${plan.cycleCount}</div>
<p class="stat">📚 ${plan.totalPages} وجه إجمالًا</p>
<p class="stat">📅 ${plan.cycleLength} يوم عمل</p>
<p class="stat">اليوم ${plan.dayInCycle} من ${plan.cycleLength}</p></div></div>
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

function openPlanPDF(plan: any) {
  const html = generateReviewPlanHTML(plan);
  const w = window.open("", "_blank", "width=960,height=740");
  if (w) { w.document.write(html); w.document.close(); w.focus(); setTimeout(() => w.print(), 700); }
}

// ── Student self-entry for leave students ───────────────────────────────────
function SelfEntrySection({ plan, onSubmitted }: { plan: any; onSubmitted: () => void }) {
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const theme = plan.theme;

  const todayEntry = plan.todayEntry;
  const alreadyEntered = plan.actualPagesForToday > 0;

  async function handleEntry(completed: boolean) {
    setSubmitting(true);
    try {
      const token = getToken();
      const body: any = { completed };
      if (completed && todayEntry) {
        body.surahStart = todayEntry.surahStart;
        body.ayahStart = todayEntry.ayahStart;
        body.surahEnd = todayEntry.surahEnd;
        body.ayahEnd = todayEntry.ayahEnd;
        body.pages = todayEntry.pages;
      }
      const res = await fetch(`${BASE}/api/records/student-self-entry`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json();
        alert(data.error ?? "حدث خطأ");
        return;
      }
      setSubmitted(true);
      onSubmitted();
    } catch {
      alert("حدث خطأ في الاتصال");
    } finally {
      setSubmitting(false);
    }
  }

  if (plan.isFriday) return null;
  if (!todayEntry) return null;

  const section = todayEntry.surahStart === todayEntry.surahEnd
    ? `${todayEntry.surahStart} (${todayEntry.ayahStart} – ${todayEntry.ayahEnd})`
    : `${todayEntry.surahStart} (${todayEntry.ayahStart}) ← ${todayEntry.surahEnd} (${todayEntry.ayahEnd})`;

  if (alreadyEntered || submitted) {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-1">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-sm font-bold text-emerald-800">سُجِّل إنجازك لليوم ✓</p>
        </div>
        <p className="text-xs text-emerald-700">{section} · {todayEntry.pages} وجه</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border p-4 space-y-3" style={{ borderColor: `${theme.primaryColor}44`, background: theme.secondaryColor }}>
      <p className="text-sm font-bold" style={{ color: theme.accentColor }}>📝 سجّلي إنجازك لليوم</p>
      <p className="text-xs" style={{ color: theme.accentColor }}>مراجعة اليوم: <span className="font-semibold">{section}</span> ({todayEntry.pages} وجه)</p>
      <div className="flex gap-2">
        <button
          onClick={() => handleEntry(true)}
          disabled={submitting}
          className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white transition-opacity disabled:opacity-60"
          style={{ background: theme.primaryColor }}
        >
          {submitting ? "جاري الحفظ..." : "✓ أكملت اليوم"}
        </button>
        <button
          onClick={() => handleEntry(false)}
          disabled={submitting}
          className="flex-1 rounded-xl py-2.5 text-sm font-bold border transition-colors disabled:opacity-60"
          style={{ borderColor: `${theme.primaryColor}44`, color: theme.accentColor }}
        >
          ✗ لم أكمل
        </button>
      </div>
    </div>
  );
}

// ── Student's own plan view ──────────────────────────────────────────────────
function StudentReviewPlanView({ studentId }: { studentId: number }) {
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);

  function loadPlan() {
    setLoading(true);
    const token = getToken();
    fetch(`${BASE}/api/students/${studentId}/review-plan`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(setPlan)
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadPlan();
  }, [studentId]);

  function handleDownloadPDF() {
    if (!plan) return;
    setDownloading(true);
    openPlanPDF(plan);
    setTimeout(() => setDownloading(false), 1200);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!plan) {
    return (
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-xl font-bold">خطة المراجعة</h1>
        <Card className="border-0 shadow-sm">
          <CardContent className="py-10 text-center text-sm text-muted-foreground space-y-3">
            <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/40" />
            <p>لا توجد خطة مراجعة نشطة</p>
            <p className="text-xs">يمكن إنشاء الخطة عبر المعلمة من صفحتك الشخصية</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const theme = plan.theme;
  const pct = Math.min(100, Math.round((plan.dayInCycle / plan.cycleLength) * 100));

  return (
    <div className="max-w-2xl mx-auto space-y-4" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">خطة المراجعة</h1>
          <p className="text-xs text-muted-foreground mt-0.5">الدورة #{plan.cycleCount} · {plan.cycleLength} يوم عمل</p>
        </div>
        <button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 text-xs font-medium transition-colors disabled:opacity-50"
        >
          {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
          تحميل PDF
        </button>
      </div>

      {/* Plan card */}
      <div className="relative rounded-2xl overflow-hidden shadow-lg" style={{ background: theme.secondaryColor }}>
        <div className="relative z-10 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs font-bold opacity-70" style={{ color: theme.accentColor }}>خطة المراجعة القرآنية</p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-3xl font-black" style={{ color: theme.primaryColor }}>{plan.dayInCycle}</span>
                <span className="text-sm opacity-60" style={{ color: theme.accentColor }}>/ {plan.cycleLength} يوم — الدورة #{plan.cycleCount}</span>
              </div>
            </div>
            <div className="w-14 h-14 relative">
              <svg viewBox="0 0 36 36" className="w-14 h-14 -rotate-90">
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={theme.primaryColor} strokeWidth="3" opacity="0.2" />
                <circle cx="18" cy="18" r="15.9" fill="none" stroke={theme.primaryColor} strokeWidth="3"
                  strokeDasharray={`${pct} 100`} strokeLinecap="round" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-bold" style={{ color: theme.primaryColor }}>{pct}%</span>
              </div>
            </div>
          </div>

          {plan.todayEntry && !plan.isFriday && (
            <div className="rounded-xl p-3" style={{ backgroundColor: `${theme.primaryColor}22` }}>
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
          {plan.isFriday && (
            <div className="rounded-xl p-3 text-xs font-medium" style={{ background: "#fdf9ee", color: "#7a5020" }}>
              🌙 يوم الجمعة إجازة — لا مراجعة اليوم ✨
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div className="text-center rounded-xl bg-white/40 py-2">
              <p className="text-base font-bold" style={{ color: theme.primaryColor }}>{plan.totalPages}</p>
              <p className="text-[10px] opacity-60" style={{ color: theme.accentColor }}>وجه إجمالًا</p>
            </div>
            <div className="text-center rounded-xl bg-white/40 py-2">
              <p className={`text-base font-bold ${plan.isStumbling ? "text-rose-500" : ""}`} style={plan.isStumbling ? {} : { color: theme.primaryColor }}>
                {plan.missedDaysLast30}
              </p>
              <p className="text-[10px] opacity-60" style={{ color: theme.accentColor }}>أيام تأخر</p>
            </div>
            <div className="text-center rounded-xl bg-white/40 py-2">
              <p className="text-base font-bold" style={{ color: theme.primaryColor }}>{plan.cycleCount}</p>
              <p className="text-[10px] opacity-60" style={{ color: theme.accentColor }}>دورة</p>
            </div>
          </div>
        </div>
      </div>

      {plan.isOnLeave && <SelfEntrySection plan={plan} onSubmitted={loadPlan} />}

      {plan.isCompletedEarly && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
          <span>⭐</span>
          <p className="text-xs text-emerald-800 font-medium">أحسنتِ! أتممتِ المراجعة قبل نهاية الدورة — تواصلي مع معلمتك لتجديد الدورة</p>
        </div>
      )}
      {plan.isStumbling && (
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
          <p className="text-xs text-amber-800">لاحظنا تأخرًا ({plan.missedDaysLast30} أيام) — حاولي اللحاق بنصابك اليومي</p>
        </div>
      )}
      {!plan.isStumbling && plan.missedDaysLast30 === 0 && (
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <p className="text-xs text-emerald-800">أداء ممتاز! لا تأخر هذا الشهر ✨</p>
        </div>
      )}

      <button
        onClick={() => setShowSchedule(v => !v)}
        className="w-full flex items-center justify-between p-3.5 rounded-xl border transition-colors text-right"
        style={showSchedule ? { background: theme.secondaryColor, borderColor: `${theme.primaryColor}44` } : {}}
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={showSchedule ? { color: theme.accentColor } : {}}>📅 الجدول الزمني</span>
          <span className="text-[10px] text-muted-foreground">{plan.cycleLength} يوم · {plan.totalPages} وجه</span>
        </div>
        {showSchedule
          ? <ChevronUp className="w-4 h-4 shrink-0" style={{ color: theme.primaryColor }} />
          : <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />}
      </button>

      {showSchedule && (plan.planEntries ?? []).length > 0 && (
        <div className="rounded-xl border border-border/50 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full" style={{ fontSize: "12px" }}>
              <thead>
                <tr style={{ background: theme.primaryColor }}>
                  <th className="text-white font-bold px-2 py-2.5 text-center" style={{ width: "32px" }}>#</th>
                  <th className="text-white font-bold px-2 py-2.5 text-right" style={{ width: "72px" }}>اليوم</th>
                  <th className="text-white font-bold px-2 py-2.5 text-right" style={{ width: "96px" }}>التاريخ</th>
                  <th className="text-white font-bold px-3 py-2.5 text-right">المقطع</th>
                  <th className="text-white font-bold px-2 py-2.5 text-center" style={{ width: "48px" }}>الوجوه</th>
                  <th className="text-white font-bold px-2 py-2.5 text-center" style={{ width: "40px" }}>✓</th>
                </tr>
              </thead>
              <tbody>
                {(plan.planEntries ?? []).map((entry: any, idx: number) => {
                  const dayDate = getWorkingDayDateRP(plan.currentCycleStart, entry.dayNumber);
                  const dayJs = new Date(dayDate);
                  const dayName = AR_DAYS_RP[dayJs.getDay()];
                  const dateLabel = dayJs.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
                  const isToday = idx === plan.dayInCycle - 1;
                  const isPast = idx < plan.dayInCycle - 1;
                  const perf = (plan.dayPerformance ?? []).find((d: any) => d.dayNumber === entry.dayNumber);
                  const section = entry.surahStart === entry.surahEnd
                    ? `${entry.surahStart} (${entry.ayahStart}–${entry.ayahEnd})`
                    : `${entry.surahStart} ${entry.ayahStart} ← ${entry.surahEnd} ${entry.ayahEnd}`;
                  return (
                    <tr key={entry.dayNumber} className="border-b border-border/30"
                      style={{
                        background: isToday ? theme.secondaryColor
                          : isPast && perf?.exceeded ? "#eff6ff"
                          : isPast && perf?.completed ? "#f0fdf4"
                          : isPast && perf?.partial ? "#fffbeb"
                          : isPast && perf && !perf.absent && !perf.completed ? "#fff1f2"
                          : "",
                        fontWeight: isToday ? "bold" : "normal",
                      }}
                    >
                      <td className="px-2 py-2 text-center">
                        <span className="inline-flex w-5 h-5 rounded-full items-center justify-center font-bold"
                          style={isToday ? { background: theme.primaryColor, color: "white", fontSize: "9px" } : { background: "#e5e7eb", color: "#6b7280", fontSize: "9px" }}>
                          {entry.dayNumber}
                        </span>
                      </td>
                      <td className="px-2 py-2 text-right" style={isToday ? { color: theme.accentColor } : { color: "#64748b" }}>{dayName}</td>
                      <td className="px-2 py-2 text-right text-muted-foreground">{dateLabel}</td>
                      <td className="px-3 py-2 text-right" style={isToday ? { color: theme.primaryColor } : {}}>{section}</td>
                      <td className="px-2 py-2 text-center text-muted-foreground">{entry.pages}</td>
                      <td className="px-2 py-2 text-center">
                        {isPast && perf ? (
                          <span className={`font-bold ${perf.absent ? "text-gray-400" : perf.exceeded ? "text-blue-600" : perf.completed ? "text-emerald-600" : perf.partial ? "text-amber-500" : "text-rose-500"}`} style={{ fontSize: "14px" }}>
                            {perf.absent ? "—" : perf.exceeded ? "↑" : perf.completed ? "✓" : perf.partial ? "≈" : "✗"}
                          </span>
                        ) : isToday ? (
                          <span style={{ color: theme.primaryColor }}>←</span>
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
    </div>
  );
}

function useStudentsPlans() {
  const [data, setData] = useState<PlansData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const load = () => {
    setLoading(true);
    setError(false);
    const token = getToken();
    fetch(`${BASE}/api/review-plans/students-plans-list`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : Promise.reject())
      .then(setData)
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  return { data, loading, error, reload: load };
}

type TeacherNotif = {
  id: number; studentId: number; studentName: string;
  circleName: string; track: string; type: string;
  cycleCount: number; totalPages: number; createdAt: string;
};

function useTeacherNotifications(role: string) {
  const [notifs, setNotifs] = useState<TeacherNotif[]>([]);
  const [dismissed, setDismissed] = useState<Set<number>>(new Set());

  useEffect(() => {
    if (!["teacher", "supervisor"].includes(role)) return;
    const token = getToken();
    fetch(`${BASE}/api/review-plans/teacher-notifications`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(setNotifs)
      .catch(() => {});
  }, [role]);

  const dismiss = async (id: number) => {
    setDismissed(prev => new Set([...prev, id]));
    const token = getToken();
    fetch(`${BASE}/api/review-plans/teacher-notifications/${id}/read`, {
      method: "PATCH",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).catch(() => {});
  };

  return {
    visible: notifs.filter(n => !dismissed.has(n.id)),
    dismiss,
  };
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins} د`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} س`;
  return `${Math.floor(hrs / 24)} ي`;
}

function TeacherNotifBanner({ notifs, onDismiss }: { notifs: TeacherNotif[]; onDismiss: (id: number) => void }) {
  if (notifs.length === 0) return null;
  return (
    <div className="rounded-xl border border-teal-200 bg-teal-50/70 overflow-hidden mb-1">
      <div className="flex items-center gap-2 px-4 py-2.5 bg-teal-100/60 border-b border-teal-100">
        <Bell className="w-3.5 h-3.5 text-teal-600" />
        <span className="font-bold text-xs text-teal-800">خطط جديدة من طالباتك</span>
        <Badge className="bg-teal-600 text-white border-0 text-[10px] px-1.5">{notifs.length}</Badge>
      </div>
      <div className="divide-y divide-teal-100/60">
        {notifs.map(n => (
          <div key={n.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-xs text-foreground">{n.studentName}</p>
              <p className="text-[11px] text-teal-600 font-medium">
                {n.type === "plan_renewed" ? `جددت الدورة #${n.cycleCount}` : "أنشأت خطتها"} · {n.totalPages} وجه
                <span className="text-muted-foreground/60 mr-1">({timeAgoShort(n.createdAt)})</span>
              </p>
            </div>
            <button
              onClick={() => onDismiss(n.id)}
              className="p-1.5 rounded-lg hover:bg-teal-100 transition-colors shrink-0"
              title="تمييز كمقروء"
            >
              <CheckCircle2 className="w-4 h-4 text-teal-400 hover:text-teal-600" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function trackTypeLabel(t: string) {
  if (t === "girls") return "الفتيات";
  if (t === "simple_review") return "التثبيت";
  return t;
}

function ProgressRing({ day, total, color }: { day: number; total: number; color: string }) {
  const pct = Math.min(100, Math.round((day / total) * 100));
  const r = 14;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg width="36" height="36" viewBox="0 0 36 36" className="shrink-0">
      <circle cx="18" cy="18" r={r} fill="none" stroke="#e5e7eb" strokeWidth="3" />
      <circle
        cx="18" cy="18" r={r} fill="none" stroke={color} strokeWidth="3"
        strokeDasharray={`${dash} ${circ - dash}`}
        strokeDashoffset={circ / 4}
        strokeLinecap="round"
        style={{ transition: "stroke-dasharray 0.5s ease" }}
      />
      <text x="18" y="22" textAnchor="middle" fontSize="8" fontWeight="bold" fill={color}>
        {pct}%
      </text>
    </svg>
  );
}

function PlanCard({ s, onNavigate, onDownload, downloading }: {
  s: StudentWithPlan;
  onNavigate: (id: number) => void;
  onDownload: (id: number) => void;
  downloading: boolean;
}) {
  const { theme } = s;
  const remaining = s.cycleLength - s.dayInCycle;

  return (
    <div
      className="rounded-xl border p-3 space-y-2 hover:shadow-md transition-shadow cursor-pointer"
      style={{ borderColor: `${theme.primaryColor}33`, background: `${theme.secondaryColor}80` }}
      onClick={() => onNavigate(s.id)}
    >
      <div className="flex items-center gap-2">
        <ProgressRing day={s.dayInCycle} total={s.cycleLength} color={theme.primaryColor} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="text-sm font-bold truncate">{s.name}</p>
            {s.isCompletedEarly && (
              <Badge className="text-[9px] px-1.5 py-0 bg-emerald-100 text-emerald-700 border-emerald-200">
                متقدمة ⭐
              </Badge>
            )}
            {s.isCompleted && !s.isCompletedEarly && (
              <Badge className="text-[9px] px-1.5 py-0 bg-teal-100 text-teal-700 border-teal-200">
                تنتظر التجديد
              </Badge>
            )}
            {s.justRenewed && !s.isCompleted && !s.isCompletedEarly && (
              <Badge className="text-[9px] px-1.5 py-0 bg-blue-100 text-blue-700 border-blue-200">
                جددت مؤخرًا
              </Badge>
            )}
            {s.isStumbling && !s.isCompleted && !s.isCompletedEarly && (
              <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 border-amber-200">
                متعثرة
              </Badge>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground">
            {s.circleName} — {trackTypeLabel(s.trackType)}
          </p>
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDownload(s.id); }}
          disabled={downloading}
          className="p-1.5 rounded-lg hover:bg-white/60 transition-colors shrink-0"
          title="تحميل PDF"
        >
          {downloading
            ? <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
            : <Download className="w-3.5 h-3.5 text-muted-foreground" />
          }
        </button>
      </div>
      <div className="grid grid-cols-4 gap-1.5 text-center">
        <div className="rounded-lg bg-white/50 py-1.5">
          <p className="text-xs font-bold" style={{ color: theme.primaryColor }}>{s.dayInCycle}/{s.cycleLength}</p>
          <p className="text-[9px] text-muted-foreground">اليوم</p>
        </div>
        <div className="rounded-lg bg-white/50 py-1.5">
          <p className="text-xs font-bold" style={{ color: theme.primaryColor }}>{s.totalPages}</p>
          <p className="text-[9px] text-muted-foreground">وجه</p>
        </div>
        <div className="rounded-lg bg-white/50 py-1.5">
          <p className={`text-xs font-bold ${s.missedDaysLast30 >= 3 ? "text-rose-500" : ""}`}
            style={s.missedDaysLast30 >= 3 ? {} : { color: theme.primaryColor }}>
            {s.missedDaysLast30}
          </p>
          <p className="text-[9px] text-muted-foreground">تأخر</p>
        </div>
        <div className="rounded-lg bg-white/50 py-1.5">
          <p className="text-xs font-bold" style={{ color: theme.primaryColor }}>{s.cycleCount}</p>
          <p className="text-[9px] text-muted-foreground">دورة</p>
        </div>
      </div>
      {s.memorizedUpToSurah && (
        <p className="text-[10px] text-muted-foreground">
          حتى: <span className="font-medium">{s.memorizedUpToSurah}</span>
          {s.isCompleted
            ? <span className="text-emerald-600 font-medium"> · تنتظر التجديد</span>
            : remaining > 0
              ? <span> · باقي {remaining} يوم</span>
              : null
          }
        </p>
      )}
    </div>
  );
}

function NoPlanCard({ s, onNavigate }: { s: StudentWithoutPlan; onNavigate: (id: number) => void }) {
  return (
    <div
      className="rounded-xl border border-rose-200 bg-rose-50/60 p-3 flex items-center gap-3 hover:bg-rose-50 transition-colors cursor-pointer"
      onClick={() => onNavigate(s.id)}
    >
      <XCircle className="w-5 h-5 text-rose-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold truncate">{s.name}</p>
        <p className="text-[10px] text-muted-foreground">{s.circleName} — {trackTypeLabel(s.trackType)}</p>
      </div>
      <span className="text-[10px] text-rose-500 font-medium shrink-0">بدون خطة</span>
    </div>
  );
}

// ── Track Supervisor Detailed View — حلقة بحلقة مع أسماء الطالبات ─────────
function TrackSupervisorDetailView({ data, reload, loading, onNavigate }: {
  data: PlansData;
  reload: () => void;
  loading: boolean;
  onNavigate: (id: number) => void;
}) {
  const [expandedCircle, setExpandedCircle] = useState<number | null>(null);
  const byCircle = data.byCircle ?? [];

  const totalWithPlan = byCircle.reduce((s, c) => s + c.students.filter(st => st.hasPlan).length, 0);
  const totalWithoutPlan = byCircle.reduce((s, c) => s + c.students.filter(st => !st.hasPlan).length, 0);
  const totalStudents = totalWithPlan + totalWithoutPlan;
  const totalStumbling = byCircle.reduce((s, c) => s + c.students.filter(st => st.hasPlan && st.isStumbling).length, 0);
  const totalAdvanced = byCircle.reduce((s, c) => s + c.students.filter(st => st.hasPlan && st.isCompletedEarly).length, 0);

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">خطط المراجعة — مسار الفتيات</h1>
          <p className="text-xs text-muted-foreground mt-0.5">تفصيل حلقة بحلقة</p>
        </div>
        <button onClick={reload} disabled={loading} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-emerald-600">{totalAdvanced}</p>
            <p className="text-[10px] text-muted-foreground">متقدمة ⭐</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-blue-600">{totalWithPlan - totalStumbling - totalAdvanced}</p>
            <p className="text-[10px] text-muted-foreground">منتظمة ✅</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-amber-500">{totalStumbling}</p>
            <p className="text-[10px] text-muted-foreground">متعثرة ⚠️</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-rose-500">{totalWithoutPlan}</p>
            <p className="text-[10px] text-muted-foreground">بدون خطة</p>
          </CardContent>
        </Card>
      </div>

      {totalWithPlan > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">نسبة الالتزام</span>
              <span className="font-bold text-emerald-600">
                {Math.round(((totalAdvanced + totalWithPlan - totalStumbling - totalAdvanced) / totalWithPlan) * 100)}%
              </span>
            </div>
            <div className="bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${Math.round(((totalWithPlan - totalStumbling) / totalWithPlan) * 100)}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">إجمالي: {totalStudents} طالبة · لديهن خطة: {totalWithPlan}</p>
          </CardContent>
        </Card>
      )}

      {/* Per-circle detail */}
      <div className="space-y-3">
        {byCircle.map(circle => {
          const withPlan = circle.students.filter(s => s.hasPlan);
          const withoutPlan = circle.students.filter(s => !s.hasPlan);
          const stumbling = withPlan.filter(s => s.isStumbling && !s.isCompletedEarly);
          const advanced = withPlan.filter(s => s.isCompletedEarly);
          const isExpanded = expandedCircle === circle.circleId;

          return (
            <div key={circle.circleId} className="rounded-xl border border-border/60 overflow-hidden bg-card">
              <button
                className="w-full px-4 py-3 bg-muted/30 flex items-center justify-between hover:bg-muted/50 transition-colors"
                onClick={() => setExpandedCircle(isExpanded ? null : circle.circleId)}
              >
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-muted-foreground" />
                  <span className="font-bold text-sm">{circle.circleName}</span>
                  <span className="text-[11px] text-muted-foreground">({circle.students.length} طالبة)</span>
                </div>
                <div className="flex items-center gap-2">
                  {advanced.length > 0 && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">{advanced.length} ⭐</span>}
                  {stumbling.length > 0 && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">{stumbling.length} ⚠️</span>}
                  {withoutPlan.length > 0 && <span className="text-[10px] bg-rose-100 text-rose-700 px-1.5 py-0.5 rounded-full">{withoutPlan.length} بلا خطة</span>}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
              </button>

              {isExpanded && (
                <div className="divide-y divide-border/30">
                  {circle.students.map(st => (
                    <button
                      key={st.id}
                      onClick={() => onNavigate(st.id)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors text-right"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{st.name}</p>
                        {st.hasPlan && st.memorizedUpToSurah && (
                          <p className="text-[10px] text-muted-foreground">حتى: {st.memorizedUpToSurah}</p>
                        )}
                      </div>
                      {st.hasPlan ? (
                        <div className="flex items-center gap-2 shrink-0">
                          {st.isCompletedEarly && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full">متقدمة ⭐</span>}
                          {st.isCompleted && !st.isCompletedEarly && <span className="text-[10px] bg-teal-100 text-teal-700 px-1.5 py-0.5 rounded-full">تنتظر التجديد</span>}
                          {st.isStumbling && !st.isCompletedEarly && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full">متعثرة</span>}
                          <span className="text-[11px] text-muted-foreground font-medium">
                            {st.dayInCycle}/{st.cycleLength} ({st.pct}%)
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10px] text-rose-500 font-medium shrink-0">بدون خطة</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {byCircle.length === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground space-y-2">
          <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p>لا توجد حلقات في مسار الفتيات</p>
        </div>
      )}
    </div>
  );
}

// ── Stats View for leader ─────────────────────────────────────────────────────
type CategoryRow = { id: number; name: string; circleName: string; trackType: string };
type GroupStats = {
  key: string;
  label: string;
  advanced: CategoryRow[];
  committed: CategoryRow[];
  stumbling: CategoryRow[];
  withoutPlan: CategoryRow[];
};

function NamesList({ students, onNavigate, color }: {
  students: CategoryRow[];
  onNavigate: (id: number) => void;
  color: string;
}) {
  if (students.length === 0) return <p className="text-xs text-muted-foreground px-3 py-2">لا يوجد</p>;
  return (
    <div className="px-3 py-2 space-y-1">
      {students.map(s => (
        <button
          key={s.id}
          onClick={() => onNavigate(s.id)}
          className="w-full flex items-center gap-2 py-1.5 px-2 rounded-lg hover:bg-muted/60 transition-colors text-right"
        >
          <span className="text-sm font-medium flex-1 truncate">{s.name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">{s.circleName}</span>
        </button>
      ))}
    </div>
  );
}

function GroupCard({ group, onNavigate }: { group: GroupStats; onNavigate: (id: number) => void }) {
  const [expanded, setExpanded] = useState<"advanced" | "committed" | "stumbling" | "withoutPlan" | null>(null);
  const total = group.advanced.length + group.committed.length + group.stumbling.length + group.withoutPlan.length;

  return (
    <div className="rounded-xl border border-border/60 overflow-hidden bg-card">
      <div className="px-4 py-3 bg-muted/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="w-4 h-4 text-muted-foreground" />
          <span className="font-bold text-sm">{group.label}</span>
          <span className="text-[11px] text-muted-foreground">({total})</span>
        </div>
      </div>

      <div className="grid grid-cols-4 divide-x divide-x-reverse divide-border/60">
        {[
          { key: "advanced" as const, label: "متقدمة", count: group.advanced.length, color: "emerald", icon: "⭐" },
          { key: "committed" as const, label: "منتظمة", count: group.committed.length, color: "blue", icon: "✅" },
          { key: "stumbling" as const, label: "متعثرة", count: group.stumbling.length, color: "amber", icon: "⚠️" },
          { key: "withoutPlan" as const, label: "بدون خطة", count: group.withoutPlan.length, color: "rose", icon: "❌" },
        ].map(cat => (
          <button
            key={cat.key}
            onClick={() => setExpanded(expanded === cat.key ? null : cat.key)}
            className={`p-3 text-center transition-colors hover:bg-muted/40 ${expanded === cat.key ? "bg-muted/60" : ""}`}
          >
            <p className="text-lg font-black">{cat.count}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{cat.label}</p>
            <div className="mt-1 text-xs">{cat.icon}</div>
          </button>
        ))}
      </div>

      {expanded === "advanced" && group.advanced.length > 0 && (
        <div className="border-t border-border/50">
          <p className="text-xs font-semibold text-emerald-700 px-3 pt-2 pb-1">⭐ المتقدمات</p>
          <NamesList students={group.advanced} onNavigate={onNavigate} color="emerald" />
        </div>
      )}
      {expanded === "committed" && group.committed.length > 0 && (
        <div className="border-t border-border/50">
          <p className="text-xs font-semibold text-blue-700 px-3 pt-2 pb-1">✅ المنتظمات</p>
          <NamesList students={group.committed} onNavigate={onNavigate} color="blue" />
        </div>
      )}
      {expanded === "stumbling" && group.stumbling.length > 0 && (
        <div className="border-t border-border/50">
          <p className="text-xs font-semibold text-amber-700 px-3 pt-2 pb-1">⚠️ المتعثرات</p>
          <NamesList students={group.stumbling} onNavigate={onNavigate} color="amber" />
        </div>
      )}
      {expanded === "withoutPlan" && group.withoutPlan.length > 0 && (
        <div className="border-t border-border/50">
          <p className="text-xs font-semibold text-rose-700 px-3 pt-2 pb-1">❌ بدون خطة</p>
          <NamesList students={group.withoutPlan} onNavigate={onNavigate} color="rose" />
        </div>
      )}
    </div>
  );
}

function StatsView({ data, reload, loading, onNavigate }: {
  data: PlansData;
  reload: () => void;
  loading: boolean;
  onNavigate: (id: number) => void;
}) {
  const [groupBy, setGroupBy] = useState<"track" | "circle">("track");

  const advanced: CategoryRow[] = data.withPlan
    .filter(s => s.isCompletedEarly)
    .map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType }));

  const stumbling: CategoryRow[] = data.withPlan
    .filter(s => s.isStumbling && !s.isCompletedEarly)
    .map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType }));

  const committed: CategoryRow[] = data.withPlan
    .filter(s => !s.isStumbling && !s.isCompletedEarly)
    .map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType }));

  const withoutPlan: CategoryRow[] = data.withoutPlan
    .map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType }));

  const total = advanced.length + committed.length + stumbling.length + withoutPlan.length;
  const commitRate = (advanced.length + committed.length) > 0 && data.withPlan.length > 0
    ? Math.round(((advanced.length + committed.length) / data.withPlan.length) * 100)
    : 0;

  // Group by track or circle
  const groups: GroupStats[] = [];
  if (groupBy === "track") {
    const trackKeys = Array.from(new Set([
      ...data.withPlan.map(s => s.track || trackTypeLabel(s.trackType)),
      ...data.withoutPlan.map(s => s.track || trackTypeLabel(s.trackType)),
    ]));
    for (const t of trackKeys) {
      const filter = (s: { track: string; trackType: string }) => (s.track || trackTypeLabel(s.trackType)) === t;
      groups.push({
        key: t,
        label: t,
        advanced: data.withPlan.filter(s => s.isCompletedEarly && filter(s)).map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType })),
        committed: data.withPlan.filter(s => !s.isStumbling && !s.isCompletedEarly && filter(s)).map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType })),
        stumbling: data.withPlan.filter(s => s.isStumbling && !s.isCompletedEarly && filter(s)).map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType })),
        withoutPlan: data.withoutPlan.filter(s => filter(s)).map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType })),
      });
    }
  } else {
    const circleKeys = Array.from(new Map([
      ...data.withPlan.map(s => [s.circleId, s.circleName] as [number, string]),
      ...data.withoutPlan.map(s => [s.circleId, s.circleName] as [number, string]),
    ]));
    for (const [cid, cname] of circleKeys) {
      groups.push({
        key: String(cid),
        label: cname,
        advanced: data.withPlan.filter(s => s.circleId === cid && s.isCompletedEarly).map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType })),
        committed: data.withPlan.filter(s => s.circleId === cid && !s.isStumbling && !s.isCompletedEarly).map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType })),
        stumbling: data.withPlan.filter(s => s.circleId === cid && s.isStumbling && !s.isCompletedEarly).map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType })),
        withoutPlan: data.withoutPlan.filter(s => s.circleId === cid).map(s => ({ id: s.id, name: s.name, circleName: s.circleName, trackType: s.trackType })),
      });
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold">إحصائيات خطة المراجعة</h1>
          <p className="text-xs text-muted-foreground mt-0.5">مسار الفتيات فقط</p>
        </div>
        <button onClick={reload} disabled={loading} className="p-2 rounded-xl hover:bg-muted transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-emerald-600">{advanced.length}</p>
            <p className="text-[10px] text-muted-foreground">متقدمة</p>
            <p className="text-xs">⭐</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-blue-600">{committed.length}</p>
            <p className="text-[10px] text-muted-foreground">منتظمة</p>
            <p className="text-xs">✅</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-amber-500">{stumbling.length}</p>
            <p className="text-[10px] text-muted-foreground">متعثرة</p>
            <p className="text-xs">⚠️</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-rose-500">{withoutPlan.length}</p>
            <p className="text-[10px] text-muted-foreground">بدون خطة</p>
            <p className="text-xs">❌</p>
          </CardContent>
        </Card>
      </div>

      {/* Commitment bar */}
      {data.withPlan.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">نسبة الالتزام (منتظمة + متقدمة)</span>
              <span className="font-bold text-emerald-600">{commitRate}%</span>
            </div>
            <div className="bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${commitRate}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground">
              إجمالي: {total} طالبة · لديهن خطة: {data.withPlan.length}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Group by toggle */}
      {total > 0 && (
        <div className="grid grid-cols-2 gap-1 p-1 bg-muted rounded-xl">
          {([["track", "بحسب المسار"], ["circle", "بحسب الحلقة"]] as const).map(([v, label]) => (
            <button
              key={v}
              onClick={() => setGroupBy(v)}
              className={`py-2 rounded-lg text-sm font-semibold transition-all ${groupBy === v ? "bg-background shadow text-foreground" : "text-muted-foreground"}`}
            >
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Groups */}
      <div className="space-y-3">
        {groups.map(g => (
          <GroupCard key={g.key} group={g} onNavigate={onNavigate} />
        ))}
      </div>

      {total === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground space-y-2">
          <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p>لا توجد طالبات في مسار الفتيات</p>
        </div>
      )}
    </div>
  );
}

// ── Arabic day abbreviation ───────────────────────────────────────────────
function dayAbbr(dateStr: string): string {
  const d = new Date(dateStr).getDay();
  return ["أحد", "اثن", "ثلا", "أرب", "خمس", "ج", "سبت"][d] ?? "";
}

// ── Weekly Report View ────────────────────────────────────────────────────
function WeeklyReportView({ data, onNavigate }: { data: PlansData; onNavigate: (id: number) => void }) {
  const students = data.withPlan.filter(s => s.weeklyProgress);
  if (!students.length) {
    return (
      <div className="text-center py-16 text-sm text-muted-foreground space-y-2">
        <BarChart2 className="w-10 h-10 text-muted-foreground/40 mx-auto" />
        <p>لا توجد بيانات أسبوعية</p>
      </div>
    );
  }

  const weekDates = students[0].weekDates ?? students[0].weeklyProgress!.map(d => d.date);

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <h2 className="text-base font-bold">تقرير الأسبوع الجاري</h2>
      <p className="text-xs text-muted-foreground -mt-3">آخر 6 أيام عمل • ✓ حقّقت النصاب · ✗ لم تحقّق · — غياب · · لا سجل</p>

      {/* Legend */}
      <div className="flex gap-4 text-xs flex-wrap">
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[10px] font-bold">✓</span> حققت النصاب</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center text-[10px] font-bold">✗</span> لم تحقق</span>
        <span className="flex items-center gap-1"><span className="w-4 h-4 rounded-full bg-gray-100 text-gray-400 flex items-center justify-center text-[10px]">—</span> غياب</span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="bg-muted/40">
              <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground w-28 sticky right-0 bg-muted/40">الطالبة</th>
              {weekDates.map(date => (
                <th key={date} className="text-center px-2 py-2.5 font-semibold text-muted-foreground min-w-[44px]">
                  <div>{dayAbbr(date)}</div>
                  <div className="text-[9px] font-normal opacity-60">{date.slice(5)}</div>
                </th>
              ))}
              <th className="text-center px-2 py-2.5 font-semibold text-muted-foreground min-w-[44px]">الأسبوع</th>
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => {
              const wp = s.weeklyProgress!;
              const achievedDays = wp.filter(d => d.hasRecord && !d.absent && d.actual >= d.planned * 0.8).length;
              const totalDays = wp.filter(d => d.hasRecord && !d.absent).length;
              const weekRate = totalDays > 0 ? Math.round((achievedDays / totalDays) * 100) : null;

              return (
                <tr
                  key={s.id}
                  onClick={() => onNavigate(s.id)}
                  className={`border-t border-border/40 cursor-pointer hover:bg-muted/30 transition-colors ${i % 2 === 0 ? "" : "bg-muted/10"}`}
                >
                  <td className={`px-3 py-2.5 sticky right-0 ${i % 2 === 0 ? "bg-background" : "bg-muted/10"} border-l border-border/30`}>
                    <div className="font-semibold truncate max-w-[100px]">{s.name}</div>
                    {s.isStumbling && <div className="text-rose-500 text-[9px]">متعثرة</div>}
                    {s.isCompletedEarly && <div className="text-emerald-600 text-[9px]">متقدمة ⭐</div>}
                  </td>
                  {wp.map(day => {
                    let icon = "·";
                    let cls = "text-gray-300";
                    if (day.hasRecord) {
                      if (day.absent) { icon = "—"; cls = "text-gray-400"; }
                      else if (day.actual >= day.planned * 0.8) { icon = "✓"; cls = "text-emerald-600 bg-emerald-50 rounded-full"; }
                      else { icon = "✗"; cls = "text-rose-500 bg-rose-50 rounded-full"; }
                    }
                    return (
                      <td key={day.date} className="text-center px-1 py-2">
                        <span className={`inline-flex w-7 h-7 items-center justify-center font-bold text-[11px] ${cls}`}>
                          {icon}
                        </span>
                        {day.hasRecord && !day.absent && (
                          <div className="text-[8px] text-muted-foreground leading-none mt-0.5">
                            {day.actual}/{day.planned}
                          </div>
                        )}
                      </td>
                    );
                  })}
                  <td className="text-center px-2 py-2">
                    {weekRate !== null ? (
                      <span className={`text-xs font-bold ${weekRate >= 80 ? "text-emerald-600" : weekRate >= 50 ? "text-amber-500" : "text-rose-500"}`}>
                        {weekRate}%
                      </span>
                    ) : <span className="text-gray-300 text-xs">—</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Weekly summary bar */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-3 space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">ملخص الأسبوع</p>
          {weekDates.map(date => {
            const dayStudents = data.withPlan.filter(s => s.weeklyProgress?.some(d => d.date === date && d.hasRecord));
            const achieved = data.withPlan.filter(s => {
              const d = s.weeklyProgress?.find(dp => dp.date === date);
              return d?.hasRecord && !d.absent && d.actual >= d.planned * 0.8;
            }).length;
            const total = data.withPlan.filter(s => {
              const d = s.weeklyProgress?.find(dp => dp.date === date);
              return d?.hasRecord && !d.absent;
            }).length;
            if (total === 0) return null;
            const pct = Math.round((achieved / total) * 100);
            return (
              <div key={date} className="space-y-0.5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] text-muted-foreground">{dayAbbr(date)} {date.slice(5)}</span>
                  <span className={`text-[10px] font-bold ${pct >= 80 ? "text-emerald-600" : pct >= 50 ? "text-amber-500" : "text-rose-500"}`}>
                    {achieved}/{total} ({pct}%)
                  </span>
                </div>
                <div className="bg-muted rounded-full h-1.5 overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-400" : "bg-rose-400"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          }).filter(Boolean)}
        </CardContent>
      </Card>
    </div>
  );
}

// ── Cards view for teacher/supervisor ──────────────────────────────────────
function CardsView({ data, reload, onNavigate, downloadingId, downloadPDF, teacherNotifs, onDismissNotif }: {
  data: PlansData;
  reload: () => void;
  onNavigate: (id: number) => void;
  downloadingId: number | null;
  downloadPDF: (id: number) => void;
  teacherNotifs?: TeacherNotif[];
  onDismissNotif?: (id: number) => void;
}) {
  const [circleFilter, setCircleFilter] = useState("all");
  const [trackFilter, setTrackFilter] = useState("all");
  const [showNoPlan, setShowNoPlan] = useState(true);
  const [showWithPlan, setShowWithPlan] = useState(true);
  const [view, setView] = useState<"cards" | "weekly">("cards");

  const allCircles = Array.from(
    new Map<string, string>([
      ...(data.withPlan).map(s => [s.circleName, s.circleName] as [string, string]),
      ...(data.withoutPlan).map(s => [s.circleName, s.circleName] as [string, string]),
    ])
  );

  const filteredWithPlan = data.withPlan.filter(s =>
    (circleFilter === "all" || s.circleName === circleFilter) &&
    (trackFilter === "all" || s.trackType === trackFilter)
  );
  const filteredWithoutPlan = data.withoutPlan.filter(s =>
    (circleFilter === "all" || s.circleName === circleFilter) &&
    (trackFilter === "all" || s.trackType === trackFilter)
  );

  const advanced = filteredWithPlan.filter(s => s.isCompletedEarly).length;
  const stumbling = filteredWithPlan.filter(s => s.isStumbling && !s.isCompletedEarly).length;
  const committed = filteredWithPlan.filter(s => !s.isStumbling && !s.isCompletedEarly).length;
  const total = filteredWithPlan.length + filteredWithoutPlan.length;

  if (view === "weekly") {
    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-foreground">خطط المراجعة</h1>
            <p className="text-xs text-muted-foreground mt-0.5">حلقتي — مسار الفتيات</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={reload} className="p-2 rounded-xl hover:bg-muted transition-colors">
              <RefreshCw className="w-4 h-4 text-muted-foreground" />
            </button>
            <button onClick={() => setView("cards")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-muted hover:bg-muted/80 transition-colors text-xs font-medium">
              <Users className="w-3.5 h-3.5" /> بطاقات
            </button>
          </div>
        </div>
        <WeeklyReportView data={data} onNavigate={onNavigate} />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      {teacherNotifs && teacherNotifs.length > 0 && onDismissNotif && (
        <TeacherNotifBanner notifs={teacherNotifs} onDismiss={onDismissNotif} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">خطط المراجعة</h1>
          <p className="text-xs text-muted-foreground mt-0.5">حلقتي — مسار الفتيات</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={reload} className="p-2 rounded-xl hover:bg-muted transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
          <button onClick={() => setView("weekly")} className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors text-xs font-medium text-primary">
            <BarChart2 className="w-3.5 h-3.5" /> تقرير الأسبوع
          </button>
        </div>
      </div>

      <div className="grid grid-cols-4 gap-2">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-emerald-600">{advanced}</p>
            <p className="text-[10px] text-muted-foreground">متقدمة ⭐</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-blue-600">{committed}</p>
            <p className="text-[10px] text-muted-foreground">منتظمة ✅</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-amber-500">{stumbling}</p>
            <p className="text-[10px] text-muted-foreground">متعثرة ⚠️</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 text-center">
            <p className="text-xl font-black text-rose-500">{filteredWithoutPlan.length}</p>
            <p className="text-[10px] text-muted-foreground">بدون خطة</p>
          </CardContent>
        </Card>
      </div>

      {filteredWithPlan.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground font-medium">نسبة الالتزام</span>
              <span className="font-bold text-emerald-600">
                {Math.round(((advanced + committed) / filteredWithPlan.length) * 100)}%
              </span>
            </div>
            <div className="bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all duration-700"
                style={{ width: `${Math.round(((advanced + committed) / filteredWithPlan.length) * 100)}%` }}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {total > 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 space-y-2">
            <div className="flex gap-2 flex-wrap">
              <div className="flex-1 min-w-28">
                <p className="text-[10px] text-muted-foreground mb-1">المسار</p>
                <select className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background" value={trackFilter} onChange={e => setTrackFilter(e.target.value)}>
                  <option value="all">الكل</option>
                  <option value="girls">الفتيات</option>
                </select>
              </div>
              {allCircles.length > 1 && (
                <div className="flex-1 min-w-28">
                  <p className="text-[10px] text-muted-foreground mb-1">الحلقة</p>
                  <select className="w-full border rounded-lg px-2 py-1.5 text-xs bg-background" value={circleFilter} onChange={e => setCircleFilter(e.target.value)}>
                    <option value="all">الكل</option>
                    {allCircles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {filteredWithoutPlan.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowNoPlan(v => !v)} className="w-full flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <XCircle className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-bold text-rose-600">بدون خطة ({filteredWithoutPlan.length})</h2>
            </div>
            {showNoPlan ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showNoPlan && (
            <div className="space-y-2">
              {filteredWithoutPlan.map(s => (
                <NoPlanCard key={s.id} s={s} onNavigate={onNavigate} />
              ))}
            </div>
          )}
        </div>
      )}

      {filteredWithPlan.length > 0 && (
        <div className="space-y-2">
          <button onClick={() => setShowWithPlan(v => !v)} className="w-full flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <h2 className="text-sm font-bold text-foreground">لديهن خطة ({filteredWithPlan.length})</h2>
              {advanced > 0 && <Badge className="text-[9px] bg-emerald-100 text-emerald-700 border-emerald-200">{advanced} متقدمة</Badge>}
            </div>
            {showWithPlan ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          {showWithPlan && (() => {
            const sorted = [
              ...filteredWithPlan.filter(s => s.isCompletedEarly),
              ...filteredWithPlan.filter(s => !s.isCompletedEarly && s.isStumbling),
              ...filteredWithPlan.filter(s => !s.isCompletedEarly && !s.isStumbling),
            ];
            return (
              <div className="space-y-2">
                {sorted.map(s => (
                  <PlanCard key={s.id} s={s} onNavigate={onNavigate} onDownload={downloadPDF} downloading={downloadingId === s.id} />
                ))}
              </div>
            );
          })()}
        </div>
      )}

      {total === 0 && (
        <div className="text-center py-16 text-sm text-muted-foreground space-y-2">
          <BookOpen className="w-10 h-10 text-muted-foreground/40 mx-auto" />
          <p>لا توجد طالبات في مسار الفتيات</p>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function ReviewPlansPage() {
  const [, setLocation] = useLocation();
  const { data: user } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });
  const { data, loading, error, reload } = useStudentsPlans();
  const [downloadingId, setDownloadingId] = useState<number | null>(null);
  const role = user?.role ?? "";
  const { visible: teacherNotifs, dismiss: dismissTeacherNotif } = useTeacherNotifications(role);

  async function downloadPDF(studentId: number) {
    setDownloadingId(studentId);
    try {
      const token = getToken();
      const res = await fetch(`${BASE}/api/students/${studentId}/review-plan`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const plan = await res.json();
      openPlanPDF(plan);
    } catch {
      // fallback — nothing
    } finally {
      setDownloadingId(null);
    }
  }

  const navigateToStudent = (id: number) => setLocation(`/students/${id}`);

  // Students see their own plan directly on this page
  if (user?.role === "student") {
    const sid = (user as any).studentId;
    return (
      <div className="p-4 max-w-2xl mx-auto">
        {sid ? <StudentReviewPlanView studentId={sid} /> : (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <BookOpen className="w-8 h-8 mx-auto mb-3 text-muted-foreground/40" />
            لا يوجد سجل طالبة مرتبط بحسابك
          </div>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12 text-sm text-muted-foreground">
        <AlertTriangle className="w-8 h-8 text-rose-400 mx-auto mb-3" />
        تعذّر تحميل البيانات
        <br />
        <button onClick={reload} className="mt-3 text-primary underline text-xs">إعادة المحاولة</button>
      </div>
    );
  }

  if (!data) return null;

  if (role === "track_supervisor") {
    return (
      <TrackSupervisorDetailView
        data={data}
        reload={reload}
        loading={loading}
        onNavigate={navigateToStudent}
      />
    );
  }

  if (role === "leader") {
    return (
      <StatsView
        data={data}
        reload={reload}
        loading={loading}
        onNavigate={navigateToStudent}
      />
    );
  }

  return (
    <CardsView
      data={data}
      reload={reload}
      onNavigate={navigateToStudent}
      downloadingId={downloadingId}
      teacherNotifs={teacherNotifs}
      onDismissNotif={dismissTeacherNotif}
      downloadPDF={downloadPDF}
    />
  );
}
