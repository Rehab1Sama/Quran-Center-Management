import { useState, useEffect } from "react";
import { useGetStatsSummary, useGetCirclesStats, useGetCurrentUser, useListRecords } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatPages } from "@/lib/quran";
import { schoolConfig, getFieldLabel } from "@/lib/schoolConfig";
import {
  BarChart2, Users, BookOpen, GraduationCap, TrendingUp,
  Award, Calendar, BookMarked, Eye, Layers, CheckCircle2
} from "lucide-react";

function getTrackLabel(dataEntryType: string, fallback: string): string {
  const found = schoolConfig.defaultTrackTypes.find(t => t.dataEntryType === dataEntryType);
  return found ? found.name : fallback;
}

function StatCard({
  label, value, color, icon: Icon, sub,
}: {
  label: string; value: string | number; color: string;
  icon?: any; sub?: string;
}) {
  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-4 text-center">
        {Icon && <Icon className={`w-5 h-5 mx-auto mb-1.5 ${color}`} />}
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
        <p className="text-xs text-muted-foreground mt-1 font-medium leading-tight">{label}</p>
        {sub && <p className="text-xs text-muted-foreground/70 mt-0.5">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function PeriodFilter({ periodDays, setPeriodDays }: { periodDays: number; setPeriodDays: (v: number) => void }) {
  return (
    <Card className="border-0 shadow-sm" data-testid="card-date-range">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <Calendar className="w-4 h-4 text-primary" />
          الفترة الزمنية
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-2">
          {PERIOD_OPTIONS.map(opt => (
            <button
              key={opt.days}
              onClick={() => setPeriodDays(opt.days)}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${
                periodDays === opt.days
                  ? "bg-primary text-white shadow-sm"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
              data-testid={`btn-period-${opt.days}`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function useTeacherRecords(periodDays: number) {
  const [data, setData] = useState<any[]>([]);
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(`${BASE}/api/stats/teacher-records?days=${periodDays}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : [])
      .then(setData)
      .catch(() => {});
  }, [periodDays]);
  return data;
}

type ReviewPlanStats = {
  totalWithPlan: number;
  committed: number;
  uncommitted: number;
  commitmentRate: number;
  byTrack: { trackName: string; total: number; committed: number; rate: number }[];
};

function useReviewPlanStats() {
  const [data, setData] = useState<ReviewPlanStats | null>(null);
  useEffect(() => {
    const token = localStorage.getItem("auth_token");
    fetch(`${BASE}/api/stats/review-plan-stats`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .catch(() => {});
  }, []);
  return data;
}

function ReviewPlanStatsCard({ planStats }: { planStats: ReviewPlanStats | null }) {
  if (!planStats || planStats.totalWithPlan === 0) return null;
  const rateColor =
    planStats.commitmentRate >= 80 ? "text-emerald-600" :
    planStats.commitmentRate >= 50 ? "text-amber-600" : "text-rose-500";
  return (
    <Card className="border-0 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          الملتزمات بخطة المراجعة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="text-center">
            <p className={`text-2xl font-bold ${rateColor}`}>{planStats.commitmentRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">نسبة الالتزام</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-emerald-600">{planStats.committed}</p>
            <p className="text-xs text-muted-foreground mt-1">ملتزمة</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold text-rose-500">{planStats.uncommitted}</p>
            <p className="text-xs text-muted-foreground mt-1">غير ملتزمة</p>
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{planStats.committed} من {planStats.totalWithPlan} طالبة لديها خطة</span>
            <span className={`font-bold ${rateColor}`}>{planStats.commitmentRate}%</span>
          </div>
          <div className="bg-muted rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-700 ${
                planStats.commitmentRate >= 80 ? "bg-emerald-500" :
                planStats.commitmentRate >= 50 ? "bg-amber-400" : "bg-rose-400"
              }`}
              style={{ width: `${planStats.commitmentRate}%` }}
            />
          </div>
        </div>

        {/* By track breakdown */}
        {planStats.byTrack.length > 1 && (
          <div className="space-y-2 pt-1">
            <p className="text-xs font-semibold text-muted-foreground">حسب المسار</p>
            {planStats.byTrack.map(t => (
              <div key={t.trackName} className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground w-28 shrink-0 truncate">{t.trackName}</span>
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${
                      t.rate >= 80 ? "bg-emerald-400" :
                      t.rate >= 50 ? "bg-amber-400" : "bg-rose-400"
                    }`}
                    style={{ width: `${t.rate}%` }}
                  />
                </div>
                <span className="text-xs font-bold w-10 text-right text-muted-foreground">
                  {t.committed}/{t.total}
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function LeaderStats({ summary, circleStats, periodDays }: { summary: any; circleStats: any[]; periodDays: number }) {
  const teacherRecords = useTeacherRecords(periodDays);
  const planStats = useReviewPlanStats();
  return (
    <div className="space-y-5">
      {/* Staff counts */}
      <div>
        <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4" />
          الكوادر التعليمية
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="معلمات" value={summary.teacherCount ?? 0} color="text-teal-600" icon={GraduationCap} />
          <StatCard label="مشرفات" value={summary.supervisorCount ?? 0} color="text-blue-600" icon={Award} />
          <StatCard label="مسؤولات مسار" value={summary.trackSupervisorCount ?? 0} color="text-teal-600" icon={Layers} />
        </div>
      </div>

      {/* Student counts by type */}
      <div>
        <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          الطالبات ({summary.studentCount ?? 0} إجمالًا)
        </h2>
        <div className="grid grid-cols-3 gap-3">
          <StatCard label="حلقات الفتيات" value={summary.totalGirlsStudents ?? 0} color="text-rose-500" icon={Users} />
          <StatCard label="حلقات الأطفال" value={summary.totalChildrenStudents ?? 0} color="text-amber-500" icon={Users} />
          <StatCard label="حلقات الأمهات" value={summary.totalMothersStudents ?? 0} color="text-teal-500" icon={Users} />
        </div>
      </div>

      {/* Age distribution */}
      {summary.ageDistribution?.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">توزيع الطالبات حسب الأعمار</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {summary.ageDistribution.map((item: any) => (
                <div key={item.age} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-24 text-right shrink-0">{item.age}</span>
                  <div className="flex-1 bg-muted rounded-full h-2.5">
                    <div
                      className="bg-primary rounded-full h-2.5 transition-all"
                      style={{ width: `${Math.min(100, (item.count / (summary.studentCount || 1)) * 100)}%` }}
                    />
                  </div>
                  <span className="text-xs font-bold w-8 text-right">{item.count}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Page stats */}
      <div>
        <h2 className="text-sm font-bold text-muted-foreground mb-3 flex items-center gap-2">
          <BookMarked className="w-4 h-4" />
          إحصائيات الأوجه
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatCard label={`${getFieldLabel("memorize")} (وجه)`} value={formatPages(summary.totalMemorizePages)} color="text-teal-600" icon={BookOpen} />
          <StatCard label={getFieldLabel("review_near")} value={formatPages(summary.totalReviewNearPages)} color="text-blue-600" icon={Eye} />
          <StatCard label={getFieldLabel("review_far")} value={formatPages(summary.totalReviewFarPages)} color="text-teal-600" icon={Eye} />
          <StatCard label={getFieldLabel("recitation")} value={formatPages(summary.totalRecitationPages)} color="text-emerald-600" icon={BookMarked} />
        </div>
      </div>
      {(summary.totalReviewPages > 0) && (
        <StatCard label={getTrackLabel("simple_review", "المراجعة العامة")} value={formatPages(summary.totalReviewPages)} color="text-cyan-600" icon={BookMarked} />
      )}
      {((summary as any).totalFixationPages > 0) && (
        <StatCard label={getTrackLabel("fixation", "التثبيت")} value={formatPages((summary as any).totalFixationPages)} color="text-amber-600" icon={BookOpen} />
      )}

      {/* Absences + Deficiencies */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="الغياب (إجمالي)" value={summary.totalAbsences ?? 0} color="text-rose-500" icon={Users} />
        <StatCard label="التقصير (إجمالي)" value={summary.totalDeficiencies ?? 0} color="text-orange-500" icon={BarChart2} />
      </div>

      {/* Top circle */}
      {summary.topCircle && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <Award className="w-8 h-8 text-amber-500 shrink-0" />
            <div>
              <p className="text-xs text-muted-foreground">الحلقة الأولى خلال الفترة</p>
              <p className="font-bold text-foreground">{summary.topCircle}</p>
              <p className="text-xs text-amber-600">{formatPages(summary.topCirclePages)} وجه</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Review Plan Stats */}
      <ReviewPlanStatsCard planStats={planStats} />

      {/* Circles Table */}
      {circleStats?.length > 0 && (
        <Card className="border-0 shadow-sm" data-testid="card-circles-stats-table">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">تفاصيل الحلقات</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">الحلقة</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">المسار</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">الحفظ</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">المراجعة</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">التلاوة</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">غياب الطالبات</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">غياب المعلمة</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">التقصير</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">عدد</th>
                  </tr>
                </thead>
                <tbody>
                  {circleStats
                    .filter((c: any) => c.studentCount > 0)
                    .sort((a: any, b: any) => b.totalMemorizePages - a.totalMemorizePages)
                    .map((circle: any, idx: number) => (
                      <tr key={circle.circleId} className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        data-testid={`row-stats-circle-${circle.circleId}`}
                      >
                        <td className="py-2 px-3 font-semibold text-xs">{circle.circleName}</td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">{circle.track}</td>
                        <td className="py-2 px-3 text-teal-600 font-bold text-xs">{formatPages(circle.totalMemorizePages)}</td>
                        <td className="py-2 px-3 text-blue-600 text-xs">{formatPages(circle.totalReviewPages)}</td>
                        <td className="py-2 px-3 text-emerald-600 text-xs">{formatPages(circle.totalRecitationPages)}</td>
                        <td className="py-2 px-3 text-rose-500 text-xs">{circle.totalAbsences}</td>
                        <td className="py-2 px-3 text-xs">
                          {(circle.teacherAbsences ?? 0) > 0
                            ? <span className="text-orange-600 font-bold">{circle.teacherAbsences}</span>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="py-2 px-3 text-xs">
                          {(circle.deficiencyCount ?? 0) > 0
                            ? <span className="text-red-600 font-bold">{circle.deficiencyCount}</span>
                            : <span className="text-muted-foreground">—</span>
                          }
                        </td>
                        <td className="py-2 px-3 text-muted-foreground text-xs">{circle.studentCount}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Teacher Records Table */}
      {teacherRecords.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <GraduationCap className="w-4 h-4 text-teal-600" />
              سجل المعلمات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">المعلمة</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">الحلقة</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">المسار</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">الغياب</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">التأخير</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">التحضير</th>
                  </tr>
                </thead>
                <tbody>
                  {teacherRecords.map((t: any) => (
                    <tr key={t.teacherId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-semibold text-xs">{t.teacherName}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{t.circleName}</td>
                      <td className="py-2 px-3 text-xs text-muted-foreground">{t.track}</td>
                      <td className="py-2 px-3 text-xs">
                        {t.absenceCount > 0
                          ? <span className="text-rose-600 font-bold">{t.absenceCount}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-3 text-xs">
                        {t.tardyCount > 0
                          ? <span className="text-orange-500 font-bold">{t.tardyCount}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-3 text-xs">
                        {t.prepIssueCount > 0
                          ? <span className="text-amber-600 font-bold">{t.prepIssueCount}</span>
                          : <span className="text-muted-foreground">—</span>}
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

function TrackSupervisorStats({ summary, circleStats }: { summary: any; circleStats: any[] }) {
  const planStats = useReviewPlanStats();
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="الحفظ (وجه)" value={formatPages(summary.totalMemorizePages)} color="text-teal-600" icon={BookOpen} />
        <StatCard label="المراجعة القريبة" value={formatPages(summary.totalReviewNearPages)} color="text-blue-600" icon={Eye} />
        <StatCard label="المراجعة البعيدة" value={formatPages(summary.totalReviewFarPages)} color="text-teal-600" icon={Eye} />
        <StatCard label="الغياب" value={summary.totalAbsences ?? 0} color="text-rose-500" icon={Users} />
        <StatCard label="التقصير" value={summary.totalDeficiencies ?? 0} color="text-orange-500" icon={BarChart2} />
      </div>
      {(summary.totalRecitationPages > 0 || summary.totalReviewPages > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {summary.totalReviewPages > 0 && <StatCard label="المراجعة" value={formatPages(summary.totalReviewPages)} color="text-cyan-600" icon={BookMarked} />}
          {summary.totalRecitationPages > 0 && <StatCard label="التلاوة" value={formatPages(summary.totalRecitationPages)} color="text-emerald-600" icon={BookMarked} />}
        </div>
      )}
      {/* Review Plan Stats */}
      <ReviewPlanStatsCard planStats={planStats} />

      {circleStats?.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold">حلقات المسار</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">الحلقة</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">الحفظ</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">المراجعة</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">الغياب</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">التقصير</th>
                    <th className="text-right py-2.5 px-3 font-semibold text-muted-foreground text-xs">عدد</th>
                  </tr>
                </thead>
                <tbody>
                  {circleStats.filter((c: any) => c.studentCount > 0).map((c: any) => (
                    <tr key={c.circleId} className="border-b border-border/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2 px-3 font-semibold text-xs">{c.circleName}</td>
                      <td className="py-2 px-3 text-teal-600 font-bold text-xs">{formatPages(c.totalMemorizePages)}</td>
                      <td className="py-2 px-3 text-blue-600 text-xs">{formatPages(c.totalReviewPages)}</td>
                      <td className="py-2 px-3 text-rose-500 text-xs">{c.totalAbsences}</td>
                      <td className="py-2 px-3 text-xs">
                        {(c.deficiencyCount ?? 0) > 0
                          ? <span className="text-red-600 font-bold">{c.deficiencyCount}</span>
                          : <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="py-2 px-3 text-muted-foreground text-xs">{c.studentCount}</td>
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

function TeacherStats({ summary, circleStats }: { summary: any; circleStats: any[] }) {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <StatCard label="عدد الطالبات" value={summary.studentCount ?? 0} color="text-primary" icon={Users} />
        <StatCard label="الغياب" value={summary.totalAbsences ?? 0} color="text-rose-500" icon={Users} />
        <StatCard label="التقصير" value={summary.totalDeficiencies ?? 0} color="text-orange-500" icon={BarChart2} />
        <StatCard label="الحفظ (وجه)" value={formatPages(summary.totalMemorizePages)} color="text-teal-600" icon={BookOpen} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <StatCard label="المراجعة القريبة" value={formatPages(summary.totalReviewNearPages)} color="text-blue-600" icon={Eye} />
        <StatCard label="المراجعة البعيدة" value={formatPages(summary.totalReviewFarPages)} color="text-teal-600" icon={Eye} />
        {summary.totalReviewPages > 0 && <StatCard label="المراجعة" value={formatPages(summary.totalReviewPages)} color="text-cyan-600" icon={Eye} />}
        {summary.totalRecitationPages > 0 && <StatCard label="التلاوة" value={formatPages(summary.totalRecitationPages)} color="text-emerald-600" icon={BookMarked} />}
      </div>
    </div>
  );
}

function StudentStats({ userId }: { userId: number }) {
  const { data: records } = useListRecords(
    { studentId: userId },
    { query: { queryKey: ["myRecords", userId] } }
  );

  const sorted = (records ?? []).slice().sort((a: any, b: any) => b.date.localeCompare(a.date));
  const totalMem = Math.round(sorted.reduce((s: number, r: any) => s + (r.memorizePages ?? 0), 0) * 2) / 2;
  const totalRevNear = Math.round(sorted.reduce((s: number, r: any) => s + (r.reviewNearPages ?? 0), 0) * 2) / 2;
  const totalRevFar = Math.round(sorted.reduce((s: number, r: any) => s + (r.reviewFarPages ?? 0), 0) * 2) / 2;
  const totalRev = Math.round(sorted.reduce((s: number, r: any) => s + (r.reviewPages ?? 0), 0) * 2) / 2;
  const totalRec = Math.round(sorted.reduce((s: number, r: any) => s + (r.recitationPages ?? 0), 0) * 2) / 2;
  const totalAbsences = sorted.filter((r: any) => r.isAbsent).length;
  const totalSessions = sorted.filter((r: any) => !r.isAbsent).length;

  const TOTAL_QURAN_PAGES = 604;
  const progressPct = Math.min(100, Math.round((totalMem / TOTAL_QURAN_PAGES) * 1000) / 10);

  const latestRecord = sorted.find((r: any) => !r.isAbsent);

  return (
    <div className="space-y-5">
      {/* Progress bar */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            تقدمي في الحفظ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatPages(totalMem)} وجه من أصل {TOTAL_QURAN_PAGES}</span>
            <span className="font-bold text-primary">{progressPct}%</span>
          </div>
          <div className="bg-muted rounded-full h-4 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${progressPct}%`,
                background: "linear-gradient(90deg, hsl(210, 51%, 21%) 0%, hsl(177, 35%, 40%) 100%)",
              }}
            />
          </div>
          {latestRecord?.memorizeSurahStart && (
            <p className="text-xs text-muted-foreground">
              آخر حفظ: من {latestRecord.memorizeSurahStart} إلى {latestRecord.memorizeSurahEnd}
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        <StatCard label="إجمالي الحفظ" value={formatPages(totalMem)} color="text-teal-600" icon={BookOpen} />
        <StatCard label="الجلسات" value={totalSessions} color="text-primary" icon={Calendar} />
        <StatCard label="الغيابات" value={totalAbsences} color="text-rose-500" icon={Users} />
      </div>

      {(totalRevNear > 0 || totalRevFar > 0 || totalRev > 0 || totalRec > 0) && (
        <div className="grid grid-cols-2 gap-3">
          {totalRevNear > 0 && <StatCard label="م. قريبة" value={formatPages(totalRevNear)} color="text-blue-600" icon={Eye} />}
          {totalRevFar > 0 && <StatCard label="م. بعيدة" value={formatPages(totalRevFar)} color="text-teal-600" icon={Eye} />}
          {totalRev > 0 && <StatCard label="مراجعة" value={formatPages(totalRev)} color="text-cyan-600" icon={Eye} />}
          {totalRec > 0 && <StatCard label="تلاوة" value={formatPages(totalRec)} color="text-emerald-600" icon={BookMarked} />}
        </div>
      )}

      {sorted.length > 0 && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Calendar className="w-4 h-4 text-primary" />
              آخر السجلات
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {sorted.slice(0, 10).map((r: any) => (
                <div key={r.id} className="flex items-center justify-between px-4 py-2.5">
                  <span className="text-xs text-muted-foreground">{r.date}</span>
                  <div className="flex gap-2">
                    {r.isAbsent ? (
                      <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">غائبة</Badge>
                    ) : (
                      <>
                        {(r.memorizePages ?? 0) > 0 && (
                          <Badge className="bg-teal-100 text-teal-700 border-0 text-xs">
                            {formatPages(r.memorizePages)} ح
                          </Badge>
                        )}
                        {((r.reviewNearPages ?? 0) + (r.reviewFarPages ?? 0) + (r.reviewPages ?? 0)) > 0 && (
                          <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                            {formatPages((r.reviewNearPages ?? 0) + (r.reviewFarPages ?? 0) + (r.reviewPages ?? 0))} م
                          </Badge>
                        )}
                        {(r.recitationPages ?? 0) > 0 && (
                          <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">
                            {formatPages(r.recitationPages)} ت
                          </Badge>
                        )}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

const PERIOD_OPTIONS = [
  { label: "هذا الأسبوع", days: 7 },
  { label: "آخر 30 يوم", days: 30 },
  { label: "آخر 90 يوم", days: 90 },
  { label: "هذا العام", days: 365 },
];

export default function StatisticsPage() {
  const { data: user } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });
  const [periodDays, setPeriodDays] = useState(30);

  const today = new Date().toISOString().slice(0, 10);
  const fromDate = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const dateParams = { dateFrom: fromDate, dateTo: today };

  const { data: summary } = useGetStatsSummary(dateParams, {
    query: { queryKey: ["statsSummary", dateParams] }
  });
  const { data: circleStats } = useGetCirclesStats(dateParams, {
    query: { queryKey: ["circlesStats", dateParams] }
  });

  const role = user?.role ?? "student";
  const isStudent = role === "student";

  const roleLabel: Record<string, string> = {
    leader: "إحصائيات المقرأة الشاملة",
    track_supervisor: "إحصائيات مسارك",
    teacher: "إحصائيات حلقتك",
    supervisor: "إحصائيات حلقتك",
    data_entry: "إحصائيات المسار",
    student: "إحصائياتي",
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <BarChart2 className="w-6 h-6 text-primary" />
          الإحصائيات
        </h1>
        <p className="text-muted-foreground text-sm mt-1">{roleLabel[role] ?? "الإحصائيات"}</p>
      </div>

      {/* Student view — no date filter, just their own records */}
      {isStudent && user?.id ? (
        <StudentStats userId={user.id} />
      ) : (
        <>
          <PeriodFilter periodDays={periodDays} setPeriodDays={setPeriodDays} />

          {summary && circleStats !== undefined ? (
            role === "leader" ? (
              <LeaderStats summary={summary} circleStats={circleStats ?? []} periodDays={periodDays} />
            ) : role === "track_supervisor" ? (
              <TrackSupervisorStats summary={summary} circleStats={circleStats ?? []} />
            ) : (
              <TeacherStats summary={summary} circleStats={circleStats ?? []} />
            )
          ) : (
            <div className="text-center py-10 text-muted-foreground text-sm">جاري التحميل...</div>
          )}
        </>
      )}
    </div>
  );
}
