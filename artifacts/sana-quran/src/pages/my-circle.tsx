import { useState, useEffect } from "react";
import { useListStudents, useGetCurrentUser, useListRecords } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Archive, BookOpen, AlertTriangle, CheckCircle2, Download, Loader2, ChevronDown, ChevronUp, TrendingUp } from "lucide-react";
import { formatPages } from "@/lib/quran";
import MessagesSection from "@/components/MessagesSection";

type DayPerf = { dayNumber: number; date: string; exceeded: boolean; completed: boolean; partial: boolean; absent: boolean; actual: number; planned: number };
type PlanEntry = { dayNumber: number; surahStart: string; ayahStart: number; surahEnd: string; ayahEnd: number; pages: number };
type StudentPlanDetail = {
  studentId: number; studentName: string; totalPages: number; cycleLength: number; cycleCount: number;
  dayInCycle: number; currentCycleStart: string; planEntries: PlanEntry[];
  dayPerformance: DayPerf[]; missedDaysLast30: number; isStumbling: boolean; trackType?: string;
};

const AR_DOW = ["الأحد","الاثنين","الثلاثاء","الأربعاء","الخميس","الجمعة","السبت"];
function fmtDate(d: string) {
  const js = new Date(d + "T00:00:00");
  return `${AR_DOW[js.getDay()]} ${js.toLocaleDateString("ar-SA",{day:"numeric",month:"short"})}`;
}
function statusIcon(d: DayPerf | undefined, isToday: boolean, isFuture: boolean) {
  if (isFuture) return <span className="text-muted-foreground text-xs">—</span>;
  if (!d) return <span className="text-muted-foreground text-xs">—</span>;
  if (d.absent) return <span className="text-gray-400 font-bold text-sm">غ</span>;
  if (d.exceeded) return <span className="text-blue-600 font-bold text-sm">↑</span>;
  if (d.completed) return <span className="text-emerald-600 font-bold text-sm">✓</span>;
  if (d.partial) return <span className="text-amber-500 font-bold text-sm">≈</span>;
  return <span className="text-rose-500 font-bold text-sm">✗</span>;
}
function rowBg(d: DayPerf | undefined, isToday: boolean) {
  if (isToday) return "bg-primary/5 font-semibold";
  if (!d) return "";
  if (d.absent) return "bg-gray-50";
  if (d.exceeded) return "bg-blue-50";
  if (d.completed) return "bg-emerald-50/60";
  if (d.partial) return "bg-amber-50";
  return "bg-rose-50";
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function isOnLeave(student: any): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (!student.leaveStart) return false;
  if (student.leaveStart <= today && (!student.leaveEnd || student.leaveEnd >= today)) return true;
  return false;
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("auth_token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

type CirclePlanEntry = {
  studentId: number;
  studentName: string;
  planType: string;
  cycleCount: number;
  dayInCycle: number;
  totalPages: number;
  missedDaysLast30: number;
  isStumbling: boolean;
  memorizedUpToSurah?: string;
  memorizedUpToAyah?: number;
  theme?: { primaryColor: string; secondaryColor: string };
};

export default function MyCirclePage() {
  const [showArchived, setShowArchived] = useState(false);
  const [circlePlans, setCirclePlans] = useState<CirclePlanEntry[] | null>(null);
  const [plansLoading, setPlansLoading] = useState(false);
  const [showPlans, setShowPlans] = useState(false);
  const [expandedPlanId, setExpandedPlanId] = useState<number | null>(null);
  const [planDetails, setPlanDetails] = useState<Record<number, StudentPlanDetail | "loading" | "error">>({});
  const { data: user } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });
  const circleId = user?.circleId ?? undefined;
  const trackType: string = (user as any)?.trackType ?? "";

  const { data: students } = useListStudents(
    circleId ? { circleId } : undefined,
    { query: { queryKey: ["students", circleId], enabled: !!circleId } }
  );
  const { data: archivedStudents } = useListStudents(
    circleId ? { circleId, isArchived: true } : undefined,
    { query: { queryKey: ["students-archived", circleId], enabled: !!circleId } }
  );
  const { data: records } = useListRecords(
    circleId ? { circleId } : undefined,
    { query: { queryKey: ["records", circleId], enabled: !!circleId } }
  );

  const showPlanSection = trackType === "girls" || trackType === "simple_review";

  const fetchPlanDetail = async (studentId: number) => {
    if (planDetails[studentId]) {
      setExpandedPlanId(prev => prev === studentId ? null : studentId);
      return;
    }
    setExpandedPlanId(studentId);
    setPlanDetails(d => ({ ...d, [studentId]: "loading" }));
    try {
      const res = await fetch(`${BASE}/api/students/${studentId}/review-plan`, { headers: authHeader() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const plan = circlePlans?.find(p => p.studentId === studentId);
      setPlanDetails(d => ({ ...d, [studentId]: { ...data, studentId, studentName: plan?.studentName ?? "" } }));
    } catch {
      setPlanDetails(d => ({ ...d, [studentId]: "error" }));
    }
  };

  useEffect(() => {
    if (!showPlans || !circleId || !showPlanSection) return;
    if (circlePlans !== null) return;
    setPlansLoading(true);
    fetch(`${BASE}/api/circles/${circleId}/review-plans`, { headers: authHeader() })
      .then(r => r.json())
      .then(data => { setCirclePlans(Array.isArray(data) ? data : []); })
      .catch(() => setCirclePlans([]))
      .finally(() => setPlansLoading(false));
  }, [showPlans, circleId, showPlanSection, circlePlans]);

  // Get latest record per student
  const latestByStudent: Record<number, any> = {};
  records?.forEach(r => {
    const existing = latestByStudent[r.studentId];
    if (!existing || r.date > existing.date) {
      latestByStudent[r.studentId] = r;
    }
  });

  const totalMemorize = Object.values(latestByStudent).reduce((s, r) => s + (r.memorizePages ?? 0), 0);
  const totalAbsent = Object.values(latestByStudent).filter(r => r.isAbsent).length;
  const studentsOnLeave = (students ?? []).filter(s => isOnLeave(s)).length;

  function printCirclePlans() {
    if (!circlePlans || !circlePlans.length) return;
    const rows = circlePlans.map(p => `
      <tr style="border-bottom:1px solid #e5e7eb;">
        <td style="padding:8px 12px;font-weight:600;">${p.studentName}</td>
        <td style="padding:8px 12px;text-align:center;">${p.cycleCount}</td>
        <td style="padding:8px 12px;text-align:center;">${p.dayInCycle} / 21</td>
        <td style="padding:8px 12px;text-align:center;">${p.totalPages}</td>
        <td style="padding:8px 12px;text-align:center;color:${p.isStumbling ? "#dc2626" : "#16a34a"};">
          ${p.isStumbling ? "⚠ متعثرة" : "✓ منتظمة"}
        </td>
        <td style="padding:8px 12px;text-align:center;color:${p.missedDaysLast30 >= 3 ? "#dc2626" : "#374151"};">
          ${p.missedDaysLast30}
        </td>
      </tr>`).join("");
    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <style>
        body { font-family: Arial, sans-serif; padding: 24px; }
        h1 { font-size: 20px; margin-bottom: 4px; }
        p { color: #6b7280; font-size: 13px; margin: 0 0 16px; }
        table { width: 100%; border-collapse: collapse; font-size: 13px; }
        th { background: #f3f4f6; padding: 10px 12px; text-align: right; font-weight: 700; color: #374151; border-bottom: 2px solid #e5e7eb; }
        @media print { body { padding: 12px; } }
      </style></head><body>
      <h1>خطط المراجعة — حلقة ${(user as any)?.circle ?? ""}</h1>
      <p>تاريخ الطباعة: ${new Date().toLocaleDateString("ar-SA")}</p>
      <table><thead><tr>
        <th>الاسم</th><th>رقم الدورة</th><th>يوم الدورة</th><th>إجمالي الأوجه</th><th>الانتظام</th><th>أيام التأخر (30ي)</th>
      </tr></thead><tbody>${rows}</tbody></table>
    </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => { w.print(); }, 400);
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">حلقتي</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {user?.name} · {(user as any)?.track ?? ""}
        </p>
      </div>

      {/* Messages from leader */}
      <MessagesSection />

      {/* Quick stats */}
      <div className={`grid gap-4 ${studentsOnLeave > 0 ? "grid-cols-4" : "grid-cols-3"}`}>
        <Card className="border-0 shadow-sm" data-testid="card-my-students">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-primary">{students?.length ?? 0}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">الطالبات</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm" data-testid="card-my-memorize">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-teal-600">{formatPages(totalMemorize)}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">أوجه الحفظ</p>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm" data-testid="card-my-absences">
          <CardContent className="p-4 text-center">
            <p className="text-3xl font-bold text-rose-500">{totalAbsent}</p>
            <p className="text-xs text-muted-foreground mt-1 font-medium">الغائبات</p>
          </CardContent>
        </Card>
        {studentsOnLeave > 0 && (
          <Card className="border-0 shadow-sm bg-amber-50 border-amber-100">
            <CardContent className="p-4 text-center">
              <p className="text-3xl font-bold text-amber-600">{studentsOnLeave}</p>
              <p className="text-xs text-amber-700 mt-1 font-medium">في إجازة</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Students list */}
      <Card className="border-0 shadow-sm" data-testid="card-students-list">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              الطالبات
            </CardTitle>
            {(archivedStudents?.length ?? 0) > 0 && (user?.role === "leader" || user?.role === "track_supervisor") && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground gap-1"
                onClick={() => setShowArchived(v => !v)}
              >
                <Archive className="w-3.5 h-3.5" />
                المؤرشفات ({archivedStudents?.length})
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {!students || students.length === 0 ? (
            <p className="text-center py-8 text-muted-foreground text-sm">لا توجد طالبات في هذه الحلقة</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الاسم</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الحفظ</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">المراجعة</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الدرجة</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {students.map(student => {
                    const record = latestByStudent[student.id];
                    const onLeave = isOnLeave(student);
                    return (
                      <tr key={student.id}
                        className={`border-b border-border/50 transition-colors ${onLeave ? "bg-amber-50/50" : "hover:bg-muted/30"}`}
                        data-testid={`row-student-${student.id}`}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{student.fullName}</span>
                            {onLeave && (
                              <Badge className="bg-amber-100 text-amber-700 border-0 text-xs px-1.5">إجازة</Badge>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-4 text-teal-600 font-medium">
                          {formatPages(record?.memorizePages)}
                        </td>
                        <td className="py-3 px-4 text-blue-600 font-medium">
                          {formatPages((record?.reviewNearPages ?? 0) + (record?.reviewFarPages ?? 0))}
                        </td>
                        <td className="py-3 px-4 text-muted-foreground text-xs">
                          {record?.grade ?? "—"}
                        </td>
                        <td className="py-3 px-4">
                          {onLeave ? (
                            <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">في إجازة</Badge>
                          ) : record?.isAbsent ? (
                            <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">غائبة</Badge>
                          ) : record ? (
                            <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">حاضرة</Badge>
                          ) : (
                            <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">لا يوجد</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Review Plans Section — teacher/supervisor for girls/simple_review tracks */}
      {showPlanSection && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-emerald-600" />
                خطط المراجعة
              </CardTitle>
              <div className="flex items-center gap-2">
                {showPlans && circlePlans && circlePlans.length > 0 && (
                  <Button variant="ghost" size="sm" className="text-xs gap-1" onClick={printCirclePlans}>
                    <Download className="w-3.5 h-3.5" />
                    طباعة
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs"
                  onClick={() => setShowPlans(v => !v)}
                >
                  {showPlans ? "إخفاء" : "عرض الخطط"}
                </Button>
              </div>
            </div>
          </CardHeader>
          {showPlans && (
            <CardContent>
              {plansLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                </div>
              ) : !circlePlans || circlePlans.length === 0 ? (
                <p className="text-center py-6 text-muted-foreground text-sm">لا توجد خطط مراجعة نشطة في هذه الحلقة</p>
              ) : (
                <div className="space-y-3">
                  {circlePlans.map(plan => {
                    const isExpanded = expandedPlanId === plan.studentId;
                    const detail = planDetails[plan.studentId];
                    return (
                      <div
                        key={plan.studentId}
                        className="rounded-xl border border-border/60 overflow-hidden"
                        style={plan.theme ? { borderColor: plan.theme.primaryColor + "40" } : {}}
                      >
                        {/* Summary row */}
                        <div
                          className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/20 transition-colors"
                          style={plan.theme ? { background: plan.theme.secondaryColor + "60" } : {}}
                          onClick={() => fetchPlanDetail(plan.studentId)}
                        >
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-sm truncate">{plan.studentName}</p>
                            <p className="text-xs text-muted-foreground mt-0.5">
                              دورة {plan.cycleCount} · يوم {plan.dayInCycle}/21
                              {plan.memorizedUpToSurah && ` · حتى ${plan.memorizedUpToSurah}`}
                            </p>
                          </div>
                          <div className="text-center shrink-0">
                            <p className="text-base font-bold" style={plan.theme ? { color: plan.theme.primaryColor } : {}}>
                              {plan.totalPages}
                            </p>
                            <p className="text-[10px] text-muted-foreground">وجه</p>
                          </div>
                          <div className="text-center shrink-0">
                            {plan.isStumbling ? (
                              <div className="flex items-center gap-1 text-rose-600">
                                <AlertTriangle className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">متعثرة</span>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 text-emerald-600">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                <span className="text-xs font-semibold">منتظمة</span>
                              </div>
                            )}
                            <p className="text-[10px] text-muted-foreground mt-0.5">{plan.missedDaysLast30} يوم تأخر</p>
                          </div>
                          <button className="shrink-0 text-muted-foreground hover:text-primary transition-colors">
                            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                          </button>
                        </div>

                        {/* Expanded detail table */}
                        {isExpanded && (
                          <div className="border-t border-border/40">
                            {detail === "loading" ? (
                              <div className="flex items-center justify-center py-6">
                                <Loader2 className="w-4 h-4 animate-spin text-primary mr-2" />
                                <span className="text-xs text-muted-foreground">جاري التحميل...</span>
                              </div>
                            ) : detail === "error" ? (
                              <p className="text-xs text-rose-600 text-center py-4">تعذر تحميل التفاصيل</p>
                            ) : detail ? (
                              <div className="p-3">
                                {/* Progress strip */}
                                {detail.dayPerformance.length > 0 && (
                                  <div className="mb-3">
                                    <p className="text-[10px] text-muted-foreground mb-1 flex items-center gap-1">
                                      <TrendingUp className="w-3 h-3" /> أداء الدورة
                                      <span className="mr-auto text-[10px]">
                                        <span className="text-emerald-600 font-bold">{detail.dayPerformance.filter(d=>d.completed||d.exceeded).length}</span>/{detail.dayPerformance.length} يوم مكتمل
                                      </span>
                                    </p>
                                    <div className="flex gap-0.5 h-2">
                                      {detail.planEntries.map((e, idx) => {
                                        const perf = detail.dayPerformance.find(d => d.dayNumber === e.dayNumber);
                                        const isToday = idx === detail.dayInCycle - 1;
                                        const bg = !perf ? (isToday ? "#6366f1" : "#e5e7eb")
                                          : perf.absent ? "#d1d5db"
                                          : perf.exceeded ? "#3b82f6"
                                          : perf.completed ? "#22c55e"
                                          : perf.partial ? "#f59e0b"
                                          : "#f43f5e";
                                        return <div key={e.dayNumber} className="flex-1 rounded-sm" style={{ background: bg }} />;
                                      })}
                                    </div>
                                    <div className="flex gap-3 mt-1 text-[9px] text-muted-foreground">
                                      {[["#22c55e","مكتمل"],["#f59e0b","جزئي"],["#f43f5e","ناقص"],["#d1d5db","غياب"],["#3b82f6","متقدمة"],["#6366f1","اليوم"]].map(([c,l])=>(
                                        <span key={l} className="flex items-center gap-0.5">
                                          <span className="w-2 h-2 rounded-sm inline-block" style={{background:c}} />{l}
                                        </span>
                                      ))}
                                    </div>
                                  </div>
                                )}
                                {/* Day table */}
                                <div className="overflow-x-auto rounded-lg border border-border/40">
                                  <table className="w-full text-xs min-w-[380px]">
                                    <thead className="bg-muted/50">
                                      <tr>
                                        <th className="py-2 px-2 text-right font-semibold text-muted-foreground w-8">يوم</th>
                                        <th className="py-2 px-2 text-right font-semibold text-muted-foreground">التاريخ</th>
                                        <th className="py-2 px-2 text-right font-semibold text-muted-foreground">النطاق</th>
                                        <th className="py-2 px-2 text-center font-semibold text-muted-foreground w-12">مخطط</th>
                                        <th className="py-2 px-2 text-center font-semibold text-muted-foreground w-12">فعلي</th>
                                        <th className="py-2 px-2 text-center font-semibold text-muted-foreground w-8">حالة</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detail.planEntries.map((entry, idx) => {
                                        const isToday = idx === detail.dayInCycle - 1;
                                        const isFuture = idx > detail.dayInCycle - 1;
                                        const perf = detail.dayPerformance.find(d => d.dayNumber === entry.dayNumber);
                                        const dayDate = (() => {
                                          let count = 0;
                                          const cur = new Date(detail.currentCycleStart);
                                          const isFixation = detail.trackType === "fixation";
                                          while (true) {
                                            const dow = cur.getDay();
                                            const working = isFixation ? [0,1,2,3].includes(dow) : dow !== 5;
                                            if (working) { count++; if (count === entry.dayNumber) return cur.toISOString().slice(0,10); }
                                            cur.setDate(cur.getDate()+1);
                                          }
                                        })();
                                        const range = entry.surahStart === entry.surahEnd
                                          ? `${entry.surahStart} (${entry.ayahStart}–${entry.ayahEnd})`
                                          : `${entry.surahStart} ${entry.ayahStart} ← ${entry.surahEnd} ${entry.ayahEnd}`;
                                        return (
                                          <tr key={entry.dayNumber} className={`border-t border-border/20 ${rowBg(perf, isToday)}`}>
                                            <td className="py-1.5 px-2 text-center text-muted-foreground font-mono">{entry.dayNumber}</td>
                                            <td className="py-1.5 px-2 text-muted-foreground">{fmtDate(dayDate)}</td>
                                            <td className="py-1.5 px-2 font-medium">{range}</td>
                                            <td className="py-1.5 px-2 text-center text-muted-foreground">{entry.pages}</td>
                                            <td className="py-1.5 px-2 text-center font-medium">
                                              {perf && !perf.absent ? perf.actual : isFuture ? "—" : "—"}
                                            </td>
                                            <td className="py-1.5 px-2 text-center">
                                              {statusIcon(perf, isToday, isFuture)}
                                            </td>
                                          </tr>
                                        );
                                      })}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            ) : null}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          )}
        </Card>
      )}

      {/* Archived Students */}
      {showArchived && (archivedStudents?.length ?? 0) > 0 && (user?.role === "leader" || user?.role === "track_supervisor") && (
        <Card className="border-0 shadow-sm border-dashed border-gray-300">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-muted-foreground">
              <Archive className="w-4 h-4" />
              الطالبات المؤرشفات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/30 border-b border-border">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الاسم</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">سبب الأرشفة</th>
                  </tr>
                </thead>
                <tbody>
                  {archivedStudents!.map(student => (
                    <tr key={student.id} className="border-b border-border/50 opacity-70">
                      <td className="py-2.5 px-4 font-medium">{student.fullName}</td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">
                        {(student as any).archiveReason ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
