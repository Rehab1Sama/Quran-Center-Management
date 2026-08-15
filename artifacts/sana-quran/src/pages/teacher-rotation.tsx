import { useState, useEffect } from "react";
import {
  useListExamRotations, useCreateExamRotation, useUpdateExamRotation, useDeleteExamRotation,
  useListExamAssignments, useSaveExamAssignments,
  useListUsers, useListCircles, useListTracks,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, RefreshCw, Shuffle, ChevronDown, ChevronUp, Save, Check, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RotationPageProps { userRole?: string; userId?: number; }

export default function TeacherRotationPage({ userRole, userId }: RotationPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingRotation, setEditingRotation] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({
    name: "", startDate: "", endDate: "", isActive: true,
    teacherScope: "girls" as "girls" | "selected_tracks",
    selectedTracks: [] as string[],
  });
  const [editingAssignments, setEditingAssignments] = useState<any[]>([]);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const isLeader = userRole === "leader";
  const { data: rotations = [] } = useListExamRotations({});
  const { data: users = [] } = useListUsers({});
  const { data: circles = [] } = useListCircles({});
  const { data: tracks = [] } = useListTracks({ query: { queryKey: ["tracks"] } });

  const { data: currentAssignments = [], isFetched: assignmentsFetched } = useListExamAssignments(
    expandedId ?? 0,
    { query: { enabled: expandedId != null, queryKey: ["listExamAssignments", expandedId] } }
  );

  const createRot = useCreateExamRotation();
  const updateRot = useUpdateExamRotation();
  const deleteRot = useDeleteExamRotation();
  const saveMutation = useSaveExamAssignments();

  function inv() { qc.invalidateQueries({ queryKey: ["listExamRotations"] }); }

  function openNew() {
    setEditingRotation(null);
    setForm({ name: "", startDate: "", endDate: "", isActive: true, teacherScope: "girls", selectedTracks: [] });
    setShowDialog(true);
  }
  function openEdit(r: any) {
    setEditingRotation(r);
    setForm({
      name: r.name, startDate: r.startDate, endDate: r.endDate, isActive: r.isActive,
      teacherScope: r.teacherScope ?? "girls", selectedTracks: r.selectedTracks ?? [],
    });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!form.name || !form.startDate || !form.endDate) { toast({ title: "أدخل جميع الحقول", variant: "destructive" }); return; }
    if (form.teacherScope === "selected_tracks" && form.selectedTracks.length === 0) {
      toast({ title: "اختاري مسارًا واحدًا على الأقل للشقلبة", variant: "destructive" }); return;
    }
    try {
      if (editingRotation) await updateRot.mutateAsync({ id: editingRotation.id, data: form });
      else await createRot.mutateAsync({ data: form });
      inv(); setShowDialog(false); toast({ title: "تم الحفظ" });
    } catch { toast({ title: "حدث خطأ", variant: "destructive" }); }
  }

  async function handleDelete(id: number) {
    if (!confirm("حذف هذه الشقلبة؟")) return;
    await deleteRot.mutateAsync({ id }); inv(); if (expandedId === id) setExpandedId(null); toast({ title: "تم الحذف" });
  }

  function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); setEditingAssignments([]); }
    else { setExpandedId(id); setAssigningId(id); }
  }

  // تحميل التوزيعات مع إزالة التكرار وتمييزها كمعتمدة
  useEffect(() => {
    if (expandedId == null) { setEditingAssignments([]); return; }
    if (!assignmentsFetched) return;
    const seen = new Set<number>();
    const deduped = currentAssignments
      .filter(a => { if (seen.has(a.teacherId)) return false; seen.add(a.teacherId); return true; })
      .map(a => ({
        teacherId: a.teacherId, originalCircleId: a.originalCircleId, examCircleId: a.examCircleId,
        teacherName: a.teacherName, originalCircleName: a.originalCircleName, examCircleName: a.examCircleName,
        confirmed: true,
      }));
    setEditingAssignments(deduped);
  }, [currentAssignments, expandedId, assignmentsFetched]);

  const expandedRotation = rotations.find(r => r.id === expandedId);
  const rotationScope = expandedRotation?.teacherScope ?? "girls";
  const rotationTracks = expandedRotation?.selectedTracks ?? [];
  const isGirlsCircle = (c: any) => c.trackType === "girls" || String(c.trackType ?? "").startsWith("girls_");
  const isCircleInScope = (c: any) => rotationScope === "girls" ? isGirlsCircle(c) : rotationTracks.includes(c.track);
  const scopedCircles = circles.filter(isCircleInScope);
  const scopedCircleIds = new Set(scopedCircles.map(c => c.id));
  const teachers = users.filter(u => u.role === "teacher" && !u.isArchived && u.circleId != null && scopedCircleIds.has(u.circleId));
  const availableTracks = Array.from(new Set([
    ...tracks.map(t => t.name),
    ...circles.map(c => c.track),
  ])).filter(Boolean);

  // عدد الطالبات لكل حلقة
  const studentCountByCircle: Record<number, number> = {};
  for (const u of users) {
    if (u.role === "student" && !u.isArchived && u.circleId != null) {
      studentCountByCircle[u.circleId] = (studentCountByCircle[u.circleId] ?? 0) + 1;
    }
  }

  function autoDistribute() {
    const withCircles = teachers.filter(t => t.circleId != null);
    if (withCircles.length === 0) { toast({ title: "لا توجد معلمات بحلقات", variant: "destructive" }); return; }
    const grouped: Record<string, typeof withCircles> = {};
    withCircles.forEach(t => {
      const time = scopedCircles.find(c => c.id === t.circleId)?.meetingTime ?? "غير محدد";
      if (!grouped[time]) grouped[time] = [];
      grouped[time].push(t);
    });
    const seen = new Set<number>();
    const assignments: any[] = [];
    Object.values(grouped).forEach(group => {
      if (group.length < 2) return;
      for (let i = 0; i < group.length; i++) {
        if (seen.has(group[i].id)) continue;
        seen.add(group[i].id);
        const next = group[(i + 1) % group.length];
        assignments.push({
          teacherId: group[i].id, teacherName: group[i].name,
          originalCircleId: group[i].circleId!, originalCircleName: scopedCircles.find(c => c.id === group[i].circleId)?.name ?? "",
          examCircleId: next.circleId!, examCircleName: scopedCircles.find(c => c.id === next.circleId)?.name ?? "",
          confirmed: false,
        });
      }
    });
    if (assignments.length === 0) { toast({ title: "لا توجد معلمات بنفس وقت الحلقة للشقلبة التلقائية", variant: "destructive" }); return; }
    setEditingAssignments(assignments);
    toast({ title: `تم توزيع ${assignments.length} معلمة تلقائيًا` });
  }

  async function handleSaveAssignments() {
    if (!expandedId) return;
    try {
      const payload = editingAssignments
        .filter(a => a.confirmed && a.teacherId && a.originalCircleId && a.examCircleId)
        .map(a => ({ teacherId: a.teacherId, originalCircleId: a.originalCircleId, examCircleId: a.examCircleId }));
      await saveMutation.mutateAsync({ id: expandedId, data: { assignments: payload } });
      await qc.invalidateQueries({ queryKey: ["listExamAssignments"] });
      toast({ title: `تم حفظ التوزيع (${payload.length} معلمة)` });
    } catch (e: any) {
      toast({ title: e?.response?.data?.error ?? e?.message ?? "حدث خطأ", variant: "destructive" });
    }
  }

  function toggleConfirm(index: number) {
    setEditingAssignments(prev => prev.map((a, i) => i === index ? { ...a, confirmed: !a.confirmed } : a));
  }

  function removeAssignment(index: number) {
    setEditingAssignments(prev => prev.filter((_, i) => i !== index));
  }

  function updateAssignmentExamCircle(index: number, circleId: number) {
    setEditingAssignments(prev => prev.map((a, i) =>
      i === index ? { ...a, examCircleId: circleId, examCircleName: circles.find(c => c.id === circleId)?.name ?? "" } : a
    ));
  }

  function assignSoloTeacher(teacher: { id: number; name: string; circleId: number | null }, examCircleId: number) {
    const origCircle = scopedCircles.find(c => c.id === teacher.circleId);
    const examCircle = scopedCircles.find(c => c.id === examCircleId);
    setEditingAssignments(prev => {
      const idx = prev.findIndex(a => a.teacherId === teacher.id);
      const entry = {
        teacherId: teacher.id, teacherName: teacher.name,
        originalCircleId: teacher.circleId ?? 0, originalCircleName: origCircle?.name ?? "—",
        examCircleId, examCircleName: examCircle?.name ?? "—",
        confirmed: idx >= 0 ? prev[idx].confirmed : false,
      };
      if (idx >= 0) { const next = [...prev]; next[idx] = entry; return next; }
      return [...prev, entry];
    });
  }

  function addManualAssignment() {
    setEditingAssignments(prev => [...prev, {
      teacherId: 0, teacherName: "", originalCircleId: 0, originalCircleName: "",
      examCircleId: 0, examCircleName: "", confirmed: false,
    }]);
  }

  function updateManualAssignment(index: number, field: string, value: any) {
    setEditingAssignments(prev => prev.map((a, i) => {
      if (i !== index) return a;
      if (field === "teacherId") {
        const t = teachers.find(x => x.id === parseInt(value));
        return { ...a, teacherId: parseInt(value), teacherName: t?.name ?? "", originalCircleId: t?.circleId ?? 0, originalCircleName: circles.find(c => c.id === t?.circleId)?.name ?? "" };
      }
      if (field === "examCircleId") {
        return { ...a, examCircleId: parseInt(value), examCircleName: circles.find(c => c.id === parseInt(value))?.name ?? "" };
      }
      return { ...a, [field]: value };
    }));
  }

  return (
    <div className="p-4 max-w-5xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary flex items-center gap-2">
          <Shuffle className="w-6 h-6" />شقلبة المعلمات
        </h1>
        {isLeader && <Button size="sm" onClick={openNew}><Plus className="w-4 h-4 ml-1" />شقلبة جديدة</Button>}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-sm text-blue-700">
        💡 الشقلبة تعني توزيع المعلمات على حلقات غير حلقاتهن أثناء الاختبارات. يتم التوزيع التلقائي بناءً على وقت الحلقة المتشابه.
      </div>

      <div className="space-y-4">
        {rotations.map(rotation => {
          const isExpanded = expandedId === rotation.id;
          return (
            <div key={rotation.id} className="rounded-xl border bg-card overflow-hidden">
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">{rotation.name}</span>
                      {rotation.isActive
                        ? <Badge className="bg-green-100 text-green-700 text-xs">نشطة</Badge>
                        : <Badge variant="secondary" className="text-xs">منتهية</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{rotation.startDate} — {rotation.endDate}</div>
                    <div className="text-xs text-primary mt-1">
                      {rotation.teacherScope === "selected_tracks"
                        ? `المسارات: ${(rotation.selectedTracks ?? []).join("، ")}`
                        : "معلمات مسارات الفتيات فقط"}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {isLeader && (
                      <>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(rotation)}><Pencil className="w-3.5 h-3.5" /></Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(rotation.id)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </>
                    )}
                    <Button variant="outline" size="sm" onClick={() => toggleExpand(rotation.id)}>
                      {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      التوزيع
                    </Button>
                  </div>
                </div>
              </div>

              {isExpanded && (
                <div className="border-t p-4 bg-muted/30">
                  {isLeader && (
                    <div className="flex gap-2 mb-4 flex-wrap">
                      <Button size="sm" variant="outline" onClick={autoDistribute}>
                        <RefreshCw className="w-3.5 h-3.5 ml-1" />توزيع تلقائي
                      </Button>
                      <Button size="sm" variant="outline" onClick={addManualAssignment}>
                        <Plus className="w-3.5 h-3.5 ml-1" />إضافة يدوية
                      </Button>
                      <Button size="sm" onClick={handleSaveAssignments} disabled={saveMutation.isPending}>
                        <Save className="w-3.5 h-3.5 ml-1" />حفظ التوزيع
                      </Button>
                    </div>
                  )}

                  {/* بطاقة المعلمة: حلقتها في الاختبار */}
                  {userRole === "teacher" && userId != null && (
                    <div className={`rounded-xl border p-4 mb-4 ${
                      editingAssignments.some(a => a.teacherId === userId && a.confirmed)
                        ? "bg-primary/10 border-primary/30"
                        : "bg-amber-50 border-amber-200"
                    }`}>
                      <p className="text-xs font-semibold text-muted-foreground mb-1">حلقتك في الاختبار</p>
                      {(() => {
                        const mine = editingAssignments.find(a => a.teacherId === userId && a.confirmed);
                        if (!mine) return <p className="text-sm text-amber-700 italic">لم يتم تعيينك بعد في هذه الشقلبة</p>;
                        const cnt = studentCountByCircle[mine.examCircleId];
                        return (
                          <div>
                            <p className="text-lg font-bold text-primary">{mine.examCircleName}</p>
                            {cnt != null && <p className="text-sm text-muted-foreground mt-0.5">{cnt} طالبة</p>}
                          </div>
                        );
                      })()}
                    </div>
                  )}

                  {(() => {
                    // حلقات بلا شريك للتبادل
                    const grouped: Record<string, typeof teachers> = {};
                    teachers.filter(t => t.circleId != null).forEach(t => {
                      const time = scopedCircles.find(c => c.id === t.circleId)?.meetingTime ?? "غير محدد";
                      if (!grouped[time]) grouped[time] = [];
                      grouped[time].push(t);
                    });
                    const soloTeachers = teachers.filter(t => {
                      const time = scopedCircles.find(c => c.id === t.circleId)?.meetingTime ?? "غير محدد";
                      return (grouped[time]?.length ?? 0) === 1;
                    });

                    // للمديرة: كل الصفوف | لغيرها: الصفوف المعتمدة فقط
                    const displayedAssignments = isLeader
                      ? editingAssignments
                      : editingAssignments.filter(a => a.confirmed);

                    // المعلمات المعيّنة (لمنع التكرار في القائمة)
                    const assignedIds = new Set(editingAssignments.map(a => a.teacherId).filter(Boolean));

                    return (
                      <>
                        {displayedAssignments.length === 0 ? (
                          <div className="text-center py-6 text-muted-foreground text-sm">
                            {isLeader ? "اضغطي «توزيع تلقائي» أو أضيفي يدويًا" : "لا يوجد توزيع معتمد بعد"}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {/* رأس الجدول */}
                            <div className="grid gap-2 text-xs font-semibold text-muted-foreground px-2 mb-1"
                              style={{ gridTemplateColumns: isLeader ? "1fr 1fr auto auto" : "1fr 1fr auto" }}>
                              <span>المعلمة / حلقتها الأصلية</span>
                              <span>تراقب في حلقة</span>
                              <span className="text-center">✓</span>
                              {isLeader && <span />}
                            </div>

                            {displayedAssignments.map((a, rawIdx) => {
                              const realIdx = editingAssignments.indexOf(a);
                              const origTime = circles.find(c => c.id === a.originalCircleId)?.meetingTime;
                              const examTime = circles.find(c => c.id === a.examCircleId)?.meetingTime;
                              const examCount = a.examCircleId ? studentCountByCircle[a.examCircleId] : undefined;
                              return (
                                <div key={rawIdx}
                                  className={`grid gap-2 items-start rounded-lg p-2 border transition-colors
                                    ${a.confirmed ? "bg-green-50/60 border-green-200" : "bg-background"}`}
                                  style={{ gridTemplateColumns: isLeader ? "1fr 1fr auto auto" : "1fr 1fr auto" }}>

                                  {isLeader ? (
                                    <>
                                      {/* عمود المعلمة + حلقتها الأصلية */}
                                      <div className="space-y-1 min-w-0">
                                        <Select
                                          value={a.teacherId ? String(a.teacherId) : ""}
                                          onValueChange={v => updateManualAssignment(realIdx, "teacherId", v)}
                                        >
                                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="اختاري معلمة..." /></SelectTrigger>
                                          <SelectContent>
                                            {teachers
                                              .filter(t => t.id === a.teacherId || !assignedIds.has(t.id))
                                              .map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
                                          </SelectContent>
                                        </Select>
                                        {a.originalCircleName && (
                                          <div className="text-xs text-muted-foreground px-1 truncate">{a.originalCircleName}</div>
                                        )}
                                        {origTime && (
                                          <div className="text-xs text-muted-foreground/70 px-1">{origTime}</div>
                                        )}
                                      </div>

                                      {/* عمود حلقة الاختبار + عدد الطالبات */}
                                      <div className="space-y-1 min-w-0">
                                        <Select
                                          value={a.examCircleId ? String(a.examCircleId) : ""}
                                          onValueChange={v => updateAssignmentExamCircle(realIdx, parseInt(v))}
                                        >
                                          <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="حلقة الاختبار..." /></SelectTrigger>
                                          <SelectContent>
                                            {scopedCircles.map(c => (
                                              <SelectItem key={c.id} value={String(c.id)}>
                                                {c.name}{c.meetingTime ? ` — ${c.meetingTime}` : ""}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                        {examCount != null && a.examCircleId ? (
                                          <div className="text-xs text-muted-foreground px-1">{examCount} طالبة</div>
                                        ) : null}
                                      </div>

                                      {/* زر الاعتماد */}
                                      <button
                                        type="button"
                                        title={a.confirmed ? "إلغاء الاعتماد" : "اعتماد"}
                                        onClick={() => toggleConfirm(realIdx)}
                                        className={`mt-1 flex items-center justify-center w-8 h-8 rounded-full border-2 transition-colors flex-shrink-0
                                          ${a.confirmed
                                            ? "border-green-500 bg-green-500 text-white"
                                            : "border-muted-foreground/30 text-muted-foreground/40 hover:border-green-400 hover:text-green-500"}`}
                                      >
                                        <Check className="w-4 h-4" />
                                      </button>

                                      {/* زر الحذف */}
                                      <button
                                        type="button"
                                        onClick={() => removeAssignment(realIdx)}
                                        className="mt-1 flex items-center justify-center w-8 h-8 rounded-full text-destructive/50 hover:text-destructive hover:bg-destructive/10 transition-colors flex-shrink-0"
                                      >
                                        <X className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <>
                                      {/* اليمين: الاسم + حلقتها الأصلية + وقتها */}
                                      <div className="min-w-0">
                                        <div className="text-sm font-medium truncate">{a.teacherName}</div>
                                        <div className="text-xs text-muted-foreground truncate">{a.originalCircleName}</div>
                                        {origTime && <div className="text-xs text-muted-foreground/70">{origTime}</div>}
                                      </div>

                                      {/* اليسار: حلقة الاختبار + وقتها + عدد الطالبات */}
                                      <div className="min-w-0">
                                        <div className="text-sm font-semibold text-primary truncate">{a.examCircleName}</div>
                                        {examTime && <div className="text-xs text-primary/60">{examTime}</div>}
                                        {examCount != null && <div className="text-xs text-muted-foreground">{examCount} طالبة</div>}
                                      </div>

                                      {/* علامة الاعتماد */}
                                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-green-500 text-white flex-shrink-0">
                                        <Check className="w-4 h-4" />
                                      </div>
                                    </>
                                  )}
                                </div>
                              );
                            })}

                            {isLeader && (
                              <div className="text-xs text-muted-foreground text-left pt-1 px-1">
                                {editingAssignments.filter(a => a.confirmed).length} معتمدة من أصل {editingAssignments.length} — سيتم حفظ المعتمدات فقط
                              </div>
                            )}
                          </div>
                        )}

                        {soloTeachers.length > 0 && (
                          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-700 mb-2">
                              ⚠️ حلقات بلا شريك للتبادل — {isLeader ? "يمكنك تعيينهن يدويًا" : "وقت منفرد"}
                            </p>
                            <div className="space-y-2">
                              {soloTeachers.map(t => {
                                const circle = scopedCircles.find(c => c.id === t.circleId);
                                const assigned = editingAssignments.find(a => a.teacherId === t.id);
                                const displayCount = assigned
                                  ? (studentCountByCircle[assigned.examCircleId] ?? 0)
                                  : (t.circleId != null ? (studentCountByCircle[t.circleId] ?? 0) : 0);
                                return (
                                  <div key={t.id} className="flex items-center gap-2 flex-wrap">
                                    <div className="min-w-0 flex-shrink-0">
                                      <span className="text-xs font-medium text-amber-800">{t.name}</span>
                                      <span className="text-xs text-amber-500 mr-1">
                                        ({circle?.name ?? "—"}{circle?.meetingTime ? ` · ${circle.meetingTime}` : ""})
                                      </span>
                                      <span className="text-xs text-muted-foreground">· {displayCount} طالبة</span>
                                    </div>
                                    {isLeader ? (
                                      <Select
                                        value={assigned ? String(assigned.examCircleId) : ""}
                                        onValueChange={v => assignSoloTeacher(t, parseInt(v))}
                                      >
                                        <SelectTrigger className="h-7 text-xs flex-1 border-amber-300 bg-white min-w-[140px]">
                                          <SelectValue placeholder="اختاري حلقة..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {scopedCircles.filter(c => c.id !== t.circleId).map(c => (
                                            <SelectItem key={c.id} value={String(c.id)}>
                                              {c.name}{c.meetingTime ? ` — ${c.meetingTime}` : ""}{studentCountByCircle[c.id] != null ? ` · ${studentCountByCircle[c.id]} طالبة` : ""}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    ) : (
                                      assigned
                                        ? <span className="text-xs font-medium text-primary">← {assigned.examCircleName}</span>
                                        : <span className="text-xs text-amber-400 italic">لم تُعيَّن بعد</span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>
          );
        })}
        {rotations.length === 0 && (
          <div className="text-center py-16">
            <Shuffle className="w-14 h-14 mx-auto mb-3 text-muted-foreground/30" />
            <p className="text-muted-foreground">{isLeader ? "لا توجد شقلبات بعد — أضف أولى!" : "لا توجد شقلبات نشطة"}</p>
          </div>
        )}
      </div>

      {/* نافذة إنشاء / تعديل الشقلبة — native modal (no Radix Dialog) */}
      {showDialog && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
          onClick={() => setShowDialog(false)}
        >
          <div
            className="bg-background rounded-xl border shadow-xl w-full max-w-lg mx-4 p-6 space-y-4"
            dir="rtl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{editingRotation ? "تعديل الشقلبة" : "شقلبة جديدة"}</h2>
              <button type="button" onClick={() => setShowDialog(false)} className="rounded-sm opacity-70 hover:opacity-100 transition-opacity">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div><Label>الاسم *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اختبارات المراجعة العامة..." /></div>

            <div className="grid grid-cols-2 gap-3">
              <div><Label>من تاريخ *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div><Label>إلى تاريخ *</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
            </div>

            <div className="space-y-2">
              <Label>نطاق الشقلبة *</Label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setForm(f => ({ ...f, teacherScope: "girls" }))}
                  className={`rounded-lg border p-3 text-right text-sm transition-colors ${form.teacherScope === "girls" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                  <span className="font-semibold block">معلمات الفتيات فقط</span>
                  <span className="text-xs text-muted-foreground">بين حلقات مسارات الفتيات</span>
                </button>
                <button type="button" onClick={() => setForm(f => ({ ...f, teacherScope: "selected_tracks" }))}
                  className={`rounded-lg border p-3 text-right text-sm transition-colors ${form.teacherScope === "selected_tracks" ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted"}`}>
                  <span className="font-semibold block">مسارات محددة</span>
                  <span className="text-xs text-muted-foreground">الشقلبة بين المسارات المختارة فقط</span>
                </button>
              </div>
              {form.teacherScope === "selected_tracks" && (
                <div className="rounded-lg border bg-muted/30 p-3 space-y-2">
                  <p className="text-xs text-muted-foreground">اختاري المسارات التي تتبادل معلماتها:</p>
                  <div className="grid grid-cols-2 gap-2 max-h-36 overflow-y-auto">
                    {availableTracks.map(track => (
                      <label key={track} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="checkbox" checked={form.selectedTracks.includes(track)}
                          onChange={() => setForm(f => ({
                            ...f,
                            selectedTracks: f.selectedTracks.includes(track)
                              ? f.selectedTracks.filter(i => i !== track)
                              : [...f.selectedTracks, track],
                          }))}
                          className="accent-primary" />
                        <span>{track}</span>
                      </label>
                    ))}
                  </div>
                  {availableTracks.length === 0 && <p className="text-xs text-muted-foreground">لا توجد مسارات متاحة.</p>}
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              <Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              <Label>نشطة</Label>
            </div>

            <div className="flex gap-2 justify-start pt-2">
              <Button onClick={handleSave}>حفظ</Button>
              <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
