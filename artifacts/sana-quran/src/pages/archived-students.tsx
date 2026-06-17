import { useState, useMemo, useEffect } from "react";
import { useListCircles } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Archive, RotateCcw, Search, UserCircle, Users, X, Check } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface ArchivedEntry {
  studentId: number;
  fullName: string;
  phone: string | null;
  country: string | null;
  isArchived: boolean;
  enrollmentId: number;
  circleId: number;
  archivedAt: string | null;
  circleName: string;
  circleTrack: string;
}

const getToken = () => localStorage.getItem("sana_auth_token");

export default function ArchivedStudentsPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();
  const [search, setSearch] = useState("");
  const [selectedTrack, setSelectedTrack] = useState("");
  const [restoringId, setRestoringId] = useState<number | null>(null);
  const [restoringEnrollmentCircleId, setRestoringEnrollmentCircleId] = useState<number | null>(null);
  const [selectedCircleId, setSelectedCircleId] = useState<string>("");
  const [isPending, setIsPending] = useState(false);

  const [archivedEntries, setArchivedEntries] = useState<ArchivedEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const { data: circles } = useListCircles(undefined, { query: { queryKey: ["circles-all"] } });

  async function fetchArchived() {
    setIsLoading(true);
    try {
      const res = await fetch("/api/students/enrollment-archived", {
        headers: { Authorization: `Bearer ${getToken()}` },
      });
      if (!res.ok) throw new Error();
      setArchivedEntries(await res.json());
    } catch {
      toast({ title: "خطأ في تحميل البيانات", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { fetchArchived(); }, []);

  const tracks = useMemo(() => {
    const set = new Set<string>();
    archivedEntries.forEach(e => { if (e.circleTrack) set.add(e.circleTrack); });
    return Array.from(set).sort();
  }, [archivedEntries]);

  const filtered = useMemo(() => {
    return archivedEntries.filter(e => {
      const matchSearch = !search || e.fullName.includes(search) || e.circleName.includes(search);
      const matchTrack = !selectedTrack || e.circleTrack === selectedTrack;
      return matchSearch && matchTrack;
    });
  }, [archivedEntries, search, selectedTrack]);

  // Group circles by track for the select
  const circlesByTrack = useMemo(() => {
    const map: Record<string, { id: number; name: string }[]> = {};
    circles?.forEach(c => {
      const track = (c as any).track ?? "غير محدد";
      if (!map[track]) map[track] = [];
      map[track].push({ id: c.id, name: c.name });
    });
    return map;
  }, [circles]);

  const handleRestoreClick = (e: ArchivedEntry) => {
    setRestoringId(e.studentId);
    setRestoringEnrollmentCircleId(e.circleId);
    setSelectedCircleId(String(e.circleId));
  };

  const handleRestoreConfirm = async (e: ArchivedEntry) => {
    const circleId = selectedCircleId ? parseInt(selectedCircleId, 10) : e.circleId;
    setIsPending(true);
    try {
      const res = await fetch(`/api/students/${e.studentId}/restore`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken()}` },
        body: JSON.stringify({ circleId }),
      });
      if (!res.ok) throw new Error();
      toast({ title: `تم استرجاع ${e.fullName} بنجاح` });
      queryClient.invalidateQueries({ queryKey: ["circles"] });
      await fetchArchived();
      setRestoringId(null);
    } catch {
      toast({ title: "حدث خطأ أثناء الاسترجاع", variant: "destructive" });
    } finally {
      setIsPending(false);
    }
  };

  const handleRestoreCancel = () => {
    setRestoringId(null);
    setRestoringEnrollmentCircleId(null);
    setSelectedCircleId("");
  };

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Archive className="w-5 h-5 text-gray-500" />
          الطالبات المؤرشفات
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          جميع الطالبات اللواتي أُرشفن من حلقاتهن
        </p>
      </div>

      <Card className="border border-border/50 shadow-sm">
        <CardContent className="pt-4 space-y-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ابحثي باسم الطالبة أو الحلقة..."
              className="pr-9 text-right"
            />
          </div>
          {tracks.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setSelectedTrack("")}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${!selectedTrack ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
              >
                الكل
              </button>
              {tracks.map(t => (
                <button
                  key={t}
                  onClick={() => setSelectedTrack(t)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${selectedTrack === t ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
                >
                  {t}
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Users className="w-4 h-4" />
        <span>
          {isLoading ? "جاري التحميل..." : `${filtered.length} طالبة مؤرشفة${filtered.length !== archivedEntries.length ? ` (من أصل ${archivedEntries.length})` : ""}`}
        </span>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-muted-foreground">جاري التحميل...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Archive className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>{search || selectedTrack ? "لا توجد نتائج مطابقة" : "لا توجد طالبات مؤرشفات"}</p>
        </div>
      ) : (
        <Card className="border border-border/50 shadow-sm">
          <CardContent className="p-0">
            <div className="divide-y divide-border/50">
              {filtered.map(e => {
                const isRestoring = restoringId === e.studentId && restoringEnrollmentCircleId === e.circleId;
                return (
                  <div key={`${e.studentId}-${e.enrollmentId}`} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{e.fullName}</p>
                        <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-muted-foreground">{e.circleName}</span>
                          {e.circleTrack && (
                            <Badge className="text-[10px] bg-teal-100 text-teal-700 border-0 px-1.5 py-0">
                              {e.circleTrack}
                            </Badge>
                          )}
                          {e.archivedAt && (
                            <span className="text-[10px] text-muted-foreground">
                              • أُرشفت {new Date(e.archivedAt).toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" })}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 flex-shrink-0">
                        <button
                          onClick={() => navigate(`/students/${e.studentId}`)}
                          className="p-1.5 rounded-lg bg-teal-50 text-teal-600 hover:bg-teal-100 transition-colors"
                          title="ملف الطالبة"
                        >
                          <UserCircle className="w-4 h-4" />
                        </button>
                        {!isRestoring && (
                          <button
                            onClick={() => handleRestoreClick(e)}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 transition-colors text-xs font-semibold"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                            استرجاع
                          </button>
                        )}
                      </div>
                    </div>

                    {isRestoring && (
                      <div className="mt-3 p-3 bg-emerald-50 rounded-xl border border-emerald-200 space-y-3">
                        <p className="text-xs font-semibold text-emerald-800">اختاري الحلقة للاسترجاع إليها:</p>
                        <select
                          value={selectedCircleId}
                          onChange={ev => setSelectedCircleId(ev.target.value)}
                          className="w-full text-sm rounded-lg border border-border bg-white px-3 py-2 text-right focus:outline-none focus:ring-2 focus:ring-emerald-400"
                        >
                          <option value={e.circleId}>— نفس الحلقة السابقة ({e.circleName}) —</option>
                          {Object.entries(circlesByTrack).map(([track, cs]) => (
                            <optgroup key={track} label={track}>
                              {cs.filter(c => c.id !== e.circleId).map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                            </optgroup>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleRestoreConfirm(e)}
                            disabled={isPending}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors text-xs font-semibold disabled:opacity-60"
                          >
                            <Check className="w-3.5 h-3.5" />
                            {isPending ? "جاري..." : "تأكيد الاسترجاع"}
                          </button>
                          <button
                            onClick={handleRestoreCancel}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-muted text-muted-foreground hover:bg-muted/80 transition-colors text-xs font-semibold"
                          >
                            <X className="w-3.5 h-3.5" />
                            إلغاء
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
