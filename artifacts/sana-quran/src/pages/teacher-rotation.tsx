import { useState, useEffect } from "react";
import {
  useListExamRotations, useCreateExamRotation, useUpdateExamRotation, useDeleteExamRotation,
  useListExamAssignments, useSaveExamAssignments,
  useListUsers, useListCircles,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Pencil, RefreshCw, Shuffle, ChevronDown, ChevronUp, Save } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface RotationPageProps { userRole?: string; }

export default function TeacherRotationPage({ userRole }: RotationPageProps) {
  const [showDialog, setShowDialog] = useState(false);
  const [editingRotation, setEditingRotation] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [form, setForm] = useState({ name: "", startDate: "", endDate: "", isActive: true });
  const [editingAssignments, setEditingAssignments] = useState<any[]>([]);
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const { toast } = useToast();
  const qc = useQueryClient();

  const isLeader = userRole === "leader";
  const { data: rotations = [] } = useListExamRotations({});
  const { data: users = [] } = useListUsers({});
  const { data: circles = [] } = useListCircles({});

  const { data: currentAssignments = [] } = useListExamAssignments(
    expandedId ?? 0,
    { query: { enabled: expandedId != null, queryKey: ["listExamAssignments", expandedId] } }
  );

  const createRot = useCreateExamRotation();
  const updateRot = useUpdateExamRotation();
  const deleteRot = useDeleteExamRotation();
  const saveMutation = useSaveExamAssignments();

  function inv() { qc.invalidateQueries({ queryKey: ["listExamRotations"] }); }

  function openNew() { setEditingRotation(null); setForm({ name: "", startDate: "", endDate: "", isActive: true }); setShowDialog(true); }
  function openEdit(r: any) { setEditingRotation(r); setForm({ name: r.name, startDate: r.startDate, endDate: r.endDate, isActive: r.isActive }); setShowDialog(true); }

  async function handleSave() {
    if (!form.name || !form.startDate || !form.endDate) { toast({ title: "أدخل جميع الحقول", variant: "destructive" }); return; }
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
    else {
      setExpandedId(id);
      setAssigningId(id);
    }
  }

  useEffect(() => {
    if (currentAssignments.length > 0 && expandedId != null) {
      setEditingAssignments(currentAssignments.map(a => ({
        teacherId: a.teacherId, originalCircleId: a.originalCircleId, examCircleId: a.examCircleId,
        teacherName: a.teacherName, originalCircleName: a.originalCircleName, examCircleName: a.examCircleName,
      })));
    }
  }, [currentAssignments, expandedId]);

  const teachers = users.filter(u => u.role === "teacher" && !u.isArchived);

  function autoDistribute() {
    const teachersWithCircles = teachers.filter(t => t.circleId != null);
    if (teachersWithCircles.length === 0) { toast({ title: "لا توجد معلمات بحلقات", variant: "destructive" }); return; }

    const groupedByTime: Record<string, typeof teachersWithCircles> = {};
    teachersWithCircles.forEach(t => {
      const circle = circles.find(c => c.id === t.circleId);
      const time = circle?.meetingTime ?? "غير محدد";
      if (!groupedByTime[time]) groupedByTime[time] = [];
      groupedByTime[time].push(t);
    });

    const assignments: any[] = [];
    Object.values(groupedByTime).forEach(group => {
      if (group.length < 2) return;
      for (let i = 0; i < group.length; i++) {
        const next = group[(i + 1) % group.length];
        assignments.push({
          teacherId: group[i].id, teacherName: group[i].name,
          originalCircleId: group[i].circleId!, originalCircleName: circles.find(c => c.id === group[i].circleId)?.name ?? "",
          examCircleId: next.circleId!, examCircleName: circles.find(c => c.id === next.circleId)?.name ?? "",
        });
      }
    });

    const solo = teachersWithCircles.filter(t => {
      const circle = circles.find(c => c.id === t.circleId);
      const time = circle?.meetingTime ?? "غير محدد";
      return groupedByTime[time].length === 1;
    });

    if (assignments.length === 0 && solo.length > 0) {
      toast({ title: "لا توجد معلمات بنفس وقت الحلقة للشقلبة التلقائية", variant: "destructive" });
      return;
    }

    setEditingAssignments(assignments);
    toast({ title: `تم توزيع ${assignments.length} معلمة تلقائيًا` });
  }

  async function handleSaveAssignments() {
    if (!expandedId) return;
    const payload = editingAssignments.map(a => ({ teacherId: a.teacherId, originalCircleId: a.originalCircleId, examCircleId: a.examCircleId }));
    await saveMutation.mutateAsync({ id: expandedId, data: { assignments: payload } });
    qc.invalidateQueries({ queryKey: ["listExamAssignments"] });
    toast({ title: "تم حفظ التوزيع" });
  }

  function updateAssignmentExamCircle(index: number, circleId: number) {
    setEditingAssignments(prev => prev.map((a, i) => i === index ? { ...a, examCircleId: circleId, examCircleName: circles.find(c => c.id === circleId)?.name ?? "" } : a));
  }

  function addManualAssignment() {
    setEditingAssignments(prev => [...prev, { teacherId: 0, teacherName: "", originalCircleId: 0, originalCircleName: "", examCircleId: 0, examCircleName: "" }]);
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
                      {rotation.isActive ? <Badge className="bg-green-100 text-green-700 text-xs">نشطة</Badge> : <Badge variant="secondary" className="text-xs">منتهية</Badge>}
                    </div>
                    <div className="text-sm text-muted-foreground">{rotation.startDate} — {rotation.endDate}</div>
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
                    <div className="flex gap-2 mb-4">
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

                  {editingAssignments.length === 0 ? (
                    <div className="text-center py-6 text-muted-foreground text-sm">
                      {isLeader ? "اضغطي «توزيع تلقائي» أو أضيفي يدويًا" : "لا يوجد توزيع بعد"}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="grid grid-cols-3 text-xs font-semibold text-muted-foreground px-2 mb-1">
                        <span>المعلمة</span><span>حلقتها الأصلية</span><span>تراقب في حلقة</span>
                      </div>
                      {editingAssignments.map((a, i) => (
                        <div key={i} className="grid grid-cols-3 gap-2 items-center bg-background rounded-lg p-2 border">
                          {isLeader ? (
                            <>
                              <Select value={String(a.teacherId)} onValueChange={v => updateManualAssignment(i, "teacherId", v)}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="معلمة..." /></SelectTrigger>
                                <SelectContent>{teachers.map(t => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}</SelectContent>
                              </Select>
                              <div className="text-sm text-muted-foreground px-1">{a.originalCircleName || "—"}</div>
                              <Select value={String(a.examCircleId)} onValueChange={v => updateAssignmentExamCircle(i, parseInt(v))}>
                                <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="حلقة الاختبار..." /></SelectTrigger>
                                <SelectContent>{circles.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.name}</SelectItem>)}</SelectContent>
                              </Select>
                            </>
                          ) : (
                            <>
                              <span className="text-sm font-medium">{a.teacherName}</span>
                              <span className="text-sm text-muted-foreground">{a.originalCircleName}</span>
                              <span className="text-sm font-medium text-primary">{a.examCircleName}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
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

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{editingRotation ? "تعديل الشقلبة" : "شقلبة جديدة"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div><Label>الاسم *</Label><Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="اختبارات المراجعة العامة..." /></div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>من تاريخ *</Label><Input type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} /></div>
              <div><Label>إلى تاريخ *</Label><Input type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} /></div>
            </div>
            <div className="flex items-center gap-3"><Switch checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} /><Label>نشطة</Label></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button onClick={handleSave}>حفظ</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
