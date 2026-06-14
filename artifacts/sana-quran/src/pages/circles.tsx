import { useState } from "react";
import { useListCircles, useUpdateCircle, useListStudents, useRestoreStudent } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Users, BookOpen, Settings2, X, Check, Clock, UserPlus, ChevronDown, ChevronUp, Archive, RotateCcw, UserCircle, Link2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

function CircleStudentsPanel({ circleId }: { circleId: number }) {
  const [showArchived, setShowArchived] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  const { data: students, isLoading } = useListStudents(
    { circleId },
    { query: { queryKey: ["circle-students", circleId] } }
  );
  const { data: archivedStudents } = useListStudents(
    { circleId, isArchived: true },
    { query: { queryKey: ["circle-students-archived", circleId] } }
  );

  const restoreStudent = useRestoreStudent();

  const handleArchive = (s: any) => {
    if (!confirm(`هل تريدين إخراج "${s.fullName}" من هذه الحلقة؟`)) return;
    const token = localStorage.getItem("auth_token");
    fetch(`/api/students/${s.id}/archive`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ circleId }),
    })
      .then(r => {
        if (!r.ok) throw new Error();
        toast({ title: `تم إخراج ${s.fullName} من الحلقة` });
        queryClient.invalidateQueries({ queryKey: ["circle-students", circleId] });
        queryClient.invalidateQueries({ queryKey: ["circle-students-archived", circleId] });
        queryClient.invalidateQueries({ queryKey: ["circles"] });
      })
      .catch(() => toast({ title: "خطأ في الإخراج", variant: "destructive" }));
  };

  const handleRestore = (s: any) => {
    restoreStudent.mutate({ id: s.id, data: {} }, {
      onSuccess: () => {
        toast({ title: `تم استرجاع ${s.fullName}` });
        queryClient.invalidateQueries({ queryKey: ["circle-students", circleId] });
        queryClient.invalidateQueries({ queryKey: ["circle-students-archived", circleId] });
        queryClient.invalidateQueries({ queryKey: ["circles"] });
      },
    });
  };

  if (isLoading) return <p className="text-xs text-muted-foreground py-3 text-center">جاري التحميل...</p>;

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground">الطالبات ({students?.length ?? 0})</p>
        {(archivedStudents?.length ?? 0) > 0 && (
          <button
            onClick={() => setShowArchived(v => !v)}
            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
          >
            <Archive className="w-3 h-3" />
            المؤرشفات ({archivedStudents?.length})
          </button>
        )}
      </div>

      {/* Active students */}
      {(!students || students.length === 0) && (
        <p className="text-xs text-muted-foreground text-center py-2">لا توجد طالبات</p>
      )}
      {students?.map(s => (
        <div key={s.id} className="flex items-center justify-between gap-2 bg-muted/30 rounded-lg px-2.5 py-1.5">
          <span className="text-xs font-medium truncate flex-1">{s.fullName}</span>
          <div className="flex gap-1 flex-shrink-0">
            <button
              onClick={() => navigate(`/students/${s.id}`)}
              className="p-1 rounded bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors"
              title="ملف الطالبة"
            >
              <UserCircle className="w-3 h-3" />
            </button>
            <button
              onClick={() => handleArchive(s)}
              className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
              title="أرشفة"
            >
              <Archive className="w-3 h-3" />
            </button>
          </div>
        </div>
      ))}

      {/* Archived students */}
      {showArchived && archivedStudents && archivedStudents.length > 0 && (
        <div className="border-t border-dashed border-border/50 pt-2 space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-medium">المؤرشفات</p>
          {archivedStudents.map(s => (
            <div key={s.id} className="flex items-center justify-between gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5 opacity-70">
              <span className="text-xs text-muted-foreground truncate flex-1">{s.fullName}</span>
              <button
                onClick={() => handleRestore(s)}
                className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors"
                title="استرجاع للحلقة"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const TRACK_COLORS: Record<string, string> = {
  "البهور": "bg-fuchsia-100 text-fuchsia-700",
  "إشراق": "bg-blue-100 text-blue-700",
  "قبس": "bg-pink-100 text-pink-700",
  "ضياء": "bg-amber-100 text-amber-700",
  "وهج": "bg-rose-100 text-rose-700",
  "سراج": "bg-emerald-100 text-emerald-700",
  "ألق": "bg-cyan-100 text-cyan-700",
  "مهج": "bg-orange-100 text-orange-700",
  "مشكاة نور": "bg-sky-100 text-sky-700",
};

export default function CirclesPage() {
  const { data: circles, isLoading, refetch } = useListCircles(undefined, { query: { queryKey: ["circles"] } });
  const updateCircle = useUpdateCircle();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ meetingTime: "", newStudentCapacity: "", whatsappLink: "" });
  const [saving, setSaving] = useState(false);
  const [expandedCircle, setExpandedCircle] = useState<number | null>(null);

  const tracks = Array.from(new Set(
    (circles ?? []).flatMap(c => (typeof c.track === "string" && c.track) ? [c.track] : [])
  )).sort();

  const filtered = circles?.filter(c => {
    const matchSearch = !search || c.name.includes(search) || (c as { teacherName?: string }).teacherName?.includes(search);
    const matchTrack = !selectedTrack || c.track === selectedTrack;
    return matchSearch && matchTrack;
  }) ?? [];

  const grouped: Record<string, typeof filtered> = {};
  filtered.forEach(c => {
    const t = c.track ?? "غير محدد";
    if (!grouped[t]) grouped[t] = [];
    grouped[t].push(c);
  });

  const startEdit = (circle: (typeof filtered)[0]) => {
    setEditingId(circle.id);
    const c = circle as { meetingTime?: string | null; newStudentCapacity?: number | null; whatsappLink?: string | null };
    setEditData({
      meetingTime: c.meetingTime ?? "",
      newStudentCapacity: c.newStudentCapacity?.toString() ?? "",
      whatsappLink: c.whatsappLink ?? "",
    });
  };

  const saveEdit = async (circleId: number) => {
    setSaving(true);
    try {
      await updateCircle.mutateAsync({
        id: circleId,
        data: {
          meetingTime: editData.meetingTime || null,
          newStudentCapacity: editData.newStudentCapacity ? Number(editData.newStudentCapacity) : null,
          whatsappLink: editData.whatsappLink || null,
        },
      });
      await refetch();
      setEditingId(null);
      toast({ title: "تم الحفظ بنجاح" });
    } catch {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">الحلقات</h1>
        <p className="text-muted-foreground text-sm mt-1">جميع حلقات المقرأة — يمكن ضبط وقت الاجتماع والسعة لكل حلقة عبر زر الإعدادات</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو المعلمة..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="ps-3 pe-10 text-right"
            data-testid="input-search-circles"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            onClick={() => setSelectedTrack("")}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!selectedTrack ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
          >
            الكل
          </button>
          {tracks.map((t: string) => (
            <button
              key={t}
              onClick={() => setSelectedTrack(t)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedTrack === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              data-testid={`filter-track-${t}`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([track, trackCircles]) => (
            <div key={track}>
              <h2 className="text-base font-bold text-foreground mb-3 flex items-center gap-2">
                <Badge className={`text-sm px-3 py-1 ${TRACK_COLORS[track] ?? "bg-gray-100 text-gray-700"}`}>
                  مسار {track}
                </Badge>
                <span className="text-muted-foreground font-normal text-sm">({trackCircles.length} حلقات)</span>
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {trackCircles.map(circle => {
                  const c = circle as typeof circle & { meetingTime?: string | null; newStudentCapacity?: number | null; teacherName?: string; studentCount?: number; location?: string; description?: string };
                  const isEditing = editingId === circle.id;

                  return (
                    <Card key={circle.id} className="border border-border/50 shadow-sm hover:shadow-md transition-all" data-testid={`card-circle-${circle.id}`}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-bold text-base text-foreground">{circle.name}</h3>
                            {c.teacherName && (
                              <p className="text-sm text-muted-foreground mt-0.5">{c.teacherName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge className={`flex-shrink-0 text-xs ${TRACK_COLORS[track] ?? "bg-gray-100 text-gray-700"}`}>
                              {track}
                            </Badge>
                            <button
                              onClick={() => isEditing ? setEditingId(null) : startEdit(c)}
                              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                              title="إعدادات التسجيل"
                            >
                              {isEditing ? <X className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {c.description && (
                          <p className="text-sm text-muted-foreground mt-2 line-clamp-1">{c.description}</p>
                        )}

                        {/* Capacity & time badges */}
                        {!isEditing && (c.meetingTime || c.newStudentCapacity != null || (c as any).whatsappLink) && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {c.meetingTime && (
                              <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">
                                <Clock className="w-3 h-3" />
                                {c.meetingTime}
                              </span>
                            )}
                            {c.newStudentCapacity != null && (
                              <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                                <UserPlus className="w-3 h-3" />
                                {c.newStudentCapacity} طالبة جديدة
                              </span>
                            )}
                            {(c as any).whatsappLink && (
                              <a
                                href={(c as any).whatsappLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full hover:bg-green-100"
                              >
                                <Link2 className="w-3 h-3" />
                                واتساب الحلقة
                              </a>
                            )}
                          </div>
                        )}

                        {/* Inline edit form */}
                        {isEditing && (
                          <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                وقت الاجتماع
                              </Label>
                              <input
                                type="time"
                                value={editData.meetingTime}
                                onChange={e => setEditData(d => ({ ...d, meetingTime: e.target.value }))}
                                className="h-8 text-xs border border-input rounded-md px-2 py-1.5 w-full bg-background"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <UserPlus className="w-3 h-3" />
                                الحد الأقصى للطالبات الجدد
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                value={editData.newStudentCapacity}
                                onChange={e => setEditData(d => ({ ...d, newStudentCapacity: e.target.value }))}
                                placeholder="اتركي فارغًا = بلا حد"
                                className="h-8 text-xs text-right"
                              />
                              <p className="text-[10px] text-muted-foreground">الحلقة ستختفي من التسجيل بعد اكتمالها</p>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <Link2 className="w-3 h-3" />
                                رابط مجموعة الواتساب
                              </Label>
                              <Input
                                value={editData.whatsappLink}
                                onChange={e => setEditData(d => ({ ...d, whatsappLink: e.target.value }))}
                                placeholder="https://chat.whatsapp.com/..."
                                className="h-8 text-xs"
                                dir="ltr"
                              />
                            </div>
                            <Button
                              size="sm"
                              className="w-full h-8 text-xs gap-1"
                              onClick={() => saveEdit(circle.id)}
                              disabled={saving}
                            >
                              <Check className="w-3.5 h-3.5" />
                              حفظ
                            </Button>
                          </div>
                        )}

                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-xs text-muted-foreground">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              <span>{c.studentCount ?? 0} طالبة</span>
                            </div>
                            {c.location && (
                              <div className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                <span className="truncate">{c.location}</span>
                              </div>
                            )}
                          </div>
                          {!isEditing && (
                            <button
                              onClick={() => setExpandedCircle(expandedCircle === circle.id ? null : circle.id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                              title="عرض الطالبات"
                            >
                              <Users className="w-3 h-3" />
                              الطالبات
                              {expandedCircle === circle.id ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                            </button>
                          )}
                        </div>
                        {expandedCircle === circle.id && !isEditing && (
                          <CircleStudentsPanel circleId={circle.id} />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {filtered.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">لا توجد حلقات مطابقة</div>
          )}
        </div>
      )}
    </div>
  );
}
