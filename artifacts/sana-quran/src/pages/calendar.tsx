import { useEffect, useState } from "react";
import {
  useListCalendarEvents,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, Pencil, CalendarDays, Clock, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const EVENT_TYPES = [
  { value: "holiday",  label: "إجازة",   color: "#ef4444", bg: "bg-red-50",    text: "text-red-700",    border: "border-red-200"    },
  { value: "exam",     label: "اختبار",  color: "#f59e0b", bg: "bg-amber-50",  text: "text-amber-700",  border: "border-amber-200"  },
  { value: "activity", label: "نشاط",    color: "#c08457", bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  { value: "reminder", label: "تذكير",   color: "#7c3aed", bg: "bg-violet-50", text: "text-violet-700", border: "border-violet-200" },
  { value: "general",  label: "عام",     color: "#2b3784", bg: "bg-indigo-50", text: "text-indigo-700", border: "border-indigo-200" },
];

function getTypeInfo(eventType: string) {
  return EVENT_TYPES.find(t => t.value === eventType) ?? EVENT_TYPES[EVENT_TYPES.length - 1];
}

function formatArabicDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ar-SA", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

function formatDualDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  const gregorian = d.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
  const hijri = d.toLocaleDateString("ar-SA-u-ca-islamic-umalqura", { year: "numeric", month: "short", day: "numeric" });
  return `${hijri} هـ · ${gregorian} م`;
}

function semesterCards(events: any[]) {
  const starts = events.filter(e => /بداية الفصل/.test(e.title)).sort((a, b) => a.date.localeCompare(b.date));
  return starts.map((start, index) => {
    const nextStart = starts[index + 1]?.date;
    const inTerm = events
      .filter(e => e.date >= start.date && (!nextStart || e.date < nextStart))
      .sort((a, b) => a.date.localeCompare(b.date));
    const pick = (pattern: RegExp) => inTerm.find(e => pattern.test(e.title));
    return {
      title: start.title.replace(/^بداية\s*/, "").trim(),
      start: start,
      review: pick(/مراجعة/),
      exam: pick(/اختبار/),
      holiday: pick(/إجازة|إحازة/),
    };
  });
}

function daysUntil(dateStr: string): number {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr + "T00:00:00");
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
}

function daysLabel(days: number): string {
  if (days === 0) return "اليوم";
  if (days === 1) return "غدًا";
  if (days === -1) return "أمس";
  if (days < 0) return `منذ ${Math.abs(days)} يوم`;
  if (days <= 10) return `بعد ${days} أيام`;
  return `بعد ${days} يومًا`;
}

interface EventItemProps {
  event: any;
  isLeader: boolean;
  onEdit: (e: any) => void;
  onDelete: (id: number) => void;
}

function EventItem({ event, isLeader, onEdit, onDelete }: EventItemProps) {
  const typeInfo = getTypeInfo(event.eventType);
  const days = daysUntil(event.date);
  const isPast = days < 0;
  const isToday = days === 0;
  const isSoon = days > 0 && days <= 7;

  return (
    <div
      className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${
        isToday
          ? `${typeInfo.bg} ${typeInfo.border} border-2 shadow-sm`
          : isPast
          ? "bg-muted/30 border-border/40 opacity-60"
          : isSoon
          ? `${typeInfo.bg} ${typeInfo.border} shadow-sm`
          : "bg-card border-border"
      }`}
    >
      <div
        className="w-3 h-3 rounded-full mt-1.5 shrink-0"
        style={{ backgroundColor: event.color }}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className={`font-semibold text-sm ${isPast ? "text-muted-foreground" : "text-foreground"}`}>
            {event.title}
          </span>
          {isToday && (
            <Badge className="bg-primary/10 text-primary border-0 text-[10px] px-1.5 py-0 font-bold">اليوم ✦</Badge>
          )}
          {isSoon && !isToday && (
            <Badge className={`${typeInfo.bg} ${typeInfo.text} border-0 text-[10px] px-1.5 py-0`}>
              {daysLabel(days)}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          {formatArabicDate(event.date)}
          {event.endDate && event.endDate !== event.date && ` — ${formatArabicDate(event.endDate)}`}
        </p>
        {event.description && (
          <p className="text-xs text-muted-foreground/80 mt-1">{event.description}</p>
        )}
        <div className="flex items-center gap-2 mt-1.5">
          <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${typeInfo.bg} ${typeInfo.text}`}>
            {getTypeInfo(event.eventType).label}
          </span>
          {!isPast && !isToday && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {daysLabel(days)}
            </span>
          )}
        </div>
      </div>
      {isLeader && (
        <div className="flex gap-1 shrink-0">
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
            onClick={() => onEdit(event)}
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-destructive/10 transition-colors text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(event.id)}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

interface CalendarPageProps { userRole?: string; userId?: number; publicView?: boolean; }

export default function CalendarPage({ userRole, publicView = false }: CalendarPageProps) {
  const today = (() => { const d = new Date(Date.now() + 3*60*60*1000); if(d.getUTCHours()<5) d.setUTCDate(d.getUTCDate()-1); return d.toISOString().slice(0,10); })();
  const currentYear = new Date().getFullYear();

  const [showDialog, setShowDialog] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const [showPast, setShowPast] = useState(false);
  const [openSemesters, setOpenSemesters] = useState<Record<number, boolean>>({});
  const [publicEvents, setPublicEvents] = useState<any[]>([]);
  const [form, setForm] = useState({
    title: "", date: "", endDate: "", color: "#6366f1",
    eventType: "general", description: "",
  });
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: events = [] } = useListCalendarEvents({ year: currentYear }, {
    query: { enabled: !publicView, queryKey: ["calendarEvents", currentYear] },
  });
  const { data: nextYearEvents = [] } = useListCalendarEvents({ year: currentYear + 1 }, {
    query: { enabled: !publicView, queryKey: ["calendarEvents", currentYear + 1] },
  });
  useEffect(() => {
    if (!publicView) return;
    fetch("/api/public/calendar-events")
      .then(response => response.ok ? response.json() : [])
      .then(setPublicEvents)
      .catch(() => setPublicEvents([]));
  }, [publicView]);

  const allEvents = publicView ? publicEvents : [...events, ...nextYearEvents];

  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();

  const isLeader = userRole === "leader" || userRole === "deputy";

  function invalidate() {
    qc.invalidateQueries({ queryKey: ["listCalendarEvents"] });
  }

  function openNew() {
    setEditingEvent(null);
    setForm({ title: "", date: today, endDate: "", color: "#6366f1", eventType: "general", description: "" });
    setShowDialog(true);
  }

  function openEdit(e: any) {
    setEditingEvent(e);
    setForm({
      title: e.title, date: e.date, endDate: e.endDate ?? "",
      color: e.color, eventType: e.eventType, description: e.description ?? "",
    });
    setShowDialog(true);
  }

  async function handleSave() {
    if (!form.title || !form.date) {
      toast({ title: "أدخلي العنوان والتاريخ", variant: "destructive" });
      return;
    }
    try {
      if (editingEvent) {
        await updateMutation.mutateAsync({ id: editingEvent.id, data: { ...form, endDate: form.endDate || null } });
      } else {
        await createMutation.mutateAsync({ data: { ...form, endDate: form.endDate || null } });
      }
      invalidate();
      setShowDialog(false);
      toast({ title: "تم الحفظ" });
    } catch {
      toast({ title: "حدث خطأ", variant: "destructive" });
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("هل تريدين حذف هذه المناسبة؟")) return;
    await deleteMutation.mutateAsync({ id });
    invalidate();
    toast({ title: "تم الحذف" });
  }

  const upcoming = allEvents
    .filter(e => e.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  const past = allEvents
    .filter(e => e.date < today)
    .sort((a, b) => b.date.localeCompare(a.date));

  const nextEvent = upcoming[0] ?? null;
  const nextDays = nextEvent ? daysUntil(nextEvent.date) : null;
  const nextTypeInfo = nextEvent ? getTypeInfo(nextEvent.eventType) : null;
  const semesters = semesterCards(allEvents);

  return (
    <div className="space-y-5 pb-10" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <CalendarDays className="w-6 h-6 text-primary" />
            مناسبات المقرأة
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {today.replace(/-/g, "/")} · {new Date(today).toLocaleDateString("ar-SA", { weekday: "long" })}
          </p>
        </div>
        {isLeader && (
          <Button size="sm" className="gap-1.5" onClick={openNew}>
            <Plus className="w-4 h-4" />
            إضافة
          </Button>
        )}
      </div>

      {nextEvent && (
        <Card className={`border-2 ${nextTypeInfo?.border} shadow-sm overflow-hidden`}>
          <CardContent className="p-0">
            <div className={`px-4 py-3 ${nextTypeInfo?.bg}`}>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1 uppercase tracking-wide">
                المناسبة القادمة
              </p>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className={`text-lg font-bold ${nextTypeInfo?.text} leading-tight`}>
                    {nextEvent.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatArabicDate(nextEvent.date)}
                    {nextEvent.endDate && nextEvent.endDate !== nextEvent.date
                      ? ` — ${formatArabicDate(nextEvent.endDate)}` : ""}
                  </p>
                  {nextEvent.description && (
                    <p className="text-xs text-muted-foreground/80 mt-1">{nextEvent.description}</p>
                  )}
                </div>
                <div className={`shrink-0 text-center px-3 py-2 rounded-xl bg-white/70 border ${nextTypeInfo?.border}`}>
                  {nextDays === 0 ? (
                    <>
                      <p className={`text-xl font-black ${nextTypeInfo?.text}`}>اليوم</p>
                    </>
                  ) : (
                    <>
                      <p className={`text-3xl font-black leading-none ${nextTypeInfo?.text}`}>{nextDays}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">يوم</p>
                    </>
                  )}
                </div>
              </div>
            </div>
            {isLeader && (
              <div className="flex gap-1 px-4 pb-2 pt-1">
                <button
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-foreground transition-colors"
                  onClick={() => openEdit(nextEvent)}
                >
                  <Pencil className="w-3 h-3" /> تعديل
                </button>
                <span className="text-muted-foreground/40 mx-1">·</span>
                <button
                  className="text-xs text-muted-foreground flex items-center gap-1 hover:text-destructive transition-colors"
                  onClick={() => handleDelete(nextEvent.id)}
                >
                  <Trash2 className="w-3 h-3" /> حذف
                </button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {upcoming.length === 0 && past.length === 0 && (
        <Card className="border-0 shadow-sm">
          <CardContent className="py-14 text-center">
            <CalendarDays className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">لا توجد مناسبات مُسجّلة بعد</p>
            {isLeader && (
              <Button size="sm" className="mt-4 gap-1.5" onClick={openNew}>
                <Plus className="w-4 h-4" />
                أضيفي أول مناسبة
              </Button>
            )}
          </CardContent>
        </Card>
      )}

      {semesters.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2">
          {semesters.map((semester, index) => (
            <Card key={`${semester.start.id}-${index}`} className={`border-0 shadow-sm overflow-hidden ring-1 ${index === 0 ? "ring-slate-200" : "ring-indigo-200/70"}`}>
              <button
                type="button"
                className={`w-full text-right px-4 py-3 flex items-center justify-between transition-colors ${index === 0 ? "bg-[#F1F2F8] hover:bg-[#E8EAF4]" : "bg-gradient-to-l from-[#F0EEFA] to-[#EEF0FA] hover:from-[#E8E5F6] hover:to-[#E6E8F5]"}`}
                onClick={() => setOpenSemesters(s => ({ ...s, [index]: !(s[index] ?? index !== 0) }))}
                aria-expanded={openSemesters[index] ?? index !== 0}
              >
                <div>
                  <p className="font-bold text-base text-[#1A2260]">{semester.title}</p>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {index === 0 ? "فصل منتهٍ — اضغطي لعرض التفاصيل" : "الفصل الحالي والمواعيد القادمة"}
                  </p>
                </div>
                {openSemesters[index] ?? index !== 0
                   ? <ChevronUp className="w-5 h-5 text-[#2B3784]" />
                  : <ChevronDown className="w-5 h-5 text-[#9EA8CC]" />}
              </button>
              {(openSemesters[index] ?? index !== 0) && (
                <CardContent className="p-0 text-sm">
                  {[
                    ["تاريخ البدء", semester.start],
                    ["أسبوع المراجعة", semester.review],
                    ["أسبوع الاختبار", semester.exam],
                    ["الإجازة", semester.holiday],
                  ].map(([label, event]: any, eventIndex) => {
                    const typeInfo = event ? getTypeInfo(event.eventType) : null;
                    return (
                      <div key={label} className="flex items-start justify-between gap-3 px-4 py-3 border-b border-[#C8CDE8]/40 last:border-0" style={{ borderRight: `4px solid ${typeInfo?.color ?? (eventIndex === 0 ? "#2B3784" : "#C4A76A")}` }}>
                        <span className="font-semibold text-[#4A5590] shrink-0">{label}</span>
                        <span className="text-left text-xs leading-5 text-[#3D4E9C]">
                          {event ? `${formatDualDate(event.date)}${event.endDate && event.endDate !== event.date ? ` — ${formatDualDate(event.endDate)}` : ""}` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingEvent ? "تعديل المناسبة" : "إضافة مناسبة"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-sm">العنوان *</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="مثال: إجازة منتصف الفصل"
                className="mt-1"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-sm">تاريخ البداية *</Label>
                <Input
                  type="date"
                  value={form.date}
                  onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-sm">تاريخ النهاية</Label>
                <Input
                  type="date"
                  value={form.endDate}
                  onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label className="text-sm">النوع</Label>
              <Select
                value={form.eventType}
                onValueChange={v => {
                  const t = EVENT_TYPES.find(x => x.value === v);
                  setForm(f => ({ ...f, eventType: v, color: t?.color ?? f.color }));
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map(t => (
                    <SelectItem key={t.value} value={t.value}>
                      <span className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: t.color }} />
                        {t.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-sm">وصف (اختياري)</Label>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                rows={2}
                className="mt-1 text-sm"
                placeholder="تفاصيل إضافية..."
              />
            </div>
          </div>
          <DialogFooter className="gap-2 mt-2">
            <Button variant="outline" onClick={() => setShowDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleSave}
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
