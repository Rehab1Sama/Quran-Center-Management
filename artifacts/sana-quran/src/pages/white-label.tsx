import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  Globe, Palette, Zap, CheckSquare, Square, Rocket, Trash2,
  ExternalLink, RefreshCw, Eye, EyeOff, Key, Github, Copy, Check,
  BookOpen, Award, ShoppingBag, Headphones, Calendar, MessageSquare,
  RotateCcw, AlertTriangle, GraduationCap, PlaneTakeoff, ClipboardList,
} from "lucide-react";
import { applyThemeFromHex, resetTheme, hslToHex } from "@/components/ThemeProvider";
import { useGetCurrentUser } from "@workspace/api-client-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const getToken = () => localStorage.getItem("sana_auth_token");

const headers = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

const PALETTE_PRESETS = [
  { name: "نيلي (الافتراضي)", primary: "#1e3a5f", secondary: "#2d9b8a", sidebar: "#1e3a5f" },
  { name: "أخضر زمردي", primary: "#1a5c3a", secondary: "#22a776", sidebar: "#1a5c3a" },
  { name: "بنفسجي ملكي", primary: "#3b1f6e", secondary: "#8b5cf6", sidebar: "#3b1f6e" },
  { name: "ذهبي فاخر", primary: "#4a3000", secondary: "#d97706", sidebar: "#4a3000" },
  { name: "وردي عصري", primary: "#5c1a3a", secondary: "#ec4899", sidebar: "#5c1a3a" },
  { name: "رمادي أنيق", primary: "#1f2937", secondary: "#6b7280", sidebar: "#1f2937" },
];

const ALL_FEATURES = [
  { key: "badges", label: "الأوسمة والتحفيز", icon: Award },
  { key: "store", label: "المتجر", icon: ShoppingBag },
  { key: "audio", label: "صوتيات المصحف", icon: Headphones },
  { key: "review_plans", label: "خطط المراجعة", icon: BookOpen },
  { key: "teacher_rotation", label: "شقلبة المعلمات", icon: RotateCcw },
  { key: "shortcomings", label: "إحصائيات التقصير", icon: AlertTriangle },
  { key: "exam", label: "الاختبارات", icon: GraduationCap },
  { key: "messages", label: "الرسائل", icon: MessageSquare },
  { key: "calendar", label: "التقويم", icon: Calendar },
  { key: "deputy_tasks", label: "مهام النائبة", icon: ClipboardList },
  { key: "registration", label: "نموذج التسجيل العام", icon: Globe },
  { key: "leaves", label: "إجازات الطالبات", icon: PlaneTakeoff },
];

interface Config {
  id: number;
  schoolName: string;
  logoUrl: string | null;
  primaryHsl: string;
  secondaryHsl: string;
  sidebarHsl: string;
  enabledFeatures: string;
  renderServiceId: string | null;
  renderServiceUrl: string | null;
  deployStatus: string;
  deployError: string | null;
  createdAt: string;
}

interface RenderSettings {
  hasApiKey: boolean;
  hasRepoUrl: boolean;
  repoUrl: string | null;
}

const STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "مسودة", color: "bg-gray-100 text-gray-600" },
  deploying: { label: "جارٍ النشر...", color: "bg-amber-100 text-amber-700" },
  deployed: { label: "منشور ✓", color: "bg-emerald-100 text-emerald-700" },
  failed: { label: "فشل النشر", color: "bg-red-100 text-red-700" },
};

export default function WhiteLabelPage() {
  const { data: user } = useGetCurrentUser({ query: { queryKey: ["getCurrentUser"] } });
  const { toast } = useToast();
  const [configs, setConfigs] = useState<Config[]>([]);
  const [renderSettings, setRenderSettings] = useState<RenderSettings | null>(null);
  const [loading, setLoading] = useState(false);
  const [deploying, setDeploying] = useState<number | null>(null);
  const [previewActive, setPreviewActive] = useState(false);
  const [copied, setCopied] = useState(false);
  const [expandedConfig, setExpandedConfig] = useState<number | null>(null);

  const [form, setForm] = useState({
    schoolName: "",
    logoUrl: "",
    primaryHex: "#1e3a5f",
    secondaryHex: "#2d9b8a",
    sidebarHex: "#1e3a5f",
    enabledFeatures: ALL_FEATURES.map(f => f.key),
  });
  const [saving, setSaving] = useState(false);

  const role = (user as any)?.role ?? "";

  useEffect(() => {
    if (role !== "leader") return;
    fetch(`${BASE}/api/white-label/configs`, { headers: headers() })
      .then(r => r.ok ? r.json() : [])
      .then(setConfigs)
      .catch(() => {});
    fetch(`${BASE}/api/white-label/render-settings`, { headers: headers() })
      .then(r => r.ok ? r.json() : null)
      .then(setRenderSettings)
      .catch(() => {});
  }, [role]);

  const hexToHsl = (hex: string): string => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s = 0;
    const l = (max + min) / 2;
    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / d + 2) / 6; break;
        case b: h = ((r - g) / d + 4) / 6; break;
      }
    }
    return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
  };

  const handlePreview = () => {
    if (previewActive) {
      resetTheme();
      setPreviewActive(false);
    } else {
      applyThemeFromHex(form.primaryHex, form.secondaryHex, form.sidebarHex);
      setPreviewActive(true);
    }
  };

  const handleSaveConfig = async () => {
    if (!form.schoolName.trim()) {
      toast({ title: "أدخلي اسم المقرأة أولاً", variant: "destructive" }); return;
    }
    setSaving(true);
    try {
      const body = {
        schoolName: form.schoolName,
        logoUrl: form.logoUrl || null,
        primaryHsl: hexToHsl(form.primaryHex),
        secondaryHsl: hexToHsl(form.secondaryHex),
        sidebarHsl: hexToHsl(form.sidebarHex),
        enabledFeatures: JSON.stringify(form.enabledFeatures),
      };
      const r = await fetch(`${BASE}/api/white-label/configs`, {
        method: "POST", headers: headers(), body: JSON.stringify(body),
      });
      if (!r.ok) throw new Error((await r.json()).error);
      const newConfig: Config = await r.json();
      setConfigs(prev => [newConfig, ...prev]);
      setForm({ schoolName: "", logoUrl: "", primaryHex: "#1e3a5f", secondaryHex: "#2d9b8a", sidebarHex: "#1e3a5f", enabledFeatures: ALL_FEATURES.map(f => f.key) });
      if (previewActive) { resetTheme(); setPreviewActive(false); }
      toast({ title: `✓ تم حفظ إعدادات "${newConfig.schoolName}"` });
    } catch (e: any) {
      toast({ title: e?.message ?? "خطأ في الحفظ", variant: "destructive" });
    } finally { setSaving(false); }
  };

  const handleDeploy = async (id: number) => {
    setDeploying(id);
    try {
      const r = await fetch(`${BASE}/api/white-label/configs/${id}/deploy`, {
        method: "POST", headers: headers(),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error);
      setConfigs(prev => prev.map(c => c.id === id
        ? { ...c, deployStatus: "deploying", renderServiceUrl: data.serviceUrl }
        : c
      ));
      toast({ title: "✓ تم إرسال طلب النشر إلى Render", description: "يستغرق البناء حوالي 10–15 دقيقة" });
    } catch (e: any) {
      setConfigs(prev => prev.map(c => c.id === id ? { ...c, deployStatus: "failed", deployError: e?.message } : c));
      toast({ title: e?.message ?? "فشل النشر", variant: "destructive" });
    } finally { setDeploying(null); }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل تريدين حذف هذا الإعداد نهائيًا؟")) return;
    await fetch(`${BASE}/api/white-label/configs/${id}`, { method: "DELETE", headers: headers() });
    setConfigs(prev => prev.filter(c => c.id !== id));
    toast({ title: "تم الحذف" });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  if (role !== "leader") return <div className="p-8 text-center text-muted-foreground">غير مصرح</div>;

  return (
    <div className="space-y-5" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">نسخ المقرأة للبيع</h1>
        <p className="text-muted-foreground text-sm mt-1">خصّصي نسخة جديدة من النظام لمقرأة أخرى وانشريها على Render</p>
      </div>

      {/* Render settings status */}
      {renderSettings && (
        <Card className={`border-0 shadow-sm ${renderSettings.hasApiKey && renderSettings.hasRepoUrl ? "bg-emerald-50 border-emerald-100" : "bg-amber-50 border-amber-100"}`}>
          <CardContent className="pt-4 pb-4">
            <div className="flex items-start gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${renderSettings.hasApiKey && renderSettings.hasRepoUrl ? "bg-emerald-100" : "bg-amber-100"}`}>
                <Key className={`w-4 h-4 ${renderSettings.hasApiKey && renderSettings.hasRepoUrl ? "text-emerald-600" : "text-amber-600"}`} />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm mb-1">إعدادات Render</p>
                <div className="space-y-1 text-xs">
                  <div className="flex items-center gap-2">
                    {renderSettings.hasApiKey
                      ? <Check className="w-3 h-3 text-emerald-600" />
                      : <AlertTriangle className="w-3 h-3 text-amber-600" />}
                    <span>مفتاح API: {renderSettings.hasApiKey ? "مضبوط ✓" : "غير مضبوط — أضف RENDER_API_KEY في Secrets"}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {renderSettings.hasRepoUrl
                      ? <Check className="w-3 h-3 text-emerald-600" />
                      : <AlertTriangle className="w-3 h-3 text-amber-600" />}
                    <span>GitHub Repo: {renderSettings.hasRepoUrl
                      ? <span className="font-mono text-[10px] bg-white/60 px-1 rounded">{renderSettings.repoUrl}</span>
                      : "غير مضبوط — أضف RENDER_GITHUB_REPO_URL في Secrets"}
                    </span>
                  </div>
                </div>
                {(!renderSettings.hasApiKey || !renderSettings.hasRepoUrl) && (
                  <div className="mt-2 p-2 bg-white/60 rounded-xl text-xs text-amber-700 space-y-1">
                    <p className="font-semibold">خطوات الإعداد:</p>
                    <p>1. اذهبي لـ Secrets في Replit وأضيفي <code className="bg-amber-100 px-1 rounded">RENDER_API_KEY</code> من <a href="https://dashboard.render.com/u/settings#api-keys" target="_blank" className="underline">Render Dashboard</a></p>
                    <p>2. أضيفي <code className="bg-amber-100 px-1 rounded">RENDER_GITHUB_REPO_URL</code> مثال: <code className="bg-amber-100 px-1 rounded">https://github.com/username/sana-quran</code></p>
                    <p>3. تأكدي من مزامنة المشروع مع GitHub من Replit</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Builder form */}
      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Palette className="w-4 h-4 text-primary" />
            إنشاء نسخة جديدة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">اسم المقرأة *</Label>
              <Input
                value={form.schoolName}
                onChange={e => setForm(f => ({ ...f, schoolName: e.target.value }))}
                placeholder="مثال: مقرأة النور"
                dir="rtl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">رابط الشعار (URL)</Label>
              <Input
                value={form.logoUrl}
                onChange={e => setForm(f => ({ ...f, logoUrl: e.target.value }))}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
          </div>

          {/* Color presets */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">لوحات الألوان الجاهزة</Label>
            <div className="flex flex-wrap gap-2">
              {PALETTE_PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => setForm(f => ({ ...f, primaryHex: p.primary, secondaryHex: p.secondary, sidebarHex: p.sidebar }))}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-border hover:bg-muted/40 text-xs font-medium transition-colors"
                >
                  <div className="w-3 h-3 rounded-full" style={{ background: p.primary }} />
                  <div className="w-3 h-3 rounded-full" style={{ background: p.secondary }} />
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          {/* Custom colors */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">تخصيص الألوان</Label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { key: "primaryHex", label: "اللون الرئيسي" },
                { key: "secondaryHex", label: "اللون الثانوي" },
                { key: "sidebarHex", label: "لون الشريط الجانبي" },
              ].map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <p className="text-[10px] text-muted-foreground">{label}</p>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                      className="w-8 h-8 rounded-lg border border-border cursor-pointer"
                    />
                    <span className="text-xs font-mono">{(form as any)[key]}</span>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={handlePreview}
              className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border transition-colors ${
                previewActive
                  ? "bg-amber-50 border-amber-200 text-amber-700"
                  : "border-border hover:bg-muted/40"
              }`}
            >
              {previewActive ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              {previewActive ? "إلغاء معاينة الألوان" : "معاينة الألوان على الصفحة"}
            </button>
          </div>

          {/* Feature toggles */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold">المميزات المتاحة</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {ALL_FEATURES.map(({ key, label, icon: Icon }) => {
                const enabled = form.enabledFeatures.includes(key);
                return (
                  <button
                    key={key}
                    onClick={() => setForm(f => ({
                      ...f,
                      enabledFeatures: enabled
                        ? f.enabledFeatures.filter(k => k !== key)
                        : [...f.enabledFeatures, key],
                    }))}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl border text-xs font-medium transition-colors text-right ${
                      enabled ? "bg-primary/5 border-primary/20 text-primary" : "border-border text-muted-foreground hover:bg-muted/30"
                    }`}
                  >
                    {enabled
                      ? <CheckSquare className="w-3.5 h-3.5 shrink-0 text-primary" />
                      : <Square className="w-3.5 h-3.5 shrink-0" />}
                    <Icon className="w-3 h-3 shrink-0" />
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button onClick={handleSaveConfig} disabled={saving || !form.schoolName.trim()} className="w-full gap-2">
            {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
            حفظ الإعدادات
          </Button>
        </CardContent>
      </Card>

      {/* Saved configs list */}
      {configs.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-muted-foreground mb-3">الإعدادات المحفوظة ({configs.length})</h2>
          <div className="space-y-3">
            {configs.map(config => {
              const status = STATUS_MAP[config.deployStatus] ?? STATUS_MAP.draft;
              const parsedFeatures: string[] = (() => { try { return JSON.parse(config.enabledFeatures); } catch { return []; } })();
              const isExpanded = expandedConfig === config.id;

              return (
                <Card key={config.id} className="border-0 shadow-sm">
                  <CardContent className="pt-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-bold text-sm">{config.schoolName}</p>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${status.color}`}>
                            {status.label}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-4 h-4 rounded-full border border-white/50 shadow-sm" style={{ background: `hsl(${config.primaryHsl})` }} />
                          <div className="w-4 h-4 rounded-full border border-white/50 shadow-sm" style={{ background: `hsl(${config.secondaryHsl})` }} />
                          <span className="text-xs text-muted-foreground">{parsedFeatures.length} ميزة مفعّلة</span>
                        </div>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => setExpandedConfig(isExpanded ? null : config.id)}
                          className="text-xs px-2 py-1 rounded-lg border border-border hover:bg-muted/30 text-muted-foreground">
                          {isExpanded ? "طيّ" : "تفاصيل"}
                        </button>
                        <button onClick={() => handleDelete(config.id)}
                          className="text-xs px-2 py-1 rounded-lg border border-red-100 text-red-500 hover:bg-red-50">
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="space-y-2 pt-2 border-t border-border">
                        <div className="flex flex-wrap gap-1">
                          {parsedFeatures.map(k => {
                            const f = ALL_FEATURES.find(ff => ff.key === k);
                            return f ? (
                              <span key={k} className="text-[10px] bg-primary/5 text-primary px-2 py-0.5 rounded-full font-medium">{f.label}</span>
                            ) : null;
                          })}
                        </div>
                        {config.deployError && (
                          <div className="bg-red-50 rounded-xl p-2.5 text-xs text-red-700">
                            <p className="font-semibold mb-0.5">خطأ في النشر:</p>
                            <p className="font-mono text-[10px]">{config.deployError}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {config.renderServiceUrl && config.deployStatus !== "failed" && (
                      <a
                        href={config.renderServiceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1.5 text-xs text-blue-600 hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" />
                        {config.renderServiceUrl}
                        <button onClick={(e) => { e.preventDefault(); handleCopy(config.renderServiceUrl!); }}
                          className="mr-1 text-muted-foreground hover:text-foreground">
                          {copied ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
                        </button>
                      </a>
                    )}

                    <Button
                      size="sm"
                      onClick={() => handleDeploy(config.id)}
                      disabled={deploying === config.id || config.deployStatus === "deploying" || !renderSettings?.hasApiKey || !renderSettings?.hasRepoUrl}
                      className="w-full gap-2"
                      variant={config.deployStatus === "deployed" ? "outline" : "default"}
                    >
                      {deploying === config.id || config.deployStatus === "deploying"
                        ? <><RefreshCw className="w-4 h-4 animate-spin" /> جارٍ النشر...</>
                        : config.deployStatus === "deployed"
                        ? <><RefreshCw className="w-4 h-4" /> إعادة النشر</>
                        : <><Rocket className="w-4 h-4" /> نشر على Render</>
                      }
                    </Button>
                    {(!renderSettings?.hasApiKey || !renderSettings?.hasRepoUrl) && (
                      <p className="text-[10px] text-amber-600 text-center">أضيفي RENDER_API_KEY وREPO_URL في Secrets أولاً</p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
