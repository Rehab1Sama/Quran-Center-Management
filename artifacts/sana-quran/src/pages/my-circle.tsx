import { useState, useEffect } from "react";
import { useListStudents, useGetCurrentUser, useListRecords } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Archive, Loader2, MessageCircle } from "lucide-react";
import { makeWhatsAppLink } from "@/lib/utils";
import { formatPages } from "@/lib/quran";
import MessagesSection from "@/components/MessagesSection";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function isOnLeave(student: any): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (!student.leaveStart) return false;
  if (student.leaveStart <= today && (!student.leaveEnd || student.leaveEnd >= today)) return true;
  return false;
}

function authHeader(): Record<string, string> {
  const token = localStorage.getItem("sana_auth_token");
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

export default function MyCirclePage() {
  const [showArchived, setShowArchived] = useState(false);
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
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-semibold">{student.fullName}</span>
                            {(student as any).phone && (
                              <a
                                href={makeWhatsAppLink((student as any).phone)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={e => e.stopPropagation()}
                                className="text-emerald-500 hover:text-emerald-700 transition-colors"
                                title="واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5" />
                              </a>
                            )}
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
