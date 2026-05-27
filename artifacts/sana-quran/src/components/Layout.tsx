import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useLocation } from "wouter";
import { useGetTodayBanner, useLogout, useGetMyMessages, useListStudents } from "@workspace/api-client-react";
import { clearToken, getToken, setToken } from "@/lib/auth";
import { useQueryClient } from "@tanstack/react-query";
import {
  Users, ClipboardList, BarChart3,
  UserCheck, Home, LogOut, Menu, X,
  CalendarCheck, PenSquare, Headphones, BookUser, FileDown,
  BarChart2, MessageSquare, Search, Clock, Archive, Layers,
  Calendar, ShoppingBag, Award, Shuffle, GraduationCap, AlertTriangle,
  ArrowLeftRight, Loader2, BookOpen,
} from "lucide-react";
import logoUrl from "@/assets/logo.jpg";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface LayoutProps {
  user: {
    id: number;
    name: string;
    role: string;
    email: string;
    track?: string | null;
  };
  children: React.ReactNode;
}

interface AccountInfo {
  id: number;
  name: string;
  role: string;
  roleLabel: string;
  track: string | null;
  isCurrent: boolean;
}

function useMyAccounts(userId: number) {
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    const base = import.meta.env.BASE_URL.replace(/\/$/, "");
    fetch(`${base}/api/auth/my-accounts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => (r.ok ? r.json() : []))
      .then((data: AccountInfo[]) => setAccounts(data))
      .catch(() => {});
  }, [userId]);
  return accounts;
}

function NavLink({ href, label, icon: Icon, badge }: { href: string; label: string; icon: React.ElementType; badge?: number }) {
  const [location] = useLocation();
  const isActive = location === href || (href !== "/" && location.startsWith(href));

  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 text-sm font-semibold group ${
        isActive
          ? "bg-white/20 text-white shadow-sm"
          : "text-white/70 hover:bg-white/10 hover:text-white"
      }`}
      data-testid={`nav-link-${href.replace("/", "") || "home"}`}
    >
      <Icon className={`w-4 h-4 flex-shrink-0 ${isActive ? "text-white" : "text-white/60 group-hover:text-white/80"}`} />
      <span>{label}</span>
      {badge != null && badge > 0 && (
        <span className="mr-auto ms-auto bg-rose-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 leading-none">
          {badge}
        </span>
      )}
      {isActive && !badge && <div className="me-auto w-1.5 h-1.5 rounded-full bg-white/80 me-0 ms-auto"></div>}
    </Link>
  );
}

function NewsTicker() {
  const { data: banner } = useGetTodayBanner({ query: { queryKey: ["todayBanner"] } });

  const achievement = banner?.achievement ?? [];
  const fullAttendance = banner?.leastAbsent ?? [];

  const achievementText = achievement.length > 0
    ? achievement
        .map(item => `${item.circleName} (${item.track}) — ${item.totalPages.toString().replace(".", ",")} وجه`)
        .join("   ✦   ")
    : "لا توجد بيانات إنجاز لليوم بعد";

  const attendanceText = fullAttendance.length > 0
    ? fullAttendance
        .map(item => `${item.circleName} (${item.track}) — ${item.presentCount} طالبة`)
        .join("   ✦   ")
    : "لا توجد حلقات بحضور كامل بعد";

  return (
    <div data-testid="news-ticker">
      <div className="text-white py-1.5 overflow-hidden relative"
        style={{ background: "linear-gradient(90deg, hsl(210, 51%, 25%) 0%, hsl(177, 35%, 38%) 100%)" }}
      >
        <div className="flex items-center gap-3 px-4">
          <div className="flex-shrink-0 bg-white/20 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">
            🏆 الأكثر إنجازًا
          </div>
          <div className="flex-1 overflow-hidden">
            <div className={achievement.length > 0 ? "ticker-scroll text-xs font-medium" : "text-xs font-medium opacity-70"}>
              {achievement.length > 0 ? `${achievementText}   ✦   ${achievementText}` : achievementText}
            </div>
          </div>
        </div>
      </div>
      <div className="text-white py-1.5 overflow-hidden relative"
        style={{ background: "linear-gradient(90deg, hsl(177, 40%, 30%) 0%, hsl(160, 45%, 35%) 100%)" }}
      >
        <div className="flex items-center gap-3 px-4">
          <div className="flex-shrink-0 bg-white/20 rounded-full px-2.5 py-0.5 text-xs font-bold whitespace-nowrap">
            ✅ أكثر حضورًا
          </div>
          <div className="flex-1 overflow-hidden">
            <div className={fullAttendance.length > 0 ? "ticker-scroll text-xs font-medium" : "text-xs font-medium opacity-70"}>
              {fullAttendance.length > 0 ? `${attendanceText}   ✦   ${attendanceText}` : attendanceText}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const SEARCH_ROLES = ["leader", "track_supervisor"];

function StudentSearch({ onNavigate }: { onNavigate: (path: string) => void }) {
  const [query, setQuery] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  const { data: results } = useListStudents(
    debouncedQ.length >= 2 ? { q: debouncedQ } : {},
    { query: { queryKey: ["studentSearch", debouncedQ], enabled: debouncedQ.length >= 2 } }
  );

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const showResults = open && debouncedQ.length >= 2 && results && results.length > 0;

  return (
    <div ref={wrapperRef} className="relative mx-4 mb-2">
      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40 pointer-events-none" />
        <input
          type="text"
          placeholder="بحث عن طالبة..."
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          className="w-full bg-white/10 text-white placeholder-white/40 text-sm rounded-xl pr-9 pl-3 py-2 border border-white/10 focus:outline-none focus:border-white/30 focus:bg-white/15 transition-colors"
          dir="rtl"
        />
        {query && (
          <button
            onClick={() => { setQuery(""); setDebouncedQ(""); setOpen(false); }}
            className="absolute left-2 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
      {showResults && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-xl z-50 overflow-hidden max-h-64 overflow-y-auto">
          {results!.slice(0, 6).map(s => (
            <button
              key={s.id}
              onClick={() => {
                onNavigate(`/students/${s.id}`);
                setQuery("");
                setOpen(false);
              }}
              className="w-full text-right px-3 py-2.5 hover:bg-muted/60 transition-colors border-b border-border/40 last:border-0"
            >
              <p className="text-sm font-medium text-foreground">{s.fullName}</p>
            </button>
          ))}
        </div>
      )}
      {open && debouncedQ.length >= 2 && results && results.length === 0 && (
        <div className="absolute top-full right-0 left-0 mt-1 bg-white rounded-xl shadow-xl z-50 px-3 py-3 text-xs text-muted-foreground text-center">
          لا توجد نتائج
        </div>
      )}
    </div>
  );
}

const MESSAGE_ROLES = ["student", "teacher", "supervisor", "track_supervisor"];

function formatDateShort(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", { month: "short", day: "numeric" });
}

function NewMessagesModal({ userId, role, navigate }: {
  userId: number; role: string; navigate: (p: string) => void;
}) {
  const enabled = MESSAGE_ROLES.includes(role);
  const { data: messages } = useGetMyMessages({ query: { queryKey: ["myMessages"], enabled } });
  const [open, setOpen] = useState(false);

  const sessionKey = `msgs_modal_${userId}`;
  const seenKey = `msgs_seen_${userId}`;

  useEffect(() => {
    if (!enabled || !messages || messages.length === 0) return;
    // Show modal only once per session if there are unread messages
    const shownThisSession = sessionStorage.getItem(sessionKey);
    if (shownThisSession) return;
    const lastSeen = localStorage.getItem(seenKey);
    const hasUnread = !lastSeen || messages.some(m => m.createdAt > lastSeen);
    if (hasUnread) {
      setOpen(true);
      sessionStorage.setItem(sessionKey, "1");
    }
  }, [messages, enabled, sessionKey, seenKey]);

  const handleClose = () => {
    localStorage.setItem(seenKey, new Date().toISOString());
    setOpen(false);
  };

  const handleGoToMessages = () => {
    handleClose();
    navigate("/my-messages");
  };

  if (!enabled || !messages || messages.length === 0) return null;

  const lastSeen = localStorage.getItem(seenKey);
  const unread = messages.filter(m => !lastSeen || m.createdAt > lastSeen);
  const displayMsgs = unread.length > 0 ? unread : messages.slice(0, 2);

  return (
    <Dialog open={open} onOpenChange={o => { if (!o) handleClose(); }}>
      <DialogContent className="max-w-sm" dir="rtl">
        <DialogHeader>
          <DialogTitle className="text-right flex items-center gap-2 text-primary">
            <MessageSquare className="w-5 h-5" />
            رسائل القائدة
            {unread.length > 0 && (
              <Badge className="bg-rose-500 text-white text-xs border-0 mr-auto">
                {unread.length} جديدة
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2.5 py-1 max-h-72 overflow-y-auto">
          {displayMsgs.map(msg => (
            <div key={msg.id} className="bg-primary/5 rounded-xl px-3.5 py-3 border border-primary/10">
              <p className="text-sm text-foreground leading-relaxed">{msg.content}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-muted-foreground">{formatDateShort(msg.createdAt)}</span>
                {msg.expiresAt && (
                  <span className="text-xs text-amber-600 flex items-center gap-1 mr-auto">
                    <Clock className="w-3 h-3" />
                    تنتهي {formatDateShort(msg.expiresAt)}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter className="gap-2 flex-row-reverse sm:flex-row-reverse">
          <Button
            className="flex-1 gap-1.5"
            onClick={handleGoToMessages}
          >
            <MessageSquare className="w-3.5 h-3.5" />
            كل الرسائل
          </Button>
          <Button variant="outline" onClick={handleClose} className="flex-1">
            حسنًا
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

const BADGE_ROLES = ["student", "teacher", "supervisor", "track_supervisor"];

function useUnreadMessageCount(userId: number, role: string, isHome: boolean, isMessagesPage: boolean) {
  const enabled = BADGE_ROLES.includes(role);
  const { data: messages } = useGetMyMessages({
    query: { queryKey: ["myMessages"], enabled, refetchInterval: 60000 },
  });

  const storageKey = `msgs_seen_${userId}`;

  useEffect(() => {
    if ((isHome || isMessagesPage) && enabled) {
      localStorage.setItem(storageKey, new Date().toISOString());
    }
  }, [isHome, isMessagesPage, enabled, storageKey]);

  return useMemo(() => {
    if (!enabled || !messages) return 0;
    const lastSeen = localStorage.getItem(storageKey);
    if (!lastSeen) return messages.length;
    return messages.filter(m => m.createdAt > lastSeen).length;
  }, [messages, enabled, storageKey]);
}

export default function Layout({ user, children }: LayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const queryClient = useQueryClient();
  const logout = useLogout();
  const [location, setLocation] = useLocation();
  const allAccounts = useMyAccounts(user.id);
  const otherAccounts = allAccounts.filter(a => !a.isCurrent);

  const isHome = location === "/";
  const isMessagesPage = location === "/my-messages";
  const unreadCount = useUnreadMessageCount(user.id, user.role, isHome, isMessagesPage);

  const handleLogout = () => {
    clearToken();
    queryClient.clear();
    logout.mutate(undefined);
    setLocation("/login");
  };

  const handleSwitchAccount = async (targetUserId: number) => {
    if (switching) return;
    setSwitching(true);
    try {
      const token = getToken();
      const base = import.meta.env.BASE_URL.replace(/\/$/, "");
      const res = await fetch(`${base}/api/auth/switch-account`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ targetUserId }),
      });
      if (!res.ok) return;
      const data = await res.json() as { token: string };
      setToken(data.token);
      queryClient.clear();
      setSidebarOpen(false);
      setLocation("/");
      window.location.reload();
    } catch {
    } finally {
      setSwitching(false);
    }
  };

  const navItems = getNavItems(user.role, unreadCount, user.track);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Messages popup on login */}
      <NewMessagesModal userId={user.id} role={user.role} navigate={(p) => { setLocation(p); setSidebarOpen(false); }} />

      {/* News Ticker */}
      <NewsTicker />

      <div className="flex flex-1">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 right-0 top-0 z-50 w-72 flex flex-col transition-transform duration-300 md:relative md:translate-x-0 ${
            sidebarOpen ? "translate-x-0" : "translate-x-full md:translate-x-0"
          }`}
          style={{
            background: "linear-gradient(180deg, hsl(210, 51%, 18%) 0%, hsl(210, 51%, 22%) 50%, hsl(204, 56%, 28%) 100%)"
          }}
        >
          {/* Logo */}
          <div className="p-5 border-b border-white/10">
            <div className="text-center">
              <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center mx-auto mb-3 shadow-lg overflow-hidden">
                <img src={logoUrl} alt="شعار مقرأة سَنا الآي" className="w-full h-full object-contain" />
              </div>
              <h1 className="text-white font-bold text-lg leading-tight">مقرأة سَنا الآي</h1>
              <p className="text-white/60 text-xs mt-1">نظام إدارة المقرأة</p>
            </div>
          </div>

          {/* User info + account switcher */}
          <div className="px-4 py-4 border-b border-white/10">
            {/* Current account card */}
            <div className="bg-white/10 rounded-xl p-3">
              <p className="text-white font-semibold text-sm truncate">{user.name}</p>
              <p className="text-white/60 text-xs mt-0.5">{getRoleLabel(user.role)}</p>
              {user.track && (
                <Badge className="mt-1 bg-white/20 text-white text-xs border-0">
                  مسار {user.track}
                </Badge>
              )}
            </div>

            {/* Other accounts */}
            {otherAccounts.length > 0 && (
              <div className="mt-2.5">
                <div className="flex items-center gap-1.5 px-1 mb-1.5">
                  <ArrowLeftRight className="w-3 h-3 text-white/40" />
                  <p className="text-white/40 text-[10px] font-medium">تبديل الحساب</p>
                </div>
                <div className="space-y-1">
                  {otherAccounts.map(acc => (
                    <button
                      key={acc.id}
                      onClick={() => handleSwitchAccount(acc.id)}
                      disabled={switching}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 disabled:opacity-50 disabled:cursor-wait"
                    >
                      <div className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center flex-shrink-0">
                        {switching
                          ? <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                          : <span className="text-xs font-bold text-white leading-none">{acc.name.charAt(0)}</span>
                        }
                      </div>
                      <div className="text-right flex-1 min-w-0">
                        <p className="text-sm font-medium text-white/90 truncate leading-tight">{acc.name}</p>
                        <p className="text-white/50 text-[11px] leading-tight">
                          {acc.roleLabel}{acc.track ? ` — ${acc.track}` : ""}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Student Search — leader & track_supervisor only */}
          {SEARCH_ROLES.includes(user.role) && (
            <div className="pt-3 pb-1">
              <StudentSearch onNavigate={(path) => { setLocation(path); setSidebarOpen(false); }} />
            </div>
          )}

          {/* Navigation */}
          <nav className="flex-1 p-4 overflow-y-auto space-y-1">
            {navItems.map(item => (
              <NavLink key={item.href} {...item} />
            ))}
          </nav>

          {/* Logout */}
          <div className="p-4 border-t border-white/10">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-white/70 hover:bg-white/10 hover:text-white transition-all duration-200 text-sm font-semibold"
              data-testid="button-logout"
            >
              <LogOut className="w-4 h-4" />
              <span>تسجيل الخروج</span>
            </button>
          </div>
        </aside>

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main content */}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Mobile header */}
          <header className="md:hidden bg-white border-b border-border px-4 py-3 flex items-center justify-between shadow-sm">
            <h1 className="text-primary font-bold text-base">مقرأة سَنا الآي</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              data-testid="button-menu"
            >
              {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </header>

          <div className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
            {children}
          </div>
          <footer className="text-center py-3 px-4 text-xs text-muted-foreground border-t border-border bg-background/50">
            جميع الحقوق محفوظة لمقرأة سَنا الآي &copy; 2026
          </footer>
        </main>
      </div>
    </div>
  );
}

const NO_REVIEW_PLAN_TRACKS = ["ألق", "سراج", "مهج", "مشكاة نور"];

function getRoleLabel(role: string): string {
  const labels: Record<string, string> = {
    leader: "القائدة",
    deputy: "النائبة",
    data_entry: "مُدخلة بيانات",
    teacher: "معلمة",
    supervisor: "مشرفة",
    student: "طالبة",
    track_supervisor: "مسؤولة مسار",
    exam_supervisor: "مسؤولة الاختبارات",
    volunteer: "متطوعة",
  };
  return labels[role] ?? role;
}

function getNavItems(role: string, unreadCount = 0, track?: string | null) {
  const hideReviewPlan = !!track && NO_REVIEW_PLAN_TRACKS.includes(track);

  if (role === "leader") {
    return [
      { href: "/", label: "الرئيسية", icon: Home },
      { href: "/data-entry-status", label: "المدخلات", icon: ClipboardList },
      { href: "/accounts", label: "الحسابات", icon: UserCheck },
      { href: "/statistics", label: "الإحصائيات", icon: BarChart3 },
      { href: "/attendance", label: "الغيابات", icon: CalendarCheck },
      { href: "/monthly-report", label: "تقرير الحضور", icon: BarChart2 },
      { href: "/archived-students", label: "المؤرشفات", icon: Archive },
      { href: "/circles", label: "الحلقات", icon: Users },
      { href: "/manage-tracks", label: "المسارات والحلقات", icon: Layers },
      { href: "/leader-tasks", label: "متابعة المهام اليومية", icon: ClipboardList },
      { href: "/deputy-board", label: "مهام النائبة", icon: ClipboardList },
      { href: "/volunteer", label: "الاختبارات", icon: GraduationCap },
      { href: "/teacher-rotation", label: "شقلبة المعلمات", icon: Shuffle },
      { href: "/badges", label: "الأوسمة", icon: Award },
      { href: "/calendar", label: "التقويم", icon: Calendar },
      { href: "/shortcomings", label: "التقصير", icon: AlertTriangle },
      { href: "/stumbling-stats", label: "إحصائيات التعثر", icon: AlertTriangle },
      { href: "/review-plans", label: "خطط المراجعة", icon: BookOpen },
      { href: "/thursday-review", label: "مراجعة الخميس", icon: CalendarCheck },
      { href: "/store-manage", label: "المتجر", icon: ShoppingBag },
      { href: "/messages", label: "الرسائل", icon: MessageSquare },
      { href: "/registration", label: "التسجيل", icon: PenSquare },
      { href: "/pending-registrations", label: "طلبات التسجيل", icon: ClipboardList },
      { href: "/onboard", label: "إضافة عضو مباشرة", icon: BookUser },
      { href: "/export", label: "تصدير البيانات", icon: FileDown },
    ];
  }
  if (role === "deputy") {
    return [
      { href: "/", label: "الرئيسية", icon: Home },
      { href: "/data-entry-status", label: "المدخلات", icon: ClipboardList },
      { href: "/accounts", label: "الحسابات", icon: UserCheck },
      { href: "/statistics", label: "الإحصائيات", icon: BarChart3 },
      { href: "/attendance", label: "الغيابات", icon: CalendarCheck },
      { href: "/monthly-report", label: "تقرير الحضور", icon: BarChart2 },
      { href: "/archived-students", label: "المؤرشفات", icon: Archive },
      { href: "/deputy-circles", label: "الحلقات", icon: Users },
      { href: "/manage-tracks", label: "المسارات والحلقات", icon: Layers },
      { href: "/leader-tasks", label: "متابعة المهام اليومية", icon: ClipboardList },
      { href: "/volunteer", label: "الاختبارات", icon: GraduationCap },
      { href: "/teacher-rotation", label: "شقلبة المعلمات", icon: Shuffle },
      { href: "/badges", label: "الأوسمة", icon: Award },
      { href: "/calendar", label: "التقويم", icon: Calendar },
      { href: "/shortcomings", label: "التقصير", icon: AlertTriangle },
      { href: "/stumbling-stats", label: "إحصائيات التعثر", icon: AlertTriangle },
      { href: "/review-plans", label: "خطط المراجعة", icon: BookOpen },
      { href: "/messages", label: "الرسائل", icon: MessageSquare },
      { href: "/registration", label: "التسجيل", icon: PenSquare },
      { href: "/pending-registrations", label: "طلبات التسجيل", icon: ClipboardList },
      { href: "/onboard", label: "إضافة عضو مباشرة", icon: BookUser },
      { href: "/export", label: "تصدير البيانات", icon: FileDown },
      { href: "/deputy-tasks", label: "مهامي", icon: ClipboardList },
    ];
  }
  if (role === "data_entry") {
    return [
      { href: "/", label: "إدخال البيانات", icon: PenSquare },
      { href: "/calendar", label: "التقويم", icon: Calendar },
    ];
  }
  if (role === "teacher" || role === "supervisor") {
    return [
      { href: "/", label: "حلقتي", icon: Users },
      { href: "/statistics", label: "الإحصائيات", icon: BarChart3 },
      ...(!hideReviewPlan ? [{ href: "/review-plans", label: "خطط المراجعة", icon: BookOpen }] : []),
      { href: "/badges", label: "أوسمتي", icon: Award },
      { href: "/calendar", label: "التقويم", icon: Calendar },
      { href: "/my-messages", label: "رسائلي", icon: MessageSquare, badge: unreadCount },
    ];
  }
  if (role === "student") {
    return [
      { href: "/", label: "تقدمي", icon: BarChart3 },
      { href: "/statistics", label: "إحصائياتي", icon: BarChart3 },
      { href: "/badges", label: "أوسمتي", icon: Award },
      ...(!hideReviewPlan ? [{ href: "/review-plans", label: "خطط المراجعة", icon: BookOpen }] : []),
      { href: "/calendar", label: "التقويم", icon: Calendar },
      { href: "/my-messages", label: "رسائلي", icon: MessageSquare, badge: unreadCount },
      { href: "/audio", label: "صوتيات المصحف", icon: Headphones },
    ];
  }
  if (role === "track_supervisor") {
    return [
      { href: "/", label: "مساري", icon: Users },
      { href: "/circles", label: "الحلقات", icon: BookOpen },
      { href: "/daily-tasks", label: "المهام اليومية", icon: ClipboardList },
      { href: "/statistics", label: "الإحصائيات", icon: BarChart3 },
      { href: "/attendance", label: "الغيابات", icon: CalendarCheck },
      { href: "/monthly-report", label: "تقرير الحضور", icon: BarChart2 },
      { href: "/archived-students", label: "المؤرشفات", icon: Archive },
      { href: "/badges", label: "الأوسمة", icon: Award },
      { href: "/calendar", label: "التقويم", icon: Calendar },
      { href: "/shortcomings", label: "التقصير", icon: AlertTriangle },
      { href: "/stumbling-stats", label: "إحصائيات التعثر", icon: AlertTriangle },
      ...(!hideReviewPlan ? [{ href: "/review-plans", label: "خطط المراجعة", icon: BookOpen }] : []),
      { href: "/messages", label: "الرسائل", icon: MessageSquare },
      { href: "/my-messages", label: "رسائلي", icon: MessageSquare, badge: unreadCount },
      { href: "/pending-registrations", label: "طلبات التسجيل", icon: ClipboardList },
    ];
  }
  if (role === "volunteer") {
    return [
      { href: "/", label: "الاختبارات", icon: GraduationCap },
      { href: "/calendar", label: "التقويم", icon: Calendar },
    ];
  }
  if (role === "exam_supervisor") {
    return [
      { href: "/", label: "الاختبارات", icon: GraduationCap },
      { href: "/statistics", label: "الإحصائيات", icon: BarChart3 },
      { href: "/calendar", label: "التقويم", icon: Calendar },
    ];
  }
  return [];
}
