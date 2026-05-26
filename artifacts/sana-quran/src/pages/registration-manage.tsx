import {
  useGetRegistrationStatus,
  useOpenRegistration,
  useCloseRegistration,
  useListStudents,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle, XCircle, ClipboardList, Users, Plus, Trash2, GripVertical,
  Settings, BookUser, GraduationCap, Eye,
} from "lucide-react";
import { useState, useEffect } from "react";

const BASE_URL = import.meta.env.BASE_URL.replace(/\/$/, "");
const getToken = () => localStorage.getItem("sana_auth_token");

async function apiPost(path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ── Types ──────────────────────────────────────────────────────────────────
interface CustomQuestion {
  id: string;
  label: string;
  type: "text" | "select" | "yesno";
  options?: string[];
  required: boolean;
}

// ── Question Editor Row ────────────────────────────────────────────────────
function QuestionRow({
  q, onChange, onDelete,
}: {
  q: CustomQuestion;
  onChange: (q: CustomQuestion) => void;
  onDelete: () => void;
}) {
  const [optionsStr, setOptionsStr] = useState((q.options ?? []).join("، "));

  useEffect(() => {
    if (q.type === "select") {
      const opts = optionsStr.split("،").map(s => s.trim()).filter(Boolean);
      onChange({ ...q, options: opts });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [optionsStr]);

  return (
    <div className="border border-border rounded-xl p-3 space-y-2 bg-muted/20" data-testid="question-row">
      <div className="flex items-center gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        <Input
          value={q.label}
          onChange={e => onChange({ ...q, label: e.target.value })}
          placeholder="نص السؤال"
          className="flex-1 text-sm min-w-0"
          data-testid="input-question-label"
        />
        <Button variant="ghost" size="icon" onClick={onDelete} className="text-rose-500 hover:bg-rose-50 h-8 w-8 flex-shrink-0">
          <Trash2 className="w-4 h-4" />
        </Button>
      </div>
      <div className="flex items-center gap-3 pr-6">
        <Select value={q.type} onValueChange={v => onChange({ ...q, type: v as CustomQuestion["type"], options: [] })}>
          <SelectTrigger className="w-32 text-xs" data-testid="select-question-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">نص حر</SelectItem>
            <SelectItem value="select">قائمة</SelectItem>
            <SelectItem value="yesno">نعم/لا</SelectItem>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1">
          <Switch
            checked={q.required}
            onCheckedChange={v => onChange({ ...q, required: v })}
            id={`req-${q.id}`}
          />
          <Label htmlFor={`req-${q.id}`} className="text-xs text-muted-foreground whitespace-nowrap">إلزامي</Label>
        </div>
      </div>
      {q.type === "select" && (
        <div className="pr-6">
          <Input
            value={optionsStr}
            onChange={e => setOptionsStr(e.target.value)}
            placeholder="الخيارات مفصولة بفاصلة عربية: نعم، لا، أحيانًا"
            className="text-xs"
            data-testid="input-question-options"
          />
          <p className="text-xs text-muted-foreground mt-1">افصلي بين الخيارات بفاصلة عربية (،)</p>
        </div>
      )}
    </div>
  );
}

// ── Custom Questions Section ────────────────────────────────────────────────
function CustomQuestionsEditor({ formType }: { formType: "student" | "staff" }) {
  const { data: status } = useGetRegistrationStatus({ query: { queryKey: ["regStatus"] } });
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [questions, setQuestions] = useState<CustomQuestion[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const raw = formType === "staff"
      ? (status as any)?.staffCustomQuestions
      : status?.customQuestions;
    if (raw && !loaded) {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setQuestions(parsed);
          setLoaded(true);
        }
      } catch {
        // ignore
      }
    } else if (status && !loaded) {
      setLoaded(true);
    }
  }, [status, loaded, formType]);

  const addQuestion = () => {
    const newQ: CustomQuestion = {
      id: `q_${Date.now()}`,
      label: "",
      type: "text",
      required: false,
    };
    setQuestions(qs => [...qs, newQ]);
  };

  const updateQuestion = (idx: number, q: CustomQuestion) => {
    setQuestions(qs => qs.map((old, i) => (i === idx ? q : old)));
  };

  const deleteQuestion = (idx: number) => {
    setQuestions(qs => qs.filter((_, i) => i !== idx));
  };

  const saveQuestions = async () => {
    const invalid = questions.filter(q => !q.label.trim());
    if (invalid.length > 0) {
      toast({ title: "يرجى تعبئة نص جميع الأسئلة", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      await apiPost("/api/registration/save-questions", { formType, questions });
      toast({ title: "تم حفظ الأسئلة بنجاح" });
      queryClient.invalidateQueries({ queryKey: ["regStatus"] });
    } catch {
      toast({ title: "خطأ في الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
          <Settings className="w-4 h-4" />
          الأسئلة الإضافية في الاستمارة ({questions.length})
        </h3>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={addQuestion}
            className="text-xs"
            data-testid="button-add-question"
          >
            <Plus className="w-3 h-3 me-1" />
            إضافة سؤال
          </Button>
          <Button
            size="sm"
            onClick={saveQuestions}
            disabled={saving}
            className="text-xs"
            data-testid="button-save-questions"
          >
            {saving ? "جاري الحفظ..." : "حفظ الأسئلة"}
          </Button>
        </div>
      </div>

      {questions.length === 0 ? (
        <div className="text-center py-6 text-muted-foreground text-sm border border-dashed border-border rounded-xl">
          لا توجد أسئلة إضافية — اضغطي "إضافة سؤال" لإضافة أسئلة مخصصة
        </div>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => (
            <QuestionRow
              key={q.id}
              q={q}
              onChange={updated => updateQuestion(idx, updated)}
              onDelete={() => deleteQuestion(idx)}
            />
          ))}
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        ستظهر هذه الأسئلة للطالبة في استمارة التسجيل بعد الحقول الأساسية
      </p>
    </div>
  );
}

// ── Student Answers Dialog ──────────────────────────────────────────────────
function StudentAnswersDialog({
  student,
  questions,
  onClose,
}: {
  student: any;
  questions: { label: string; type: string }[];
  onClose: () => void;
}) {
  let extraData: Record<string, string> = {};
  try {
    if (student.extraData) extraData = JSON.parse(student.extraData);
  } catch {}

  const allKeys = Object.keys(extraData);
  const hasAnswers = allKeys.length > 0;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">أجوبة الاستمارة — {student.fullName}</DialogTitle>
        </DialogHeader>
        <div className="space-y-1 text-sm">
          {/* بيانات أساسية */}
          <div className="bg-muted/30 rounded-lg p-3 space-y-1 mb-3">
            {student.phone && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الجوال</span>
                <span className="font-medium" dir="ltr">{student.phone}</span>
              </div>
            )}
            {student.country && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الدولة</span>
                <span className="font-medium">{student.country}</span>
              </div>
            )}
            {student.ageRange && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">الفئة العمرية</span>
                <span className="font-medium">{student.ageRange}</span>
              </div>
            )}
          </div>

          {/* أجوبة الأسئلة الإضافية */}
          {hasAnswers ? (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-semibold border-b pb-1">الأسئلة الإضافية</p>
              {allKeys.map(key => (
                <div key={key} className="flex justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                  <span className="text-muted-foreground shrink-0">{key}</span>
                  <span className="font-medium text-left">{String(extraData[key]) || "—"}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-4 text-xs">
              لم تُجِب الطالبة على أسئلة إضافية
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────
export default function RegistrationManagePage() {
  const { data: status } = useGetRegistrationStatus({ query: { queryKey: ["regStatus"] } });
  const { data: students } = useListStudents(undefined, { query: { queryKey: ["students"] } });
  const openReg = useOpenRegistration();
  const closeReg = useCloseRegistration();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [staffLoading, setStaffLoading] = useState(false);
  const [viewingStudent, setViewingStudent] = useState<any>(null);

  const handleOpen = () => {
    openReg.mutate(
      { data: {} },
      {
        onSuccess: () => { toast({ title: "تم فتح تسجيل الطالبات" }); queryClient.invalidateQueries({ queryKey: ["regStatus"] }); },
        onError: () => toast({ title: "خطأ", variant: "destructive" }),
      }
    );
  };

  const handleClose = () => {
    closeReg.mutate(undefined, {
      onSuccess: () => { toast({ title: "تم إغلاق تسجيل الطالبات" }); queryClient.invalidateQueries({ queryKey: ["regStatus"] }); },
      onError: () => toast({ title: "خطأ", variant: "destructive" }),
    });
  };

  const handleStaffToggle = async (open: boolean) => {
    setStaffLoading(true);
    try {
      await apiPost(`/api/registration/${open ? "staff-open" : "staff-close"}`);
      toast({ title: open ? "تم فتح تسجيل الكادر" : "تم إغلاق تسجيل الكادر" });
      queryClient.invalidateQueries({ queryKey: ["regStatus"] });
    } catch {
      toast({ title: "خطأ في الاتصال", variant: "destructive" });
    } finally {
      setStaffLoading(false);
    }
  };

  const staffOpen = status?.staffRegistrationOpen !== false;
  const existingOpen = status?.existingStudentRegOpen === true;

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">إدارة التسجيل</h1>
        <p className="text-muted-foreground text-sm mt-1">التحكم الكامل في استمارات التسجيل وأسئلتها</p>
      </div>

      {/* ── استمارة الطالبات ── */}
      <Card className="border-0 shadow-sm" data-testid="card-student-registration">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            استمارة الطالبات الجديدات
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Open/Close */}
          <div className="flex items-center justify-between gap-4 flex-wrap bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              {status?.isOpen ? (
                <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-emerald-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
              )}
              <div>
                <p className="font-bold">التسجيل {status?.isOpen ? "مفتوح" : "مغلق"}</p>
                <p className="text-xs text-muted-foreground">{students?.length ?? 0} طالبة مسجلة</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleOpen} disabled={status?.isOpen || openReg.isPending}
                className="bg-emerald-600 hover:bg-emerald-700 text-white" data-testid="button-open-registration">
                فتح التسجيل
              </Button>
              <Button onClick={handleClose} disabled={!status?.isOpen || closeReg.isPending}
                variant="destructive" data-testid="button-close-registration">
                إغلاق التسجيل
              </Button>
            </div>
          </div>

          {status?.isOpen && (
            <div className="bg-emerald-50 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-emerald-800 mb-1">رابط استمارة تسجيل الطالبات</p>
              <p className="text-xs text-emerald-600 font-mono break-all">{window.location.origin}/register</p>
            </div>
          )}

          {/* Custom Questions Editor */}
          <div className="border-t border-border/50 pt-4">
            <CustomQuestionsEditor formType="student" />
          </div>
        </CardContent>
      </Card>

      {/* ── استمارة الكادر ── */}
      <Card className="border-0 shadow-sm" data-testid="card-staff-registration">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Users className="w-4 h-4 text-blue-600" />
            استمارة الكادر (المعلمات والمشرفات والمدخلات)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              {staffOpen ? (
                <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-blue-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
              )}
              <div>
                <p className="font-bold">تسجيل الكادر {staffOpen ? "مفتوح" : "مغلق"}</p>
                <p className="text-xs text-muted-foreground">
                  {staffOpen ? "الرابط ظاهر في صفحة الدخول" : "الرابط مخفي من صفحة الدخول"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => handleStaffToggle(true)} disabled={staffOpen || staffLoading}
                className="bg-blue-600 hover:bg-blue-700 text-white" data-testid="button-open-staff-registration">
                فتح التسجيل
              </Button>
              <Button onClick={() => handleStaffToggle(false)} disabled={!staffOpen || staffLoading}
                variant="destructive" data-testid="button-close-staff-registration">
                إغلاق التسجيل
              </Button>
            </div>
          </div>

          {staffOpen && (
            <div className="bg-blue-50 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-blue-800 mb-1">رابط استمارة تسجيل الكادر</p>
              <p className="text-xs text-blue-600 font-mono break-all">{window.location.origin}/staff-register</p>
            </div>
          )}

          <div className="border-t border-border/50 pt-4">
            <CustomQuestionsEditor formType="staff" />
          </div>
        </CardContent>
      </Card>

      {/* ── استمارة الطالبات الحاليات ── */}
      <Card className="border-0 shadow-sm" data-testid="card-existing-registration">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-teal-600" />
            استمارة الطالبات الحاليات (الموجودات في المقرأة)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            للطالبات المنضمات مسبقًا للمقرأة — يختارن حلقتهن مباشرةً وتنتقل بياناتهن لمعلمتهن فورًا
          </p>
          <div className="flex items-center justify-between gap-4 flex-wrap bg-muted/30 rounded-xl p-4">
            <div className="flex items-center gap-3">
              {existingOpen ? (
                <div className="w-10 h-10 rounded-full bg-teal-100 flex items-center justify-center">
                  <CheckCircle className="w-5 h-5 text-teal-600" />
                </div>
              ) : (
                <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center">
                  <XCircle className="w-5 h-5 text-rose-600" />
                </div>
              )}
              <div>
                <p className="font-bold">الاستمارة {existingOpen ? "مفتوحة" : "مغلقة"}</p>
                <p className="text-xs text-muted-foreground">
                  {existingOpen ? "الطالبات يمكنهن التسجيل الآن" : "الاستمارة موقوفة حاليًا"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                onClick={() => apiPost("/api/registration/existing-open").then(() => { toast({ title: "تم فتح الاستمارة" }); queryClient.invalidateQueries({ queryKey: ["regStatus"] }); }).catch(() => toast({ title: "خطأ", variant: "destructive" }))}
                disabled={existingOpen}
                className="bg-teal-600 hover:bg-teal-700 text-white"
                data-testid="button-open-existing-registration"
              >
                فتح الاستمارة
              </Button>
              <Button
                onClick={() => apiPost("/api/registration/existing-close").then(() => { toast({ title: "تم إغلاق الاستمارة" }); queryClient.invalidateQueries({ queryKey: ["regStatus"] }); }).catch(() => toast({ title: "خطأ", variant: "destructive" }))}
                disabled={!existingOpen}
                variant="destructive"
                data-testid="button-close-existing-registration"
              >
                إغلاق الاستمارة
              </Button>
            </div>
          </div>
          {existingOpen && (
            <div className="bg-teal-50 rounded-lg px-4 py-3">
              <p className="text-sm font-semibold text-teal-800 mb-1">رابط استمارة الطالبات الحاليات</p>
              <p className="text-xs text-teal-600 font-mono break-all">{window.location.origin}/register-existing</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── إضافة عضو مباشرة ── */}
      <Card className="border-0 shadow-sm" data-testid="card-onboard-link">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-bold text-sm">إضافة طالبة أو كادر مباشرة إلى الحلقات</p>
              <p className="text-xs text-muted-foreground mt-0.5">سجّلي الأعضاء الحاليين وانقليهم مباشرة لحلقاتهم</p>
            </div>
            <a href="/onboard">
              <Button className="gap-2" data-testid="button-go-to-onboard">
                <BookUser className="w-4 h-4" />
                إضافة عضو
              </Button>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* ── قائمة الطالبات ── */}
      <Card className="border-0 shadow-sm" data-testid="card-students-list">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-primary" />
            الطالبات المسجلات ({students?.length ?? 0})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {(students?.length ?? 0) === 0 ? (
            <p className="text-center text-muted-foreground py-8 text-sm">لا توجد طالبات مسجلات</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 border-b border-border">
                  <tr>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الاسم</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الجوال</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الفئة العمرية</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الدولة</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الحالة</th>
                    <th className="text-right py-3 px-4 font-semibold text-muted-foreground">الأجوبة</th>
                  </tr>
                </thead>
                <tbody>
                  {students?.map(student => {
                    let hasExtra = false;
                    try { hasExtra = !!(student as any).extraData && Object.keys(JSON.parse((student as any).extraData)).length > 0; } catch {}
                    return (
                      <tr key={student.id} className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                        data-testid={`row-student-${student.id}`}>
                        <td className="py-2.5 px-4 font-semibold">{student.fullName}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs" dir="ltr">{student.phone ?? "—"}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{student.ageRange ?? "—"}</td>
                        <td className="py-2.5 px-4 text-muted-foreground text-xs">{student.country ?? "—"}</td>
                        <td className="py-2.5 px-4">
                          <Badge className={`text-xs border-0 ${student.isArchived ? "bg-gray-100 text-gray-500" : "bg-emerald-100 text-emerald-700"}`}>
                            {student.isArchived ? "مؤرشفة" : "نشطة"}
                          </Badge>
                        </td>
                        <td className="py-2.5 px-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 px-2 gap-1 text-xs text-primary hover:bg-primary/10"
                            onClick={() => setViewingStudent(student)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {hasExtra ? "عرض" : "بيانات"}
                          </Button>
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

      {/* ── حوار عرض أجوبة الطالبة ── */}
      {viewingStudent && (
        <StudentAnswersDialog
          student={viewingStudent}
          questions={(() => {
            try { return JSON.parse(status?.customQuestions ?? "[]"); } catch { return []; }
          })()}
          onClose={() => setViewingStudent(null)}
        />
      )}
    </div>
  );
}
