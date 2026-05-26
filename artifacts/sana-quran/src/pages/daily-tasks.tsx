import { useState, useEffect } from "react";
import {
  useGetCurrentUser, useListCircles, useListTracks,
  useListSupervisorNames, useSaveDailyCircleTask,
  useListDailyCircleTasks, useListCustomQuestions, useSaveCustomQuestionAnswer,
  useCreateSupervisorName, useDeleteSupervisorName,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, ChevronDown, ChevronUp, ClipboardList, User, Clock, Plus, Trash2, Settings } from "lucide-react";

import { getMeccaToday } from "@/lib/utils";

const today = getMeccaToday();

const teacherOptions = [
  { value: "on_time", label: "حضرت بالوقت", color: "bg-green-100 text-green-800" },
  { value: "late", label: "تأخرت", color: "bg-yellow-100 text-yellow-800" },
  { value: "absent", label: "غابت", color: "bg-red-100 text-red-800" },
];
const prepOptions = [
  { value: "on_time", label: "أرسلت بالوقت", color: "bg-green-100 text-green-800" },
  { value: "late", label: "تأخرت", color: "bg-yellow-100 text-yellow-800" },
  { value: "not_done", label: "ما حضّرت", color: "bg-red-100 text-red-800" },
];
const motivationOptions = [
  { value: "done", label: "حفّزت", color: "bg-green-100 text-green-800" },
  { value: "not_done", label: "ما حفّزت", color: "bg-red-100 text-red-800" },
];
const reportOptions = [
  { value: "on_time", label: "أرسلت بالوقت", color: "bg-green-100 text-green-800" },
  { value: "late", label: "تأخرت", color: "bg-yellow-100 text-yellow-800" },
  { value: "not_done", label: "ما أرسلت", color: "bg-red-100 text-red-800" },
];

type CircleTaskState = {
  teacherAttendance: string;
  prepStatus: string;
  motivationStatus: string;
  reportStatus: string;
  circleAbsenceCount: number;
  customAnswers: Record<number, string>;
};

function OptionGroup({
  label, options, value, onChange,
}: { label: string; options: { value: string; label: string; color: string }[]; value: string; onChange: (v: string) => void }) {
  return (
    <div className="mb-3">
      <p className="text-xs text-muted-foreground mb-1.5 font-medium">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold border-2 transition-all ${
              value === o.value
                ? `${o.color} border-current shadow-sm scale-105`
                : "border-border text-muted-foreground hover:border-primary/40"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LeaderNamesManager() {
  const { data: tracks } = useListTracks({ query: { queryKey: ["tracks"] } });
  const [selectedTrackId, setSelectedTrackId] = useState<number | null>(null);
  const [newName, setNewName] = useState("");
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: supervisorNames } = useListSupervisorNames(selectedTrackId!, {
    query: { queryKey: ["supervisorNames", selectedTrackId], enabled: !!selectedTrackId },
  });

  const createName = useCreateSupervisorName();
  const deleteName = useDeleteSupervisorName();

  const handleAdd = async () => {
    if (!selectedTrackId || !newName.trim()) return;
    try {
      await createName.mutateAsync({ id: selectedTrackId, data: { name: newName.trim() } });
      setNewName("");
      qc.invalidateQueries({ queryKey: ["supervisorNames", selectedTrackId] });
      toast({ title: "تمت إضافة الاسم ✓" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  const handleDelete = async (nameId: number) => {
    try {
      await deleteName.mutateAsync({ id: nameId });
      qc.invalidateQueries({ queryKey: ["supervisorNames", selectedTrackId] });
      toast({ title: "تم الحذف" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  };

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4" dir="rtl">
      <div className="flex items-center gap-3 mb-2">
        <Settings className="text-primary w-6 h-6" />
        <h1 className="text-xl font-bold text-primary">إدارة أسماء مسؤولات المسار</h1>
      </div>

      <Card className="border-2 border-primary/20 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold">اختاري المسار</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="flex flex-wrap gap-2">
            {(tracks ?? []).map(t => (
              <button
                key={t.id}
                onClick={() => setSelectedTrackId(t.id)}
                className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                  selectedTrackId === t.id
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/40"
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {selectedTrackId && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              أسماء المسؤولات — {tracks?.find(t => t.id === selectedTrackId)?.name}
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-3">
            {/* Add new name */}
            <div className="flex gap-2">
              <Input
                value={newName}
                onChange={e => setNewName(e.target.value)}
                placeholder="اسم المسؤولة..."
                className="text-sm"
                onKeyDown={e => { if (e.key === "Enter") handleAdd(); }}
              />
              <Button
                size="sm"
                onClick={handleAdd}
                disabled={!newName.trim() || createName.isPending}
                className="shrink-0"
              >
                <Plus className="w-4 h-4" />
                إضافة
              </Button>
            </div>

            {/* Names list */}
            {!supervisorNames || supervisorNames.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-2">لا توجد أسماء بعد</p>
            ) : (
              <div className="space-y-2">
                {supervisorNames.map(n => (
                  <div key={n.id} className="flex items-center justify-between bg-muted/40 rounded-lg px-3 py-2">
                    <span className="text-sm font-medium">{n.name}</span>
                    <button
                      onClick={() => handleDelete(n.id)}
                      className="text-muted-foreground hover:text-red-500 transition-colors p-1"
                      disabled={deleteName.isPending}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function DailyTasksPage() {
  const { data: user } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });
  const { data: tracks } = useListTracks({ query: { queryKey: ["tracks"] } });
  const { data: circles } = useListCircles(undefined, { query: { queryKey: ["circles"] } });

  const isLeader = user?.role === "leader";

  const myTrack = tracks?.find(t => t.name === user?.track);
  const trackId = myTrack?.id;

  const { data: supervisorNames } = useListSupervisorNames(trackId!, {
    query: { queryKey: ["supervisorNames", trackId], enabled: !!trackId },
  });
  const { data: existingTasks } = useListDailyCircleTasks({ date: today }, {
    query: { queryKey: ["dailyCircleTasks", today] },
  });
  const { data: customQuestions } = useListCustomQuestions({ date: today }, {
    query: { queryKey: ["customQuestions", today] },
  });

  const [selectedNameId, setSelectedNameId] = useState<number | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [taskState, setTaskState] = useState<Record<number, CircleTaskState>>({});
  const [saved, setSaved] = useState<Record<number, boolean>>({});

  useEffect(() => {
    setSaved({});
    setTaskState({});
    setExpanded({});
  }, [selectedNameId]);

  const qc = useQueryClient();
  const { toast } = useToast();
  const saveTask = useSaveDailyCircleTask();

  const myCircles = circles?.filter(c => c.track === user?.track && !c.isArchived) ?? [];

  const getState = (circleId: number): CircleTaskState => taskState[circleId] ?? {
    teacherAttendance: "", prepStatus: "", motivationStatus: "",
    reportStatus: "", circleAbsenceCount: 0, customAnswers: {},
  };

  const updateState = (circleId: number, patch: Partial<CircleTaskState>) => {
    setTaskState(prev => ({ ...prev, [circleId]: { ...getState(circleId), ...patch } }));
    setSaved(prev => ({ ...prev, [circleId]: false }));
  };

  const isComplete = (circleId: number) => {
    const s = getState(circleId);
    return s.teacherAttendance && s.prepStatus && s.motivationStatus && s.reportStatus;
  };

  const handleSave = async (circleId: number) => {
    if (!selectedNameId) { toast({ title: "اختاري اسمك أولًا", variant: "destructive" }); return; }
    const s = getState(circleId);
    if (!isComplete(circleId)) { toast({ title: "يرجى إكمال جميع الحقول", variant: "destructive" }); return; }
    try {
      await saveTask.mutateAsync({
        data: {
          circleId, date: today, supervisorNameId: selectedNameId,
          teacherAttendance: s.teacherAttendance, prepStatus: s.prepStatus,
          motivationStatus: s.motivationStatus, reportStatus: s.reportStatus,
          circleAbsenceCount: s.circleAbsenceCount, notes: null,
          customAnswers: Object.entries(s.customAnswers).map(([qId, answer]) => ({
            questionId: parseInt(qId), answer,
          })),
        },
      });
      setSaved(prev => ({ ...prev, [circleId]: true }));
      qc.invalidateQueries({ queryKey: ["dailyCircleTasks"] });
      toast({ title: "تم الحفظ ✓" });
    } catch (err: unknown) {
      const e = err as { response?: { status?: number } };
      if (e?.response?.status === 409) {
        toast({ title: "هذه الحلقة سجّلتها مسؤولة أخرى لهذا اليوم", variant: "destructive" });
        qc.invalidateQueries({ queryKey: ["dailyCircleTasks"] });
      } else {
        toast({ title: "حدث خطأ", variant: "destructive" });
      }
    }
  };

  const alreadySavedCircles = existingTasks?.map(t => t.circleId) ?? [];

  const savedByName = new Map<number, string>();
  existingTasks?.forEach(t => { savedByName.set(t.circleId, t.supervisorName); });

  const savedByMe = existingTasks
    ?.filter(t => t.supervisorNameId === selectedNameId)
    .map(t => t.circleId) ?? [];

  if (!user) {
    return (
      <div className="p-6 text-center text-muted-foreground" dir="rtl">
        <p>جاري التحميل...</p>
      </div>
    );
  }

  if (isLeader) {
    return <LeaderNamesManager />;
  }

  if (!myTrack) {
    return (
      <div className="p-6 text-center text-muted-foreground" dir="rtl">
        <p>لم يُحدَّد مسارك بعد — تواصلي مع القائدة لتحديد مسارك في الحساب.</p>
      </div>
    );
  }

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-4" dir="rtl">
      <div className="flex items-center gap-3 mb-2">
        <ClipboardList className="text-primary w-6 h-6" />
        <h1 className="text-xl font-bold text-primary">المهام اليومية</h1>
        <Badge variant="outline" className="text-xs">{today}</Badge>
      </div>

      {/* Supervisor name selection */}
      <Card className="border-2 border-primary/20 shadow-sm">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            اختاري اسمك
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {!supervisorNames || supervisorNames.length === 0 ? (
            <p className="text-sm text-muted-foreground">لم تُضف أسماء المسؤولات بعد — تواصلي مع القائدة</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {supervisorNames.map(n => (
                <button
                  key={n.id}
                  onClick={() => setSelectedNameId(n.id)}
                  className={`px-4 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${
                    selectedNameId === n.id
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-foreground hover:border-primary/40"
                  }`}
                >
                  {n.name}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {selectedNameId && (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-muted-foreground">
            حلقات مسار {user.track} ({myCircles.length} حلقة)
          </p>

          {myCircles.map(circle => {
            const s = getState(circle.id);
            const isOpen = expanded[circle.id];
            const doneByMe = saved[circle.id] || savedByMe.includes(circle.id);
            const doneByOther = !doneByMe && alreadySavedCircles.includes(circle.id);
            const done = doneByMe || doneByOther;
            const complete = isComplete(circle.id);
            const savedBy = savedByName.get(circle.id);

            return (
              <Card key={circle.id} className={`border-2 transition-all shadow-sm ${
                doneByMe ? "border-green-400 bg-green-50/50"
                : doneByOther ? "border-blue-300 bg-blue-50/30"
                : "border-border"
              }`}>
                <button
                  className={`w-full px-4 py-3 flex items-center justify-between ${doneByOther ? "cursor-default" : ""}`}
                  onClick={() => !doneByOther && setExpanded(prev => ({ ...prev, [circle.id]: !isOpen }))}
                >
                  <div className="flex items-center gap-2 text-right">
                    {doneByMe
                      ? <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0" />
                      : doneByOther
                        ? <CheckCircle2 className="w-4 h-4 text-blue-400 flex-shrink-0" />
                        : <div className="w-4 h-4 rounded-full border-2 border-border flex-shrink-0" />
                    }
                    <span className="font-semibold text-sm">{circle.name}</span>
                    {doneByOther && savedBy && (
                      <span className="text-xs text-blue-500 font-medium">سجّلتها {savedBy}</span>
                    )}
                    {circle.meetingTime && !doneByOther && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="w-3 h-3" />{circle.meetingTime}
                      </span>
                    )}
                  </div>
                  {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isOpen && (
                  <CardContent className="px-4 pb-4 pt-0 border-t border-border/50">
                    <div className="mt-3 space-y-1">
                      <p className="text-xs font-bold text-primary mb-3">حضور المعلمة</p>
                      <OptionGroup label="" options={teacherOptions} value={s.teacherAttendance} onChange={v => updateState(circle.id, { teacherAttendance: v })} />

                      <p className="text-xs font-bold text-primary mb-2 mt-4">مهام المشرفة</p>
                      <OptionGroup label="التحضير:" options={prepOptions} value={s.prepStatus} onChange={v => updateState(circle.id, { prepStatus: v })} />
                      <OptionGroup label="التحفيز:" options={motivationOptions} value={s.motivationStatus} onChange={v => updateState(circle.id, { motivationStatus: v })} />
                      <OptionGroup label="الكشف:" options={reportOptions} value={s.reportStatus} onChange={v => updateState(circle.id, { reportStatus: v })} />

                      <div className="mt-3">
                        <p className="text-xs text-muted-foreground mb-1.5 font-medium">عدد غياب الحلقة:</p>
                        <select
                          className="border border-border rounded-lg px-3 py-1.5 text-sm bg-white w-28"
                          value={s.circleAbsenceCount}
                          onChange={e => updateState(circle.id, { circleAbsenceCount: parseInt(e.target.value) })}
                        >
                          {Array.from({ length: 16 }, (_, i) => (
                            <option key={i} value={i}>{i === 0 ? "لا غياب" : i}</option>
                          ))}
                        </select>
                      </div>

                      {customQuestions && customQuestions.length > 0 && (
                        <div className="mt-4 space-y-3 pt-3 border-t border-border/50">
                          <p className="text-xs font-bold text-primary">أسئلة إضافية</p>
                          {customQuestions.map(q => (
                            <div key={q.id}>
                              <p className="text-xs text-muted-foreground mb-1">{q.question}</p>
                              <textarea
                                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none"
                                rows={2}
                                placeholder="اكتبي إجابتك..."
                                value={s.customAnswers[q.id] ?? ""}
                                onChange={e => updateState(circle.id, {
                                  customAnswers: { ...s.customAnswers, [q.id]: e.target.value },
                                })}
                              />
                            </div>
                          ))}
                        </div>
                      )}

                      <Button
                        className="w-full mt-4"
                        size="sm"
                        onClick={() => handleSave(circle.id)}
                        disabled={!complete || saveTask.isPending}
                        variant={doneByMe ? "outline" : "default"}
                      >
                        {doneByMe ? "تم الحفظ ✓ (تعديل)" : doneByOther ? "تسجيل باسمي أيضًا" : "حفظ البيانات"}
                      </Button>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
