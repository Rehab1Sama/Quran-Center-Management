import { useState, useEffect, useMemo } from "react";
import { useGetMissingDataEntry, useGetDailySnapshot, useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock, Timer, Sun, Moon, Activity, CheckSquare, Square, ChevronDown, ChevronUp, CalendarDays, CalendarClock } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const getToken = () => localStorage.getItem("sana_auth_token");

function fmtMinutes(min: number): string {
  if (min <= 0) return "٠ د";
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  if (h > 0 && m > 0) return `${h} س ${m} د`;
  if (h > 0) return `${h} س`;
  return `${m} د`;
}

function minuteColor(min: number): string {
  if (min === 0) return "text-muted-foreground";
  if (min < 30) return "text-amber-500";
  if (min < 90) return "text-emerald-600";
  return "text-blue-600";
}

interface SessionStat {
  userId: number;
  userName: string;
  morningMinutes: number;
  eveningMinutes: number;
  totalMinutes: number;
  lastActive: string | null;
}

interface CirclesTodayStat {
  userId: number;
  userName: string;
  assignedCount: number;
  enteredCount: number;
  circles: { circleId: number; circleName: string; track: string; enteredToday: boolean }[];
}

export default function DataEntryStatusPage() {
  const { data: missing } = useGetMissingDataEntry(undefined, { query: { queryKey: ["missingData"] } });
  const { data: snapshot } = useGetDailySnapshot({ query: { queryKey: ["dailySnapshot"] } });
  const { data: currentUser } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });

  const [sessionStats, setSessionStats] = useState<SessionStat[]>([]);
  const [statsLoading, setStatsLoading] = useState(false);
  const [circlesToday, setCirclesToday] = useState<CirclesTodayStat[]>([]);
  const [expandedUser, setExpandedUser] = useState<number | null>(null);

  const isLeaderOrDeputy = currentUser?.role === "leader" || (currentUser?.role as string) === "deputy";

  useEffect(() => {
    if (!isLeaderOrDeputy) return;
    setStatsLoading(true);
    const token = getToken();
    Promise.all([
      fetch(`${BASE}/api/data-entry/sessions/today`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : []),
      fetch(`${BASE}/api/data-entry/circles-today`, { headers: { Authorization: `Bearer ${token}` } })
        .then(r => r.ok ? r.json() : []),
    ])
      .then(([sessions, circles]) => {
        setSessionStats(Array.isArray(sessions) ? sessions : []);
        setCirclesToday(Array.isArray(circles) ? circles : []);
      })
      .catch(() => { setSessionStats([]); setCirclesToday([]); })
      .finally(() => setStatsLoading(false));
  }, [isLeaderOrDeputy]);

  const missingArr: any[] = (missing as unknown as any[]) ?? [];
  const notRecordedInWeek = snapshot?.circlesNotRecordedInWeek ?? [];

  const grouped: Record<string, any[]> = {};
  missingArr.forEach((item: any) => {
    const track = item.track ?? "غير محدد";
    if (!grouped[track]) grouped[track] = [];
    grouped[track].push(item);
  });

  const activeToday = sessionStats.filter(s => s.totalMinutes > 0).length;
  const totalMinutesToday = sessionStats.reduce((acc, s) => acc + s.totalMinutes, 0);

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">حالة البيانات المُدخلة</h1>
        <p className="text-muted-foreground text-sm mt-1">الطالبات التي لم تُدخل بياناتهن بعد</p>
      </div>

      {/* ===== بطاقة حالة الحلقات لكل مُدخِلة اليوم ===== */}
      {isLeaderOrDeputy && circlesToday.length > 0 && (
        <Card className="border-0 shadow-sm border-r-4 border-r-teal-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-teal-700">
              <CheckSquare className="w-4 h-4" />
              حلقات كل مُدخِلة — اليوم
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {circlesToday.map(u => {
              const isExpanded = expandedUser === u.userId;
              const allDone = u.assignedCount > 0 && u.enteredCount === u.assignedCount;
              const noneAssigned = u.assignedCount === 0;
              return (
                <div key={u.userId} className="border border-border rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedUser(isExpanded ? null : u.userId)}
                    className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-muted/30 transition-colors text-right"
                  >
                    <span className={`font-semibold text-sm flex-1 text-right ${allDone ? "text-emerald-700" : "text-foreground"}`}>
                      {u.userName}
                    </span>
                    {noneAssigned ? (
                      <Badge className="bg-gray-100 text-gray-500 border-0 text-xs">لا حلقات مُسندة</Badge>
                    ) : allDone ? (
                      <Badge className="bg-emerald-100 text-emerald-700 border-0 text-xs">✓ اكتملت ({u.enteredCount}/{u.assignedCount})</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">{u.enteredCount}/{u.assignedCount} مُدخَلة</Badge>
                    )}
                    {!noneAssigned && (
                      isExpanded
                        ? <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
                        : <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
                    )}
                  </button>
                  {isExpanded && !noneAssigned && (
                    <div className="border-t border-border/50 px-3 py-2 space-y-1 bg-muted/20">
                      {u.circles.map(c => (
                        <div key={c.circleId} className="flex items-center gap-2 text-xs py-0.5">
                          {c.enteredToday
                            ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                            : <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />}
                          <span className={`font-medium ${c.enteredToday ? "text-emerald-700" : "text-foreground"}`}>{c.circleName}</span>
                          <span className="text-muted-foreground">· {c.track}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* ===== لوحة وقت العمل الفعلي لمُدخلات البيانات ===== */}
      {isLeaderOrDeputy && (
        <Card className="border-0 shadow-sm border-r-4 border-r-blue-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-blue-700">
              <Timer className="w-4 h-4" />
              وقت العمل الفعلي اليوم — مُدخلات البيانات
              {activeToday > 0 && (
                <Badge className="bg-blue-100 text-blue-700 border-0 text-xs">
                  {activeToday} نشيطة · {fmtMinutes(totalMinutesToday)} إجمالاً
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {statsLoading ? (
              <div className="text-center py-4 text-muted-foreground text-sm">جاري التحميل...</div>
            ) : sessionStats.length === 0 ? (
              <p className="text-muted-foreground text-sm py-2">لا توجد بيانات للعرض</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border">
                    <tr>
                      <th className="text-right py-2 px-3 font-semibold text-muted-foreground text-xs">المُدخِلة</th>
                      <th className="text-center py-2 px-3 font-semibold text-muted-foreground text-xs">
                        <span className="inline-flex items-center gap-1"><Sun className="w-3 h-3 text-amber-500" />صباح</span>
                      </th>
                      <th className="text-center py-2 px-3 font-semibold text-muted-foreground text-xs">
                        <span className="inline-flex items-center gap-1"><Moon className="w-3 h-3 text-blue-400" />مساء</span>
                      </th>
                      <th className="text-center py-2 px-3 font-semibold text-muted-foreground text-xs">
                        <span className="inline-flex items-center gap-1"><Activity className="w-3 h-3 text-emerald-500" />الإجمالي</span>
                      </th>
                      <th className="text-center py-2 px-3 font-semibold text-muted-foreground text-xs">آخر نشاط</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sessionStats.map(s => {
                      const lastActive = s.lastActive ? new Date(s.lastActive) : null;
                      const minutesAgo = lastActive
                        ? Math.floor((Date.now() - lastActive.getTime()) / 60000)
                        : null;
                      const isOnline = minutesAgo !== null && minutesAgo <= 5;
                      return (
                        <tr key={s.userId} className="border-b border-border/40 hover:bg-muted/20 transition-colors">
                          <td className="py-2.5 px-3 font-semibold flex items-center gap-2">
                            {isOnline && (
                              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse inline-block" title="متصلة الآن" />
                            )}
                            {s.userName}
                          </td>
                          <td className={`py-2.5 px-3 text-center font-mono font-semibold ${minuteColor(s.morningMinutes)}`}>
                            {fmtMinutes(s.morningMinutes)}
                          </td>
                          <td className={`py-2.5 px-3 text-center font-mono font-semibold ${minuteColor(s.eveningMinutes)}`}>
                            {fmtMinutes(s.eveningMinutes)}
                          </td>
                          <td className={`py-2.5 px-3 text-center font-mono font-bold text-base ${minuteColor(s.totalMinutes)}`}>
                            {s.totalMinutes === 0 ? (
                              <span className="text-xs text-muted-foreground font-normal">لم تبدأ</span>
                            ) : fmtMinutes(s.totalMinutes)}
                          </td>
                          <td className="py-2.5 px-3 text-center text-xs text-muted-foreground">
                            {isOnline ? (
                              <span className="text-emerald-600 font-medium">الآن</span>
                            ) : minutesAgo !== null ? (
                              minutesAgo < 60
                                ? `منذ ${minutesAgo} د`
                                : `منذ ${Math.floor(minutesAgo / 60)} س`
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
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
      )}

      {/* Circles not recorded in last 7 days */}
      {notRecordedInWeek.length > 0 && (
        <Card className="border-0 shadow-sm border-r-4 border-r-rose-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <Clock className="w-4 h-4" />
              حلقات لم تُسجّل منذ أكثر من ٧ أيام
              <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">{notRecordedInWeek.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {notRecordedInWeek.map((c: any) => (
                <div key={c.circleId} className="bg-rose-50 rounded-xl px-3 py-2 text-sm">
                  <span className="font-semibold text-rose-800">{c.circleName}</span>
                  <span className="text-xs text-rose-500 mr-1.5">· {c.track}</span>
                  {c.daysSinceLastRecord != null ? (
                    <span className="text-xs text-rose-400">({c.daysSinceLastRecord} يوم)</span>
                  ) : (
                    <span className="text-xs text-rose-400">(لا سجلات)</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {missingArr.length === 0 ? (
        <Card className="border-0 shadow-sm" data-testid="card-all-complete">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-foreground">تم إدخال جميع البيانات</p>
            <p className="text-muted-foreground text-sm mt-1">لا توجد سجلات ناقصة</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm" data-testid="card-total-missing">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{missingArr.length}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي الناقصة</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" data-testid="card-tracks-missing">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{Object.keys(grouped).length}</p>
                <p className="text-xs text-muted-foreground mt-1">مسارات متأثرة</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" data-testid="card-circles-missing">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {Array.from(new Set(missingArr.map((m: any) => m.circleId))).length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">حلقات متأثرة</p>
              </CardContent>
            </Card>
          </div>

          {Object.entries(grouped).map(([track, items]) => (
            <Card key={track} className="border-0 shadow-sm" data-testid={`card-track-${track}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  مسار {track}
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-right py-2.5 px-4 font-semibold text-muted-foreground">الطالبة</th>
                        <th className="text-right py-2.5 px-4 font-semibold text-muted-foreground">الحلقة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any) => (
                        <tr key={`${item.studentId}-${item.circleId}`}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                          data-testid={`row-missing-${item.studentId}`}
                        >
                          <td className="py-2.5 px-4 font-semibold">{item.studentName}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{item.circleName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
