import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CalendarCheck, Clock, CheckCircle2, AlertTriangle } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

function getToken() {
  return localStorage.getItem("sana_auth_token");
}

function authHeader(): Record<string, string> {
  const token = getToken();
  const h: Record<string, string> = { "Content-Type": "application/json" };
  if (token) h["Authorization"] = `Bearer ${token}`;
  return h;
}

function getMeccaToday(): Date {
  return new Date(Date.now() + 3 * 60 * 60 * 1000);
}

function getMeccaTodayStr(): string {
  return getMeccaToday().toISOString().slice(0, 10);
}

function getNextThursday(): string {
  const d = getMeccaToday();
  const dow = d.getUTCDay();
  const daysUntil = (4 - dow + 7) % 7 || 7;
  d.setDate(d.getUTCDate() + daysUntil);
  return d.toISOString().slice(0, 10);
}

function formatDateAr(dateStr: string): string {
  return new Date(dateStr + "T12:00:00Z").toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type ThursdaySession = {
  date: string;
  count: number;
  totalPages: number;
};

type BulkResult = {
  created: number;
  skipped: number;
};

export default function ThursdayReviewPage() {
  const { toast } = useToast();
  const todayStr = getMeccaTodayStr();
  const todayDow = getMeccaToday().getUTCDay();
  const isThursday = todayDow === 4;
  const nextThursday = isThursday ? todayStr : getNextThursday();

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BulkResult | null>(null);
  const [history, setHistory] = useState<ThursdaySession[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [alreadyDoneToday, setAlreadyDoneToday] = useState(false);

  useEffect(() => {
    async function fetchHistory() {
      try {
        const res = await fetch(`${BASE}/api/records/thursday-history`, { headers: authHeader() });
        if (res.ok) {
          const data: ThursdaySession[] = await res.json();
          setHistory(data);
          if (isThursday && data.some(s => s.date === todayStr)) {
            setAlreadyDoneToday(true);
          }
        }
      } catch {
        // ignore
      } finally {
        setHistoryLoading(false);
      }
    }
    fetchHistory();
  }, []);

  async function handleRunThursday() {
    if (!isThursday) return;
    setLoading(true);
    try {
      const res = await fetch(`${BASE}/api/records/thursday-bulk`, {
        method: "POST",
        headers: authHeader(),
        body: JSON.stringify({ date: todayStr }),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data);
        setAlreadyDoneToday(true);
        toast({ title: `تم إدخال مراجعة الخميس ✓ (${data.created} طالبة)` });
        const histRes = await fetch(`${BASE}/api/records/thursday-history`, { headers: authHeader() });
        if (histRes.ok) setHistory(await histRes.json());
      } else {
        toast({ title: data.error ?? "حدث خطأ", variant: "destructive" });
      }
    } catch {
      toast({ title: "تعذّر الاتصال بالخادم", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-black text-primary">مراجعة يوم الخميس</h1>
        <p className="text-sm text-muted-foreground mt-1">
          إدخال تلقائي لمراجعة الخميس من حفظ الأحد–الأربعاء
        </p>
      </div>

      {/* Status card */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CalendarCheck className="w-4 h-4 text-primary" />
            اليوم الحالي
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/40">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center text-white font-black text-sm ${isThursday ? "bg-emerald-500" : "bg-muted-foreground/40"}`}>
              {isThursday ? "✓" : new Date(todayStr + "T12:00:00Z").getUTCDay() === 0 ? "أح" :
                new Date(todayStr + "T12:00:00Z").getUTCDay() === 1 ? "إث" :
                new Date(todayStr + "T12:00:00Z").getUTCDay() === 2 ? "ثل" :
                new Date(todayStr + "T12:00:00Z").getUTCDay() === 3 ? "أر" :
                new Date(todayStr + "T12:00:00Z").getUTCDay() === 5 ? "جم" : "سب"}
            </div>
            <div>
              <p className="font-bold text-sm">{formatDateAr(todayStr)}</p>
              {isThursday
                ? <p className="text-xs text-emerald-600 font-medium">اليوم خميس — يمكن الإدخال الآن</p>
                : <p className="text-xs text-muted-foreground">الخميس القادم: {formatDateAr(nextThursday)}</p>}
            </div>
          </div>

          {/* Already done notice */}
          {alreadyDoneToday && !result && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-emerald-50 border border-emerald-200">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
              <p className="text-xs text-emerald-800 font-medium">
                تم إدخال مراجعة الخميس لهذا الأسبوع مسبقًا. يمكن الإعادة لتحديث السجلات الجديدة.
              </p>
            </div>
          )}

          {/* Result */}
          {result && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                <p className="font-bold text-emerald-800">تم الإدخال بنجاح!</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-center bg-white rounded-lg p-2 border border-emerald-200">
                  <p className="text-2xl font-black text-emerald-600">{result.created}</p>
                  <p className="text-xs text-muted-foreground">طالبة تم إدخالها</p>
                </div>
                <div className="text-center bg-white rounded-lg p-2 border border-emerald-200">
                  <p className="text-2xl font-black text-amber-500">{result.skipped}</p>
                  <p className="text-xs text-muted-foreground">تم تخطيها</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground">
                * تشمل المتخطيات: من لا حفظ لهن هذا الأسبوع، أو من أُدخلت لهن مسبقًا
              </p>
            </div>
          )}

          {/* Info */}
          {!result && (
            <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 flex gap-2 items-start">
              <AlertTriangle className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
              <p className="text-xs text-blue-800 leading-relaxed">
                سيُحسب مجموع ما حفظته كل طالبة من الأحد إلى الأربعاء ويُدخَل كمراجعة خميس.
                الطالبات اللواتي لا يوجد لهن حفظ هذا الأسبوع أو أُدخلت لهن مسبقًا سيتم تخطيهن.
              </p>
            </div>
          )}

          <Button
            className="w-full gap-2"
            disabled={!isThursday || loading}
            onClick={handleRunThursday}
            size="lg"
          >
            {loading
              ? <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإدخال...</>
              : !isThursday
              ? <><Clock className="w-4 h-4" /> متاح يوم الخميس فقط</>
              : <><CalendarCheck className="w-4 h-4" /> إدخال مراجعة الخميس</>
            }
          </Button>
        </CardContent>
      </Card>

      {/* History */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            سجل جلسات الخميس (آخر ١٢ أسبوعًا)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {historyLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-center text-sm text-muted-foreground py-6">
              لا توجد جلسات خميس مسجّلة بعد
            </p>
          ) : (
            <div className="space-y-2">
              {history.map(session => (
                <div
                  key={session.date}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${session.date === todayStr ? "bg-emerald-50 border-emerald-200" : "bg-muted/30 border-border/40"}`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${session.date === todayStr ? "bg-emerald-500 text-white" : "bg-muted text-muted-foreground"}`}>
                    {session.date === todayStr ? "✓" : "خ"}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">
                      {formatDateAr(session.date)}
                      {session.date === todayStr && <span className="mr-2 text-xs text-emerald-600 font-bold">(هذا الأسبوع)</span>}
                    </p>
                  </div>
                  <div className="text-center shrink-0">
                    <p className="text-sm font-bold text-primary">{session.count}</p>
                    <p className="text-[10px] text-muted-foreground">طالبة</p>
                  </div>
                  <div className="text-center shrink-0">
                    <p className="text-sm font-bold text-emerald-600">{session.totalPages}</p>
                    <p className="text-[10px] text-muted-foreground">وجه</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
