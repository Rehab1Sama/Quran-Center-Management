import { useState } from "react";
import { useListCircles, useUpdateCircle, useListStudents, useArchiveStudent, useRestoreStudent, useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Users, BookOpen, Settings2, X, Check, Clock, UserPlus, ChevronDown, ChevronUp, Archive, RotateCcw, UserCircle, Link2, PlaneTakeoff, XCircle, RefreshCw, Sun, Moon } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

type LeaveModal = {
  studentId: number;
  studentName: string;
  circleId: number;
  currentLeaveStart?: string | null;
  currentLeaveEnd?: string | null;
};

function CircleStudentsPanel({ circleId, canGrantLeave }: { circleId: number; canGrantLeave: boolean }) {
  const [showArchived, setShowArchived] = useState(false);
  const [leaveModal, setLeaveModal] = useState<LeaveModal | null>(null);
  const [leaveStart, setLeaveStart] = useState("");
  const [leaveEnd, setLeaveEnd] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [leaveSaving, setLeaveSaving] = useState(false);
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

  const archiveStudent = useArchiveStudent();
  const restoreStudent = useRestoreStudent();

  const handleArchive = (s: any) => {
    if (!confirm(`هل تريدين إخراج "${s.fullName}" من هذه الحلقة؟`)) return;
    archiveStudent.mutate(
      { id: s.id, data: { circleId } },
      {
        onSuccess: () => {
          toast({ title: `تم إخراج ${s.fullName} من الحلقة` });
          queryClient.invalidateQueries({ queryKey: ["circle-students", circleId] });
          queryClient.invalidateQueries({ queryKey: ["circle-students-archived", circleId] });
          queryClient.invalidateQueries({ queryKey: ["circles"] });
        },
        onError: () => toast({ title: "خطأ في الإخراج", variant: "destructive" }),
      }
    );
  };

  const handleRestore = (s: any) => {
    if (!confirm(`هل تريدين استرجاع "${s.fullName}" إلى هذه الحلقة؟`)) return;
    restoreStudent.mutate(
      { id: s.id, data: { circleId } },
      {
        onSuccess: () => {
          toast({ title: `تم استرجاع ${s.fullName} إلى الحلقة` });
          queryClient.invalidateQueries({ queryKey: ["circle-students", circleId] });
          queryClient.invalidateQueries({ queryKey: ["circle-students-archived", circleId] });
          queryClient.invalidateQueries({ queryKey: ["circles"] });
        },
        onError: () => toast({ title: "خطأ في الاسترجاع", variant: "destructive" }),
      }
    );
  };

  const openLeaveModal = (s: any) => {
    setLeaveModal({ studentId: s.id, studentName: s.fullName, circleId, currentLeaveStart: s.leaveStart, currentLeaveEnd: s.leaveEnd });
    setLeaveStart(s.leaveStart ?? "");
    setLeaveEnd(s.leaveEnd ?? "");
    setLeaveReason("");
  };

  const handleGrantLeave = async () => {
    if (!leaveModal) return;
    if (!leaveStart || !leaveEnd) { toast({ title: "أدخلي تاريخ البداية والنهاية", variant: "destructive" }); return; }
    if (leaveEnd < leaveStart) { toast({ title: "تاريخ النهاية يجب أن يكون بعد البداية", variant: "destructive" }); return; }
    setLeaveSaving(true);
    try {
      const token = localStorage.getItem("sana_auth_token");
      const res = await fetch(`/api/students/${leaveModal.studentId}/leave`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ circleId: leaveModal.circleId, leaveStart, leaveEnd, reason: leaveReason || null }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `تم تسجيل إجازة ${leaveModal.studentName}` });
      queryClient.invalidateQueries({ queryKey: ["circle-students", circleId] });
      setLeaveModal(null);
    } catch {
      toast({ title: "خطأ في تسجيل الإجازة", variant: "destructive" });
    } finally {
      setLeaveSaving(false);
    }
  };

  const handleCancelLeave = async (s: any) => {
    if (!confirm(`هل تريدين إلغاء إجازة "${s.fullName}"؟`)) return;
    try {
      const token = localStorage.getItem("sana_auth_token");
      const res = await fetch(`/api/students/${s.id}/leave`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ circleId, leaveStart: null, leaveEnd: null }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `تم إلغاء إجازة ${s.fullName}` });
      queryClient.invalidateQueries({ queryKey: ["circle-students", circleId] });
    } catch {
      toast({ title: "خطأ في إلغاء الإجازة", variant: "destructive" });
    }
  };

  if (isLoading) return <p className="text-xs text-muted-foreground py-3 text-center">جاري التحميل...</p>;

  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-3 pt-3 border-t border-border/50 space-y-2" dir="rtl">
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
      {students?.map(s => {
        const sAny = s as any;
        const onLeave = !!(sAny.leaveStart && sAny.leaveEnd && sAny.leaveStart <= today && today <= sAny.leaveEnd);
        return (
          <div key={s.id} className={`flex items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 ${onLeave ? "bg-blue-50 border border-blue-200" : "bg-muted/30"}`}>
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <span className="text-xs font-medium truncate">{s.fullName}</span>
              {onLeave && (
                <span className="text-[10px] bg-blue-100 text-blue-700 border border-blue-200 rounded-full px-1.5 py-0.5 shrink-0">إجازة</span>
              )}
            </div>
            <div className="flex gap-1 flex-shrink-0">
              <button
                onClick={() => navigate(`/students/${s.id}`)}
                className="p-1 rounded bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors"
                title="ملف الطالبة"
              >
                <UserCircle className="w-3 h-3" />
              </button>
              {canGrantLeave && (
                onLeave ? (
                  <button
                    onClick={() => handleCancelLeave(s)}
                    className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition-colors"
                    title="إلغاء الإجازة"
                  >
                    <XCircle className="w-3 h-3" />
                  </button>
                ) : (
                  <button
                    onClick={() => openLeaveModal(s)}
                    className="p-1 rounded bg-amber-50 text-amber-600 hover:bg-amber-100 transition-colors"
                    title="منح إجازة"
                  >
                    <PlaneTakeoff className="w-3 h-3" />
                  </button>
                )
              )}
              <button
                onClick={() => handleArchive(s)}
                className="p-1 rounded bg-rose-50 text-rose-500 hover:bg-rose-100 transition-colors"
                title="أرشفة"
              >
                <Archive className="w-3 h-3" />
              </button>
            </div>
          </div>
        );
      })}

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

      {/* Leave Modal */}
      {leaveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" dir="rtl">
          <div className="bg-white rounded-2xl shadow-xl p-5 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-base flex items-center gap-2">
                <PlaneTakeoff className="w-4 h-4 text-amber-500" />
                منح إجازة
              </h3>
              <button onClick={() => setLeaveModal(null)} className="p-1 rounded hover:bg-muted">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground">الطالبة: <span className="font-semibold text-foreground">{leaveModal.studentName}</span></p>
            <div className="space-y-3">
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تاريخ البداية</Label>
                <input
                  type="date"
                  value={leaveStart}
                  onChange={e => setLeaveStart(e.target.value)}
                  className="h-9 text-sm border border-input rounded-md px-3 w-full bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">تاريخ النهاية</Label>
                <input
                  type="date"
                  value={leaveEnd}
                  onChange={e => setLeaveEnd(e.target.value)}
                  className="h-9 text-sm border border-input rounded-md px-3 w-full bg-background"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-semibold">السبب (اختياري)</Label>
                <input
                  type="text"
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                  placeholder="مثال: سفر، مرض..."
                  className="h-9 text-sm border border-input rounded-md px-3 w-full bg-background"
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                onClick={handleGrantLeave}
                disabled={leaveSaving || !leaveStart || !leaveEnd}
                className="flex-1 text-sm"
              >
                {leaveSaving ? "جاري الحفظ..." : "تسجيل الإجازة"}
              </Button>
              <Button variant="outline" onClick={() => setLeaveModal(null)} className="flex-1 text-sm">
                إلغاء
              </Button>
            </div>
          </div>
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
  const { data: currentUser } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });
  const updateCircle = useUpdateCircle();
  const { toast } = useToast();

  const [search, setSearch] = useState("");
  const [selectedTrack, setSelectedTrack] = useState<string>("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ meetingTime: "", period: "am" as "am" | "pm", newStudentCapacity: "", whatsappLink: "" });
  const [saving, setSaving] = useState(false);
  const [expandedCircle, setExpandedCircle] = useState<number | null>(null);
  const [seeding, setSeeding] = useState(false);

  const isLeader = currentUser?.role === "leader";
  const canEdit = currentUser?.role === "leader" || currentUser?.role === "track_supervisor";
  const canGrantLeave = ["leader", "deputy", "track_supervisor"].includes(currentUser?.role ?? "");

  const handleSeedTracks = async () => {
    if (!confirm("سيتم إنشاء ١٠ حلقات لكل مسار (١١ مسار = ١١٠ حلقة) إذا لم تكن موجودة. هل تريدين المتابعة؟")) return;
    setSeeding(true);
    try {
      const token = localStorage.getItem("sana_auth_token");
      const res = await fetch("/api/circles/seed-tracks", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      toast({ title: data.message });
      refetch();
    } catch (e: any) {
      toast({ title: e.message ?? "خطأ في المزامنة", variant: "destructive" });
    } finally {
      setSeeding(false);
    }
  };

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
    const mt = c.meetingTime ?? "";
    const h = mt ? parseInt(mt.split(":")[0]) : 0;
    const period: "am" | "pm" = h >= 12 ? "pm" : "am";
    const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
    setEditData({
      meetingTime: mt ? `${String(h12).padStart(2,"0")}:${mt.split(":")[1]}` : "",
      period,
      newStudentCapacity: c.newStudentCapacity?.toString() ?? "",
      whatsappLink: c.whatsappLink ?? "",
    });
  };

  const saveEdit = async (circleId: number) => {
    setSaving(true);
    try {
      let time = editData.meetingTime;
      if (time) {
        const [hh] = time.split(":").map(Number);
        if (editData.period === "pm" && hh < 12) time = `${hh + 12}:${time.split(":")[1]}`;
        if (editData.period === "am" && hh === 12) time = `00:${time.split(":")[1]}`;
      }
      await updateCircle.mutateAsync({
        id: circleId,
        data: {
          meetingTime: time || null,
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
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-foreground">الحلقات</h1>
          <p className="text-muted-foreground text-sm mt-1">جميع حلقات المقرأة — يمكن ضبط وقت الاجتماع والسعة لكل حلقة عبر زر الإعدادات</p>
        </div>
        {isLeader && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleSeedTracks}
            disabled={seeding}
            className="flex items-center gap-2 text-sm"
          >
            <RefreshCw className={`w-4 h-4 ${seeding ? "animate-spin" : ""}`} />
            {seeding ? "جاري المزامنة..." : "مزامنة الحلقات"}
          </Button>
        )}
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
                              <p className="text-xs text-muted-foreground mt-0.5">معلمة: {c.teacherName}</p>
                            )}
                            {(c as any).supervisorName && (
                              <p className="text-xs text-muted-foreground">مشرفة: {(c as any).supervisorName}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Badge className={`flex-shrink-0 text-xs ${TRACK_COLORS[track] ?? "bg-gray-100 text-gray-700"}`}>
                              {track}
                            </Badge>
                            {canEdit && (
                            <button
                              onClick={() => isEditing ? setEditingId(null) : startEdit(c)}
                              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground"
                              title="إعدادات الحلقة"
                            >
                              {isEditing ? <X className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                            </button>
                          )}
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
                            <div className="space-y-2">
                              <Label className="text-xs font-semibold text-muted-foreground flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                وقت الاجتماع
                              </Label>
                              <div className="flex gap-2">
                                <button
                                  type="button"
                                  onClick={() => setEditData(d => ({ ...d, period: "am" }))}
                                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${editData.period === "am" ? "border-amber-400 bg-amber-50 text-amber-700" : "border-border text-muted-foreground"}`}
                                >
                                  <Sun className="w-3 h-3" /> صباحي
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditData(d => ({ ...d, period: "pm" }))}
                                  className={`flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all ${editData.period === "pm" ? "border-indigo-400 bg-indigo-50 text-indigo-700" : "border-border text-muted-foreground"}`}
                                >
                                  <Moon className="w-3 h-3" /> مسائي
                                </button>
                              </div>
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
                                className="h-8 text-xs text-right"
                              />
                            </div>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => saveEdit(circle.id)}
                                disabled={saving}
                                className="flex-1 h-8 text-xs"
                              >
                                <Check className="w-3 h-3 ml-1" />
                                {saving ? "جاري الحفظ..." : "حفظ"}
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => setEditingId(null)}
                                className="flex-1 h-8 text-xs"
                              >
                                إلغاء
                              </Button>
                            </div>
                          </div>
                        )}

                        {/* Students count + expand toggle */}
                        <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Users className="w-3.5 h-3.5" />
                              {(c as any).studentCount ?? 0} طالبة
                            </span>
                            {(c as any).location && (
                              <span className="flex items-center gap-1">
                                <BookOpen className="w-3.5 h-3.5" />
                                {(c as any).location}
                              </span>
                            )}
                          </div>
                          <button
                            onClick={() => setExpandedCircle(expandedCircle === circle.id ? null : circle.id)}
                            className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-0.5 transition-colors"
                          >
                            {expandedCircle === circle.id ? (
                              <><ChevronUp className="w-3 h-3" />إخفاء</>
                            ) : (
                              <><ChevronDown className="w-3 h-3" />الطالبات</>
                            )}
                          </button>
                        </div>

                        {expandedCircle === circle.id && (
                          <CircleStudentsPanel circleId={circle.id} canGrantLeave={canGrantLeave} />
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
