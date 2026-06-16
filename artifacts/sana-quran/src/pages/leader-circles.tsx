import { useState, useEffect, useCallback } from "react";
import { useGetCurrentUser } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  ChevronDown, ChevronUp, Users, Clock, Link2, Settings2, X,
  Check, Phone, Search, ArrowLeftRight, UserX, BookOpen,
} from "lucide-react";
import { getToken } from "@/lib/auth";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

type Student = { id: number; fullName: string };

type EnrichedCircle = {
  id: number;
  name: string;
  track: string;
  teacherId: number | null;
  supervisorId: number | null;
  meetingTime: string | null;
  whatsappLink: string | null;
  newStudentCapacity: number | null;
  teacherName: string | null;
  teacherPhone: string | null;
  supervisorName: string | null;
  supervisorPhone: string | null;
  students: Student[];
};

type AllCircleOption = { id: number; name: string; track: string };

const TRACK_COLORS: Record<string, string> = {
  "البهور": "bg-fuchsia-100 text-fuchsia-700 border-fuchsia-200",
  "إشراق": "bg-blue-100 text-blue-700 border-blue-200",
  "قبس": "bg-pink-100 text-pink-700 border-pink-200",
  "ضياء": "bg-amber-100 text-amber-700 border-amber-200",
  "وهج": "bg-rose-100 text-rose-700 border-rose-200",
  "سراج": "bg-emerald-100 text-emerald-700 border-emerald-200",
  "ألق": "bg-cyan-100 text-cyan-700 border-cyan-200",
  "مهج": "bg-orange-100 text-orange-700 border-orange-200",
  "مشكاة نور": "bg-sky-100 text-sky-700 border-sky-200",
};

function whatsappHref(phone: string | null | undefined): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return null;
  return `https://wa.me/${digits.startsWith("0") ? "966" + digits.slice(1) : digits}`;
}

function TransferModal({
  title,
  studentName,
  circles,
  currentCircleId,
  onConfirm,
  onClose,
  loading,
}: {
  title: string;
  studentName?: string;
  circles: AllCircleOption[];
  currentCircleId: number;
  onConfirm: (targetCircleId: number) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [step, setStep] = useState<"select" | "confirm">("select");
  const [search, setSearch] = useState("");
  const options = circles.filter(c => c.id !== currentCircleId && (!search || c.name.includes(search) || c.track.includes(search)));
  const fromCircle = circles.find(c => c.id === currentCircleId);
  const toCircle = circles.find(c => c.id === selected);

  if (step === "confirm" && selected) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
          <div className="p-4 border-b border-border flex items-center justify-between">
            <h3 className="font-bold text-base">تأكيد النقل</h3>
            <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
          </div>
          <div className="p-4 space-y-3">
            {studentName && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm font-semibold text-amber-800 text-center">
                {studentName}
              </div>
            )}
            <div className="flex items-center gap-2 justify-center text-sm">
              <div className="flex-1 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2.5 text-center">
                <p className="text-xs text-rose-500 mb-0.5">من</p>
                <p className="font-semibold text-rose-800 text-xs">{fromCircle?.name ?? "—"}</p>
                <p className="text-xs text-rose-600">{fromCircle?.track ?? ""}</p>
              </div>
              <ArrowLeftRight className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 text-center">
                <p className="text-xs text-emerald-500 mb-0.5">إلى</p>
                <p className="font-semibold text-emerald-800 text-xs">{toCircle?.name ?? "—"}</p>
                <p className="text-xs text-emerald-600">{toCircle?.track ?? ""}</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground text-center">ستختفي الطالبة من الحلقة القديمة وتنتقل للجديدة فوراً.</p>
          </div>
          <div className="p-3 flex gap-2 border-t">
            <Button size="sm" className="flex-1" disabled={loading} onClick={() => onConfirm(selected)}>
              {loading ? "جاري النقل..." : "تأكيد النقل"}
            </Button>
            <Button size="sm" variant="outline" className="flex-1" onClick={() => setStep("select")}>رجوع</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-base">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-muted"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="pe-3 pr-9 h-8 text-xs text-right" />
          </div>
        </div>
        <div className="p-3 max-h-64 overflow-y-auto space-y-1">
          {options.map(c => (
            <button
              key={c.id}
              onClick={() => setSelected(c.id)}
              className={`w-full text-right px-3 py-2.5 rounded-xl border-2 transition-all text-sm ${selected === c.id ? "border-primary bg-primary/5 font-semibold" : "border-border hover:border-primary/40"}`}
            >
              {c.name}
              <span className="text-xs text-muted-foreground mr-2">({c.track})</span>
            </button>
          ))}
          {options.length === 0 && <p className="text-center text-sm text-muted-foreground py-4">لا توجد حلقات</p>}
        </div>
        <div className="p-3 flex gap-2 border-t">
          <Button size="sm" className="flex-1" disabled={!selected} onClick={() => selected && setStep("confirm")}>
            التالي
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
        </div>
      </div>
    </div>
  );
}

export default function LeaderCirclesPage() {
  const { data: user } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });
  const { toast } = useToast();
  const isLeader = user?.role === "leader";
  const isTrackSup = user?.role === "track_supervisor";

  const [circles, setCircles] = useState<EnrichedCircle[]>([]);
  const [allCircles, setAllCircles] = useState<AllCircleOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedTracks, setExpandedTracks] = useState<Set<string>>(new Set());
  const [expandedCircles, setExpandedCircles] = useState<Set<number>>(new Set());

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editData, setEditData] = useState({ meetingTime: "", whatsappLink: "", newStudentCapacity: "" });
  const [saving, setSaving] = useState(false);

  const [transferModal, setTransferModal] = useState<{
    type: "teacher" | "supervisor" | "student";
    circleId: number;
    label: string;
    studentId?: number;
    studentName?: string;
  } | null>(null);
  const [transferLoading, setTransferLoading] = useState(false);

  const token = getToken();
  const headers = useCallback(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }), [token]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [enrichRes, namesRes] = await Promise.all([
        fetch(`${BASE}/api/circles/enriched`, { headers: headers() }),
        fetch(`${BASE}/api/circles/names`, { headers: headers() }),
      ]);
      if (enrichRes.ok) setCircles(await enrichRes.json());
      if (namesRes.ok) setAllCircles(await namesRes.json());
    } catch {
      toast({ title: "فشل تحميل البيانات", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [headers, toast]);

  useEffect(() => { load(); }, [load]);

  const toggleTrack = (track: string) => {
    setExpandedTracks(prev => {
      const next = new Set(prev);
      next.has(track) ? next.delete(track) : next.add(track);
      return next;
    });
  };

  const toggleCircle = (id: number) => {
    setExpandedCircles(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const startEdit = (c: EnrichedCircle) => {
    setEditingId(c.id);
    setEditData({
      meetingTime: c.meetingTime ?? "",
      whatsappLink: c.whatsappLink ?? "",
      newStudentCapacity: c.newStudentCapacity?.toString() ?? "",
    });
  };

  const saveEdit = async (id: number) => {
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        meetingTime: editData.meetingTime || null,
        whatsappLink: editData.whatsappLink || null,
      };
      if (isLeader) body.newStudentCapacity = editData.newStudentCapacity ? Number(editData.newStudentCapacity) : null;
      const res = await fetch(`${BASE}/api/circles/${id}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error();
      toast({ title: "تم الحفظ بنجاح" });
      setEditingId(null);
      await load();
    } catch {
      toast({ title: "حدث خطأ أثناء الحفظ", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleTransfer = async (targetCircleId: number) => {
    if (!transferModal) return;
    setTransferLoading(true);
    try {
      if (transferModal.type === "student" && transferModal.studentId != null) {
        const res = await fetch(`${BASE}/api/students/${transferModal.studentId}`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({ circleId: targetCircleId }),
        });
        if (!res.ok) throw new Error();
        toast({ title: "تم نقل الطالبة بنجاح" });
      } else {
        const field = transferModal.type === "teacher" ? "teacherId" : "supervisorId";
        const res = await fetch(`${BASE}/api/circles/${transferModal.circleId}`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({ [field]: null }),
        });
        if (!res.ok) throw new Error();
        const res2 = await fetch(`${BASE}/api/circles/${targetCircleId}`, {
          method: "PATCH",
          headers: headers(),
          body: JSON.stringify({ [field]: transferModal.type === "teacher"
            ? circles.find(c => c.id === transferModal.circleId)?.teacherId
            : circles.find(c => c.id === transferModal.circleId)?.supervisorId
          }),
        });
        if (!res2.ok) throw new Error();
        toast({ title: `تم نقل ${transferModal.type === "teacher" ? "المعلمة" : "المشرفة"} بنجاح` });
      }
      setTransferModal(null);
      await load();
    } catch {
      toast({ title: "فشل نقل العضو", variant: "destructive" });
    } finally {
      setTransferLoading(false);
    }
  };

  const removeFromCircle = async (circleId: number, type: "teacher" | "supervisor") => {
    if (!confirm(`هل تريدين إزالة ${type === "teacher" ? "المعلمة" : "المشرفة"} من الحلقة؟`)) return;
    try {
      const res = await fetch(`${BASE}/api/circles/${circleId}`, {
        method: "PATCH",
        headers: headers(),
        body: JSON.stringify({ [type === "teacher" ? "teacherId" : "supervisorId"]: null }),
      });
      if (!res.ok) throw new Error();
      toast({ title: "تم الإزالة بنجاح" });
      await load();
    } catch {
      toast({ title: "فشلت الإزالة", variant: "destructive" });
    }
  };

  const filtered = circles.filter(c =>
    !search || c.name.includes(search) || (c.teacherName ?? "").includes(search) || (c.supervisorName ?? "").includes(search)
  );

  const tracks = Array.from(new Set(filtered.map(c => c.track))).sort();
  const grouped: Record<string, EnrichedCircle[]> = {};
  filtered.forEach(c => {
    if (!grouped[c.track]) grouped[c.track] = [];
    grouped[c.track].push(c);
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-teal-50/20 pb-20" dir="rtl">
      <div className="max-w-3xl mx-auto px-4 pt-6 space-y-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            الحلقات
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isLeader ? "جميع حلقات المقرأة" : `مسار ${user?.track ?? ""}`}
          </p>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="بحث بالاسم أو المعلمة أو المشرفة..."
            className="pe-3 pr-10 text-right"
          />
        </div>

        {loading ? (
          <div className="text-center py-10 text-muted-foreground text-sm">جاري التحميل...</div>
        ) : (
          <div className="space-y-3">
            {tracks.map(track => {
              const trackCircles = grouped[track] ?? [];
              const isOpen = expandedTracks.has(track);
              const colorClass = TRACK_COLORS[track] ?? "bg-gray-100 text-gray-700 border-gray-200";

              return (
                <div key={track} className="bg-white rounded-2xl shadow-sm border border-border/50 overflow-hidden">
                  <button
                    onClick={() => toggleTrack(track)}
                    className="w-full flex items-center justify-between p-4 hover:bg-muted/20 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <Badge className={`text-sm px-3 py-1 border ${colorClass}`}>مسار {track}</Badge>
                      <span className="text-sm text-muted-foreground">{trackCircles.length} حلقات</span>
                      <span className="text-xs text-muted-foreground">
                        · {trackCircles.reduce((n, c) => n + c.students.length, 0)} طالبة
                      </span>
                    </div>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                  </button>

                  {isOpen && (
                    <div className="border-t border-border/30 divide-y divide-border/30">
                      {trackCircles.map(circle => {
                        const isEditing = editingId === circle.id;
                        const isExpanded = expandedCircles.has(circle.id);

                        return (
                          <div key={circle.id} className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <h3 className="font-bold text-base">{circle.name}</h3>
                                <div className="flex flex-wrap gap-3 mt-1.5 text-xs text-muted-foreground">
                                  {circle.meetingTime && (
                                    <span className="flex items-center gap-1 text-blue-700">
                                      <Clock className="w-3 h-3" />{circle.meetingTime}
                                    </span>
                                  )}
                                  {circle.whatsappLink && (
                                    <a href={circle.whatsappLink} target="_blank" rel="noopener noreferrer"
                                      className="flex items-center gap-1 text-green-700 hover:underline">
                                      <Link2 className="w-3 h-3" />واتساب الحلقة
                                    </a>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => isEditing ? setEditingId(null) : startEdit(circle)}
                                  className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground"
                                  title="تعديل"
                                >
                                  {isEditing ? <X className="w-3.5 h-3.5" /> : <Settings2 className="w-3.5 h-3.5" />}
                                </button>
                              </div>
                            </div>

                            {/* Edit form */}
                            {isEditing && (
                              <div className="mt-3 pt-3 border-t border-border/50 space-y-3">
                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold text-muted-foreground">وقت الاجتماع</Label>
                                  <input
                                    type="time"
                                    value={editData.meetingTime}
                                    onChange={e => setEditData(d => ({ ...d, meetingTime: e.target.value }))}
                                    className="h-8 text-xs border border-input rounded-md px-2 py-1.5 w-full bg-background"
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs font-semibold text-muted-foreground">رابط واتساب الحلقة</Label>
                                  <Input
                                    value={editData.whatsappLink}
                                    onChange={e => setEditData(d => ({ ...d, whatsappLink: e.target.value }))}
                                    placeholder="https://chat.whatsapp.com/..."
                                    className="h-8 text-xs"
                                    dir="ltr"
                                  />
                                </div>
                                {isLeader && (
                                  <div className="space-y-1">
                                    <Label className="text-xs font-semibold text-muted-foreground">الحد الأقصى للطالبات الجدد</Label>
                                    <Input
                                      type="number" min="0"
                                      value={editData.newStudentCapacity}
                                      onChange={e => setEditData(d => ({ ...d, newStudentCapacity: e.target.value }))}
                                      placeholder="اتركي فارغًا = بلا حد"
                                      className="h-8 text-xs text-right"
                                    />
                                  </div>
                                )}
                                <Button size="sm" className="w-full h-8 text-xs" onClick={() => saveEdit(circle.id)} disabled={saving}>
                                  <Check className="w-3.5 h-3.5 ml-1" />حفظ
                                </Button>
                              </div>
                            )}

                            {/* Teacher */}
                            <div className="mt-3 rounded-xl bg-rose-50/60 border border-rose-100 p-3">
                              <p className="text-xs font-semibold text-rose-800 mb-1.5">المعلمة</p>
                              {circle.teacherName ? (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{circle.teacherName}</span>
                                    {circle.teacherPhone && (
                                      <a href={whatsappHref(circle.teacherPhone) ?? `tel:${circle.teacherPhone}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100">
                                        <Phone className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                  {isLeader && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => setTransferModal({ type: "teacher", circleId: circle.id, label: `نقل المعلمة: ${circle.teacherName}` })}
                                        className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100" title="نقل لحلقة أخرى"
                                      >
                                        <ArrowLeftRight className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => removeFromCircle(circle.id, "teacher")}
                                        className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100" title="إزالة من الحلقة"
                                      >
                                        <UserX className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">لا توجد معلمة معيّنة</p>
                              )}
                            </div>

                            {/* Supervisor */}
                            <div className="mt-2 rounded-xl bg-blue-50/60 border border-blue-100 p-3">
                              <p className="text-xs font-semibold text-blue-800 mb-1.5">المشرفة</p>
                              {circle.supervisorName ? (
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm font-medium">{circle.supervisorName}</span>
                                    {circle.supervisorPhone && (
                                      <a href={whatsappHref(circle.supervisorPhone) ?? `tel:${circle.supervisorPhone}`}
                                        target="_blank" rel="noopener noreferrer"
                                        className="p-1 rounded bg-green-50 text-green-600 hover:bg-green-100">
                                        <Phone className="w-3 h-3" />
                                      </a>
                                    )}
                                  </div>
                                  {isLeader && (
                                    <div className="flex items-center gap-1">
                                      <button
                                        onClick={() => setTransferModal({ type: "supervisor", circleId: circle.id, label: `نقل المشرفة: ${circle.supervisorName}` })}
                                        className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100"
                                      >
                                        <ArrowLeftRight className="w-3 h-3" />
                                      </button>
                                      <button
                                        onClick={() => removeFromCircle(circle.id, "supervisor")}
                                        className="p-1 rounded bg-rose-50 text-rose-600 hover:bg-rose-100"
                                      >
                                        <UserX className="w-3 h-3" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <p className="text-xs text-muted-foreground">لا توجد مشرفة معيّنة</p>
                              )}
                            </div>

                            {/* Students */}
                            <div className="mt-2 rounded-xl bg-amber-50/60 border border-amber-100 p-3">
                              <button
                                onClick={() => toggleCircle(circle.id)}
                                className="w-full flex items-center justify-between"
                              >
                                <p className="text-xs font-semibold text-amber-800">
                                  الطالبات ({circle.students.length})
                                </p>
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-amber-700" /> : <ChevronDown className="w-3.5 h-3.5 text-amber-700" />}
                              </button>
                              {isExpanded && (
                                <div className="mt-2 space-y-1.5">
                                  {circle.students.length === 0 ? (
                                    <p className="text-xs text-muted-foreground">لا توجد طالبات</p>
                                  ) : circle.students.map(s => (
                                    <div key={s.id} className="flex items-center justify-between gap-2">
                                      <span className="text-sm">{s.fullName}</span>
                                      {(isLeader || isTrackSup) && (
                                        <button
                                          onClick={() => setTransferModal({ type: "student", circleId: circle.id, label: `نقل طالبة`, studentId: s.id, studentName: s.fullName })}
                                          className="p-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 flex-shrink-0"
                                          title="نقل لحلقة أخرى"
                                        >
                                          <ArrowLeftRight className="w-3 h-3" />
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>

                            <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                              <Users className="w-3 h-3" />
                              <span>{circle.students.length} طالبة</span>
                              {circle.newStudentCapacity != null && (
                                <span>· الحد الأقصى للجدد: {circle.newStudentCapacity}</span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {tracks.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">لا توجد حلقات مطابقة</div>
            )}
          </div>
        )}
      </div>

      {transferModal && (
        <TransferModal
          title={transferModal.label}
          studentName={transferModal.studentName}
          circles={allCircles}
          currentCircleId={transferModal.circleId}
          onConfirm={handleTransfer}
          onClose={() => setTransferModal(null)}
          loading={transferLoading}
        />
      )}
    </div>
  );
}
