import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, CheckCircle2, XCircle, ChevronDown, ChevronUp, Users, Loader2, RefreshCw } from "lucide-react";
import { getCurrentPlanDay, getDayDates } from "@/components/ReviewPlanSection";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const getToken = () => localStorage.getItem("sana_auth_token");
const authHeader = () => {
  const h: Record<string, string> = { "Content-Type": "application/json" };
  const t = getToken();
  if (t) h["Authorization"] = `Bearer ${t}`;
  return h;
};

type PlanSummary = {
  id: number;
  planType: string;
  startDate: string;
  themeColor: string;
  totalPages: number | null;
  quotaType: string | null;
  quotaJuz: number | null;
  quotaSurahStart: string | null;
  quotaSurahEnd: string | null;
  createdAt: string;
};

type StudentRow = {
  studentId: number;
  studentName: string;
  hasPlan: boolean;
  plan: PlanSummary | null;
};

type CircleOverview = {
  circleId: number;
  circleName: string;
  trackName: string;
  trackType: string;
  students: StudentRow[];
};

function getPlanMode(trackType: string): "girls" | "fixation" {
  return trackType === "fixation" ? "fixation" : "girls";
}

function getTotalDays(trackType: string): number {
  return trackType === "fixation" ? 24 : 21;
}

function getPlanTypeLabel(planType: string) {
  if (planType === "girls_review") return "مراجعة بنات";
  if (planType === "fixation") return "تثبيت";
  return planType;
}

function getPlanProgress(plan: PlanSummary, trackType: string) {
  const totalDays = getTotalDays(trackType);
  const mode = getPlanMode(trackType);
  const dates = getDayDates(plan.startDate, totalDays, mode);
  const endDate = dates[dates.length - 1] ?? plan.startDate;
  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const currentDay = getCurrentPlanDay(plan.startDate, totalDays, mode);
  const isCompleted = today > endDate;
  const notStarted = today < dates[0];
  return { currentDay, totalDays, endDate, isCompleted, notStarted };
}

function PlanBadge({ plan, trackType }: { plan: PlanSummary; trackType: string }) {
  const { currentDay, totalDays, isCompleted, notStarted } = getPlanProgress(plan, trackType);
  if (isCompleted) {
    return (
      <span className="text-[10px] bg-emerald-100 text-emerald-700 rounded-full px-2 py-0.5 flex items-center gap-1 whitespace-nowrap">
        <CheckCircle2 className="w-3 h-3" /> اكتملت
      </span>
    );
  }
  if (notStarted) {
    return (
      <span className="text-[10px] bg-amber-100 text-amber-700 rounded-full px-2 py-0.5 whitespace-nowrap">
        لم تبدأ بعد
      </span>
    );
  }
  return (
    <span className="text-[10px] bg-violet-100 text-violet-700 rounded-full px-2 py-0.5 whitespace-nowrap">
      يوم {currentDay} / {totalDays}
    </span>
  );
}

function StudentPlanRow({ student, trackType }: { student: StudentRow; trackType: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border/30 last:border-0 hover:bg-muted/20 transition-colors">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-foreground truncate">{student.studentName}</p>
        {student.hasPlan && student.plan && (
          <p className="text-xs text-muted-foreground mt-0.5">
            {getPlanTypeLabel(student.plan.planType)}
            {student.plan.quotaJuz ? ` · ${student.plan.quotaJuz} جزء` : ""}
            {student.plan.quotaSurahStart && student.plan.quotaSurahEnd
              ? ` · ${student.plan.quotaSurahStart} → ${student.plan.quotaSurahEnd}`
              : ""}
          </p>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {student.hasPlan && student.plan ? (
          <>
            <span
              className="w-3 h-3 rounded-full border border-border/30 shrink-0"
              style={{ background: student.plan.themeColor }}
            />
            <PlanBadge plan={student.plan} trackType={trackType} />
          </>
        ) : (
          <span className="text-[10px] bg-rose-100 text-rose-600 rounded-full px-2 py-0.5 flex items-center gap-1 whitespace-nowrap">
            <XCircle className="w-3 h-3" /> بدون خطة
          </span>
        )}
      </div>
    </div>
  );
}

function CircleCard({ circle }: { circle: CircleOverview }) {
  const [expanded, setExpanded] = useState(true);
  const withPlan = circle.students.filter(s => s.hasPlan);
  const withoutPlan = circle.students.filter(s => !s.hasPlan);
  const total = circle.students.length;

  const percentage = total > 0 ? Math.round((withPlan.length / total) * 100) : 0;

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <CardHeader
        className="pb-2 cursor-pointer select-none"
        onClick={() => setExpanded(e => !e)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <CardTitle className="text-sm font-bold truncate">{circle.circleName}</CardTitle>
            <Badge variant="outline" className="text-[10px] shrink-0 border-muted-foreground/30 text-muted-foreground">
              {circle.trackName}
            </Badge>
          </div>
          <div className="flex items-center gap-2 shrink-0 mr-2">
            <div className="flex items-center gap-1">
              <span className="text-[10px] text-emerald-600 font-semibold">{withPlan.length}</span>
              <span className="text-[10px] text-muted-foreground">/</span>
              <span className="text-[10px] text-muted-foreground">{total}</span>
            </div>
            <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${percentage}%`,
                  background: percentage === 100
                    ? "#10b981"
                    : percentage > 50
                    ? "#8b5cf6"
                    : "#f43f5e",
                }}
              />
            </div>
            <span className="text-[10px] text-muted-foreground w-7 text-left">{percentage}%</span>
            {expanded
              ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
              : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            }
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="p-0 pb-1">
          {total === 0 ? (
            <div className="px-4 py-4 text-center text-sm text-muted-foreground">
              لا توجد طالبات في هذه الحلقة
            </div>
          ) : (
            <div>
              {circle.students.map(s => (
                <StudentPlanRow key={s.studentId} student={s} trackType={circle.trackType} />
              ))}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

export default function ReviewPlansOverviewPage() {
  const [data, setData] = useState<CircleOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "with" | "without">("all");
  const [searchQuery, setSearchQuery] = useState("");

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${BASE}/api/review-plans/overview`, { headers: authHeader() });
      if (!res.ok) throw new Error("فشل تحميل البيانات");
      const json: CircleOverview[] = await res.json();
      setData(json);
    } catch {
      setError("تعذّر تحميل خطط المراجعة");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  // Group by track
  const trackGroups: Record<string, CircleOverview[]> = {};
  for (const circle of data) {
    if (!trackGroups[circle.trackName]) trackGroups[circle.trackName] = [];
    trackGroups[circle.trackName].push(circle);
  }

  // Summary stats
  const allStudents = data.flatMap(c => c.students);
  const withPlanCount = allStudents.filter(s => s.hasPlan).length;
  const withoutPlanCount = allStudents.filter(s => !s.hasPlan).length;
  const totalCount = allStudents.length;

  // Filter circles based on filter + search
  function filterCircle(circle: CircleOverview): CircleOverview {
    let students = circle.students;
    if (filter === "with") students = students.filter(s => s.hasPlan);
    if (filter === "without") students = students.filter(s => !s.hasPlan);
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase();
      students = students.filter(s => s.studentName.toLowerCase().includes(q));
    }
    return { ...circle, students };
  }

  const filteredTracks = Object.entries(trackGroups).map(([track, circles]) => ({
    track,
    circles: circles.map(filterCircle).filter(c =>
      filter === "all" && !searchQuery.trim()
        ? true
        : c.students.length > 0
    ),
  })).filter(t => t.circles.length > 0);

  return (
    <div className="max-w-3xl mx-auto space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            خطط المراجعة
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            نظرة عامة على خطط الطالبات حسب الحلقات
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 font-medium disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          تحديث
        </button>
      </div>

      {/* Summary cards */}
      {!loading && !error && (
        <div className="grid grid-cols-3 gap-3">
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-foreground">{totalCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">إجمالي الطالبات</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-emerald-600">{withPlanCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">لديهن خطة</p>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-sm">
            <CardContent className="p-3 text-center">
              <p className="text-2xl font-bold text-rose-500">{withoutPlanCount}</p>
              <p className="text-xs text-muted-foreground mt-0.5">بدون خطة</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters */}
      {!loading && !error && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex rounded-xl overflow-hidden border border-border">
            {(["all", "with", "without"] as const).map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 text-xs font-semibold transition-colors ${
                  filter === f
                    ? "bg-primary text-white"
                    : "text-muted-foreground hover:bg-muted"
                }`}
              >
                {f === "all" ? "الكل" : f === "with" ? "لديهن خطة" : "بدون خطة"}
              </button>
            ))}
          </div>
          <input
            type="text"
            placeholder="بحث عن طالبة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="flex-1 min-w-40 text-sm border border-border rounded-xl px-3 py-1.5 bg-background focus:outline-none focus:ring-1 focus:ring-primary/30"
            dir="rtl"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      )}

      {/* Error */}
      {error && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-6 text-center text-rose-500 text-sm">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Content grouped by track */}
      {!loading && !error && filteredTracks.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="p-8 text-center">
            <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {searchQuery || filter !== "all"
                ? "لا توجد نتائج تطابق هذا البحث"
                : "لا توجد حلقات مرتبطة بحسابك"}
            </p>
          </CardContent>
        </Card>
      )}

      {!loading && !error && filteredTracks.map(({ track, circles }) => (
        <div key={track} className="space-y-3">
          {/* Track header — only show if multiple tracks */}
          {filteredTracks.length > 1 && (
            <div className="flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs font-bold text-muted-foreground px-2 shrink-0">
                مسار {track}
              </span>
              <div className="h-px flex-1 bg-border" />
            </div>
          )}
          <div className="space-y-3">
            {circles.map(circle => (
              <CircleCard key={circle.circleId} circle={circle} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
