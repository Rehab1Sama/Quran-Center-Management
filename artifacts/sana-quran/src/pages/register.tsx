import { useState, useEffect, useMemo } from "react";
import { useGetRegistrationStatus } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { CheckCircle, XCircle, Search, ChevronDown } from "lucide-react";
import logoUrl from "@/assets/logo.jpg";
import { Link } from "wouter";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

// ── Quran data ────────────────────────────────────────────────────────────────
const SURAHS = [
  "الفاتحة","البقرة","آل عمران","النساء","المائدة","الأنعام","الأعراف","الأنفال","التوبة","يونس",
  "هود","يوسف","الرعد","إبراهيم","الحجر","النحل","الإسراء","الكهف","مريم","طه",
  "الأنبياء","الحج","المؤمنون","النور","الفرقان","الشعراء","النمل","القصص","العنكبوت","الروم",
  "لقمان","السجدة","الأحزاب","سبأ","فاطر","يس","الصافات","ص","الزمر","غافر",
  "فصلت","الشورى","الزخرف","الدخان","الجاثية","الأحقاف","محمد","الفتح","الحجرات","ق",
  "الذاريات","الطور","النجم","القمر","الرحمن","الواقعة","الحديد","المجادلة","الحشر","الممتحنة",
  "الصف","الجمعة","المنافقون","التغابن","الطلاق","التحريم","الملك","القلم","الحاقة","المعارج",
  "نوح","الجن","المزمل","المدثر","القيامة","الإنسان","المرسلات","النبأ","النازعات","عبس",
  "التكوير","الانفطار","المطففين","الانشقاق","البروج","الطارق","الأعلى","الغاشية","الفجر","البلد",
  "الشمس","الليل","الضحى","الشرح","التين","العلق","القدر","البينة","الزلزلة","العاديات",
  "القارعة","التكاثر","العصر","الهمزة","الفيل","قريش","الماعون","الكوثر","الكافرون","النصر",
  "المسد","الإخلاص","الفلق","الناس",
];

const JUZ_LIST = Array.from({ length: 30 }, (_, i) => `الجزء ${i + 1}`);

// ── Countries with dial codes ─────────────────────────────────────────────────
const COUNTRIES: { name: string; dialCode: string }[] = [
  { name: "السعودية", dialCode: "+966" },
  { name: "الإمارات", dialCode: "+971" },
  { name: "الكويت", dialCode: "+965" },
  { name: "قطر", dialCode: "+974" },
  { name: "البحرين", dialCode: "+973" },
  { name: "عُمان", dialCode: "+968" },
  { name: "الأردن", dialCode: "+962" },
  { name: "مصر", dialCode: "+20" },
  { name: "السودان", dialCode: "+249" },
  { name: "اليمن", dialCode: "+967" },
  { name: "العراق", dialCode: "+964" },
  { name: "سوريا", dialCode: "+963" },
  { name: "لبنان", dialCode: "+961" },
  { name: "فلسطين", dialCode: "+970" },
  { name: "ليبيا", dialCode: "+218" },
  { name: "تونس", dialCode: "+216" },
  { name: "الجزائر", dialCode: "+213" },
  { name: "المغرب", dialCode: "+212" },
  { name: "موريتانيا", dialCode: "+222" },
  { name: "الصومال", dialCode: "+252" },
  { name: "جيبوتي", dialCode: "+253" },
  { name: "جزر القمر", dialCode: "+269" },
  { name: "تركيا", dialCode: "+90" },
  { name: "ماليزيا", dialCode: "+60" },
  { name: "إندونيسيا", dialCode: "+62" },
  { name: "باكستان", dialCode: "+92" },
  { name: "الهند", dialCode: "+91" },
  { name: "بنغلاديش", dialCode: "+880" },
  { name: "أمريكا", dialCode: "+1" },
  { name: "كندا", dialCode: "+1" },
  { name: "المملكة المتحدة", dialCode: "+44" },
  { name: "فرنسا", dialCode: "+33" },
  { name: "ألمانيا", dialCode: "+49" },
  { name: "إيطاليا", dialCode: "+39" },
  { name: "إسبانيا", dialCode: "+34" },
  { name: "هولندا", dialCode: "+31" },
  { name: "بلجيكا", dialCode: "+32" },
  { name: "السويد", dialCode: "+46" },
  { name: "النرويج", dialCode: "+47" },
  { name: "الدنمارك", dialCode: "+45" },
  { name: "سويسرا", dialCode: "+41" },
  { name: "النمسا", dialCode: "+43" },
  { name: "أستراليا", dialCode: "+61" },
  { name: "نيوزيلندا", dialCode: "+64" },
  { name: "روسيا", dialCode: "+7" },
  { name: "الصين", dialCode: "+86" },
  { name: "اليابان", dialCode: "+81" },
  { name: "كوريا الجنوبية", dialCode: "+82" },
  { name: "البرازيل", dialCode: "+55" },
  { name: "الأرجنتين", dialCode: "+54" },
  { name: "المكسيك", dialCode: "+52" },
  { name: "جنوب أفريقيا", dialCode: "+27" },
  { name: "نيجيريا", dialCode: "+234" },
  { name: "إثيوبيا", dialCode: "+251" },
  { name: "كينيا", dialCode: "+254" },
  { name: "دولة أخرى", dialCode: "" },
];

// ── Types ─────────────────────────────────────────────────────────────────────
interface Circle {
  id: number;
  name: string;
  track: string;
  meetingTime?: string | null;
  newStudentCapacity?: number | null;
  spotsLeft?: number | null;
}

interface CustomQuestion {
  id: string;
  label: string;
  type: "text" | "select" | "yesno";
  options?: string[];
  required: boolean;
}

// ── Country Selector ─────────────────────────────────────────────────────────
function CountrySelector({
  value, onChange, onDialCode,
}: {
  value: string;
  onChange: (name: string) => void;
  onDialCode: (code: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const filtered = COUNTRIES.filter(c => c.name.includes(search) || c.dialCode.includes(search));
  const selected = COUNTRIES.find(c => c.name === value);

  const pick = (c: { name: string; dialCode: string }) => {
    onChange(c.name);
    onDialCode(c.dialCode);
    setOpen(false);
    setSearch("");
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between gap-2 h-10 px-3 rounded-md border border-input bg-background text-sm text-right hover:bg-muted/30 transition-colors"
      >
        <span className={value ? "text-foreground" : "text-muted-foreground"}>
          {value || "اختاري الدولة"}
        </span>
        <div className="flex items-center gap-1">
          {selected?.dialCode && (
            <span className="text-xs text-muted-foreground font-mono">{selected.dialCode}</span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </button>

      {open && (
        <div className="absolute z-50 top-full mt-1 w-full bg-white border border-border rounded-xl shadow-xl overflow-hidden" dir="rtl">
          <div className="p-2 border-b">
            <div className="relative">
              <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <Input
                autoFocus
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="ابحثي عن دولة..."
                className="pr-8 h-8 text-xs text-right"
              />
            </div>
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.map(c => (
              <button
                key={c.name}
                type="button"
                onClick={() => pick(c)}
                className={`w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/40 transition-colors text-right ${value === c.name ? "bg-primary/5 font-semibold" : ""}`}
              >
                <span>{c.name}</span>
                {c.dialCode && (
                  <span className="text-xs text-muted-foreground font-mono">{c.dialCode}</span>
                )}
              </button>
            ))}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">لا توجد دولة بهذا الاسم</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Memorized Quran Selector ─────────────────────────────────────────────────
function MemorizedQuranSelector({
  value, onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const [mode, setMode] = useState<"surah" | "juz">("juz");
  const [selectedJuz, setSelectedJuz] = useState<Set<number>>(new Set());
  const [selectedSurahs, setSelectedSurahs] = useState<Set<number>>(new Set());
  const [surahSearch, setSurahSearch] = useState("");

  const updateParent = (juz: Set<number>, surahs: Set<number>, m: "surah" | "juz") => {
    if (m === "juz") {
      const juzList = Array.from(juz).sort((a, b) => a - b);
      onChange(juzList.length ? `أجزاء: ${juzList.map(j => j).join("، ")}` : "");
    } else {
      const surahList = Array.from(surahs).sort((a, b) => a - b).map(i => SURAHS[i]);
      onChange(surahList.length ? `سور: ${surahList.join("، ")}` : "");
    }
  };

  const toggleJuz = (i: number) => {
    const next = new Set(selectedJuz);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedJuz(next);
    updateParent(next, selectedSurahs, mode);
  };

  const toggleSurah = (i: number) => {
    const next = new Set(selectedSurahs);
    next.has(i) ? next.delete(i) : next.add(i);
    setSelectedSurahs(next);
    updateParent(selectedJuz, next, mode);
  };

  const switchMode = (m: "surah" | "juz") => {
    setMode(m);
    updateParent(selectedJuz, selectedSurahs, m);
  };

  const filteredSurahs = SURAHS.map((name, i) => ({ name, i }))
    .filter(s => !surahSearch || s.name.includes(surahSearch));

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => switchMode("juz")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "juz" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          بالأجزاء
        </button>
        <button
          type="button"
          onClick={() => switchMode("surah")}
          className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all ${mode === "surah" ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
        >
          بالسور
        </button>
      </div>

      {mode === "juz" ? (
        <div className="flex flex-wrap gap-1.5">
          {Array.from({ length: 30 }, (_, i) => i + 1).map(j => (
            <button
              key={j}
              type="button"
              onClick={() => toggleJuz(j)}
              className={`w-10 h-8 rounded-lg text-xs font-semibold border transition-all ${selectedJuz.has(j) ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/50"}`}
            >
              {j}
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-muted-foreground" />
            <Input
              value={surahSearch}
              onChange={e => setSurahSearch(e.target.value)}
              placeholder="ابحثي عن سورة..."
              className="pr-7 h-8 text-xs text-right"
            />
          </div>
          <div className="flex flex-wrap gap-1.5 max-h-40 overflow-y-auto">
            {filteredSurahs.map(({ name, i }) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleSurah(i)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${selectedSurahs.has(i) ? "bg-primary text-white border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/50"}`}
              >
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {value && (
        <p className="text-xs text-muted-foreground bg-muted/40 rounded-lg px-3 py-2 leading-relaxed">
          {value}
        </p>
      )}
    </div>
  );
}

// ── Custom Question Field ─────────────────────────────────────────────────────
function CustomQuestionField({
  q, value, onChange,
}: { q: CustomQuestion; value: string; onChange: (v: string) => void }) {
  if (q.type === "yesno") {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid={`select-custom-${q.id}`}><SelectValue placeholder="اختاري" /></SelectTrigger>
        <SelectContent>
          <SelectItem value="نعم">نعم</SelectItem>
          <SelectItem value="لا">لا</SelectItem>
        </SelectContent>
      </Select>
    );
  }
  if (q.type === "select" && q.options && q.options.length > 0) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger data-testid={`select-custom-${q.id}`}><SelectValue placeholder="اختاري" /></SelectTrigger>
        <SelectContent>
          {q.options.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
        </SelectContent>
      </Select>
    );
  }
  return (
    <Input
      value={value}
      onChange={e => onChange(e.target.value)}
      className="text-right"
      required={q.required}
      data-testid={`input-custom-${q.id}`}
    />
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function validate4PartName(name: string): string | null {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length < 4) return "يجب أن يكون الاسم رباعيًا (٤ كلمات على الأقل)";
  return null;
}

function validatePhone(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 7) return "رقم الجوال قصير جدًا — يرجى التحقق منه";
  return null;
}

// ── Main Component ────────────────────────────────────────────────────────────
export default function RegisterPage() {
  const { data: status, isLoading: statusLoading } = useGetRegistrationStatus({
    query: { queryKey: ["regStatus"] }
  });
  const { toast } = useToast();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [form, setForm] = useState({
    fullName: "",
    email: "",
    password: "",
    phone: "",
    dialCode: "+966",
    country: "السعودية",
    birthdate: "",
    track: "",
    circleId: "",
    memorizeFrom: "",
    memorizedQuran: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [circles, setCircles] = useState<Circle[]>([]);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [hasMemorized, setHasMemorized] = useState<"" | "yes" | "no">("");

  useEffect(() => {
    fetch(`${BASE}/api/registration/circles-new-students`)
      .then(r => r.json())
      .then((data: Circle[]) => setCircles(data))
      .catch(() => {});
  }, []);

  const trackNames = useMemo(
    () => [...new Set(circles.map(c => c.track))].filter(Boolean).sort((a, b) => a.localeCompare(b, "ar")),
    [circles]
  );
  const filteredCircles = circles.filter(c => !form.track || c.track === form.track);

  const customQuestions: CustomQuestion[] = (() => {
    try {
      const parsed = JSON.parse(status?.customQuestions ?? "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
  })();

  const set = (field: string, val: string) => {
    setForm(f => ({ ...f, [field]: val }));
    setErrors(e => { const next = { ...e }; delete next[field]; return next; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};

    const nameErr = validate4PartName(form.fullName);
    if (nameErr) newErrors.fullName = nameErr;

    const phoneErr = validatePhone(form.phone);
    if (phoneErr) newErrors.phone = phoneErr;

    if (!form.track) newErrors.track = "يرجى اختيار المسار";
    if (!form.circleId) newErrors.circleId = "يرجى اختيار الحلقة";
    if (!hasMemorized) newErrors.hasMemorized = "يرجى الإجابة على سؤال الحفظ";

    for (const q of customQuestions) {
      if (q.required && !customAnswers[q.id]?.trim()) {
        newErrors[`custom_${q.id}`] = `يرجى الإجابة على: ${q.label}`;
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      const firstError = Object.values(newErrors)[0];
      toast({ title: firstError, variant: "destructive" });
      return;
    }

    const extraData: Record<string, string> = {};
    if (form.memorizedQuran) extraData["المحفوظات"] = form.memorizedQuran;
    if (form.birthdate) extraData["تاريخ الميلاد"] = form.birthdate;
    for (const q of customQuestions) {
      extraData[q.label] = customAnswers[q.id] ?? "";
    }

    const fullPhone = form.phone.startsWith("+") ? form.phone
      : form.dialCode ? `${form.dialCode}${form.phone.replace(/^0/, "")}` : form.phone;

    setSubmitting(true);
    try {
      const res = await fetch(`${BASE}/api/registration/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName.trim(),
          email: form.email,
          password: form.password,
          phone: fullPhone,
          country: form.country,
          track: form.track,
          circleId: form.circleId ? Number(form.circleId) : undefined,
          memorizeFrom: form.memorizeFrom || undefined,
          role: "student",
          isNewcomer: hasMemorized === "no",
          extraData: Object.keys(extraData).length > 0 ? extraData : undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data?.error ?? "خطأ في التسجيل");
      }
      setSubmitted(true);
    } catch (err: any) {
      const msg: string = err.message ?? "يرجى التحقق من البيانات";
      toast({ title: "خطأ في التسجيل", description: msg, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const todayStr = new Date().toISOString().split("T")[0];

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "linear-gradient(135deg, hsl(180, 20%, 96%) 0%, hsl(177, 40%, 93%) 100%)" }}
      dir="rtl"
    >
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-lg">
          <div className="text-center mb-6">
            <div className="w-24 h-24 rounded-2xl bg-white flex items-center justify-center mx-auto mb-3 shadow-lg overflow-hidden">
              <img src={logoUrl} alt="شعار مقرأة سَنا الآي" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-2xl font-bold text-foreground">مقرأة سَنا الآي</h1>
            <p className="text-muted-foreground text-sm">استمارة التسجيل</p>
          </div>

          {statusLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : !status?.isOpen ? (
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="card-registration-closed">
              <CardContent className="py-12 text-center">
                <XCircle className="w-14 h-14 text-rose-400 mx-auto mb-3" />
                <p className="text-lg font-bold text-foreground">التسجيل مغلق حاليًا</p>
                <p className="text-muted-foreground text-sm mt-2">يرجى التواصل مع إدارة المقرأة</p>
                <div className="mt-6">
                  <Link href="/login" className="text-sm text-primary font-semibold hover:underline">تسجيل الدخول</Link>
                </div>
              </CardContent>
            </Card>
          ) : submitted ? (
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="card-registration-success">
              <CardContent className="py-12 text-center">
                <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
                <p className="text-lg font-bold text-foreground">تم التسجيل بنجاح</p>
                <p className="text-muted-foreground text-sm mt-2">يمكنك الآن تسجيل الدخول</p>
                <div className="mt-6">
                  <Link href="/login" className="text-sm text-primary font-semibold hover:underline">تسجيل الدخول</Link>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="shadow-lg border-0 bg-white/80 backdrop-blur-sm" data-testid="card-registration-form">
              <CardHeader className="pb-4">
                <CardTitle className="text-center text-lg font-bold">استمارة التسجيل</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* الاسم الرباعي */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">الاسم الرباعي *</Label>
                    <Input
                      required
                      value={form.fullName}
                      onChange={e => set("fullName", e.target.value)}
                      onBlur={() => {
                        const err = validate4PartName(form.fullName);
                        if (err) setErrors(e => ({ ...e, fullName: err }));
                      }}
                      placeholder="الاسم الأول والثاني والثالث والرابع"
                      className={`text-right ${errors.fullName ? "border-rose-400" : ""}`}
                      data-testid="input-full-name"
                    />
                    {errors.fullName && (
                      <p className="text-xs text-rose-600">{errors.fullName}</p>
                    )}
                  </div>

                  {/* البريد + كلمة المرور */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">البريد الإلكتروني *</Label>
                      <Input
                        required type="email"
                        value={form.email}
                        onChange={e => set("email", e.target.value)}
                        placeholder="email@example.com"
                        className="text-left"
                        dir="ltr"
                        data-testid="input-email"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">كلمة المرور *</Label>
                      <Input
                        required type="password"
                        value={form.password}
                        onChange={e => set("password", e.target.value)}
                        placeholder="••••••••"
                        data-testid="input-password"
                      />
                    </div>
                  </div>

                  {/* تاريخ الميلاد */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">تاريخ الميلاد</Label>
                    <Input
                      type="date"
                      value={form.birthdate}
                      onChange={e => set("birthdate", e.target.value)}
                      max={todayStr}
                      className="text-right"
                      data-testid="input-birthdate"
                    />
                  </div>

                  {/* الدولة */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">الدولة *</Label>
                    <CountrySelector
                      value={form.country}
                      onChange={name => set("country", name)}
                      onDialCode={code => setForm(f => ({ ...f, dialCode: code }))}
                    />
                  </div>

                  {/* رقم الجوال */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">رقم الجوال / واتساب *</Label>
                    <div className="flex gap-2">
                      {form.dialCode && (
                        <span className="flex items-center justify-center px-3 rounded-md border border-input bg-muted text-sm font-mono text-muted-foreground shrink-0">
                          {form.dialCode}
                        </span>
                      )}
                      <Input
                        required
                        value={form.phone}
                        onChange={e => set("phone", e.target.value)}
                        onBlur={() => {
                          const err = validatePhone(form.phone);
                          if (err) setErrors(e => ({ ...e, phone: err }));
                        }}
                        placeholder="05xxxxxxxx"
                        className={`flex-1 text-right ${errors.phone ? "border-rose-400" : ""}`}
                        data-testid="input-phone"
                      />
                    </div>
                    {errors.phone && <p className="text-xs text-rose-600">{errors.phone}</p>}
                    {!errors.phone && form.phone && form.phone.replace(/\D/g, "").length >= 7 && (
                      <a
                        href={`https://wa.me/${form.dialCode.replace("+", "")}${form.phone.replace(/^0/, "").replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-xs text-green-700 hover:underline"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 00-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                        تحقق من الرقم على واتساب
                      </a>
                    )}
                  </div>

                  {/* المسار + الحلقة */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">المسار *</Label>
                      <Select value={form.track} onValueChange={v => { set("track", v); set("circleId", ""); }}>
                        <SelectTrigger data-testid="select-preferred-track" className={errors.track ? "border-rose-400" : ""}>
                          <SelectValue placeholder="اختاري المسار" />
                        </SelectTrigger>
                        <SelectContent>
                          {trackNames.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      {errors.track && <p className="text-xs text-rose-600">{errors.track}</p>}
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-sm font-semibold">الحلقة *</Label>
                      <Select
                        value={form.circleId}
                        onValueChange={v => set("circleId", v)}
                        disabled={!form.track}
                      >
                        <SelectTrigger data-testid="select-circle" className={errors.circleId ? "border-rose-400" : ""}>
                          <SelectValue placeholder={form.track ? "اختاري الحلقة" : "اختاري المسار أولًا"} />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredCircles.length === 0 ? (
                            <SelectItem value="__none" disabled>لا توجد حلقات متاحة</SelectItem>
                          ) : filteredCircles.map(c => (
                            <SelectItem key={c.id} value={String(c.id)}>
                              <span className="flex flex-col gap-0.5">
                                <span>{c.name}</span>
                                <span className="text-xs text-muted-foreground flex gap-2">
                                  {c.meetingTime && <span>🕐 {c.meetingTime}</span>}
                                  {c.spotsLeft != null && (
                                    <span className={c.spotsLeft <= 2 ? "text-rose-500 font-semibold" : ""}>
                                      {c.spotsLeft} مقعد
                                    </span>
                                  )}
                                </span>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {errors.circleId && <p className="text-xs text-rose-600">{errors.circleId}</p>}
                    </div>
                  </div>

                  {/* اتجاه الحفظ */}
                  <div className="space-y-1.5">
                    <Label className="text-sm font-semibold">اتجاه الحفظ (اختياري)</Label>
                    <Select value={form.memorizeFrom} onValueChange={v => set("memorizeFrom", v)}>
                      <SelectTrigger data-testid="select-memorize-from">
                        <SelectValue placeholder="اختاري اتجاه الحفظ" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="من البقرة">من البقرة</SelectItem>
                        <SelectItem value="من الناس">من الناس</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* هل تحفظين شيئاً؟ */}
                  <div className="space-y-2 border-t border-border/40 pt-4">
                    <Label className="text-sm font-semibold">هل تحفظين شيئاً من القرآن الكريم؟ *</Label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setHasMemorized("yes")}
                        className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${hasMemorized === "yes" ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"}`}
                      >
                        نعم
                      </button>
                      <button
                        type="button"
                        onClick={() => setHasMemorized("no")}
                        className={`flex-1 py-2 rounded-xl border-2 text-sm font-semibold transition-all ${hasMemorized === "no" ? "border-emerald-600 bg-emerald-50 text-emerald-700" : "border-border text-muted-foreground hover:border-emerald-400/60"}`}
                      >
                        لا — مستجدة
                      </button>
                    </div>
                    {(errors as any).hasMemorized && <p className="text-xs text-rose-600">{(errors as any).hasMemorized}</p>}
                    {hasMemorized === "yes" && (
                      <div className="space-y-2 mt-2">
                        <p className="text-xs text-muted-foreground">اختاري السور أو الأجزاء التي حفظتِها</p>
                        <MemorizedQuranSelector value={form.memorizedQuran} onChange={v => set("memorizedQuran", v)} />
                      </div>
                    )}
                    {hasMemorized === "no" && (
                      <p className="text-xs text-emerald-700 bg-emerald-50 rounded-lg p-3 border border-emerald-200">
                        ستكونين في المرحلة التأسيسية — ستُعفى من المراجعة البعيدة حتى تحفظي ما يكفي
                      </p>
                    )}
                  </div>

                  {/* الأسئلة المخصصة */}
                  {customQuestions.length > 0 && (
                    <div className="border-t border-border/50 pt-4 space-y-4">
                      {customQuestions.map(q => (
                        <div key={q.id} className="space-y-1.5">
                          <Label className="text-sm font-semibold">
                            {q.label} {q.required ? "*" : "(اختياري)"}
                          </Label>
                          <CustomQuestionField
                            q={q}
                            value={customAnswers[q.id] ?? ""}
                            onChange={v => {
                              setCustomAnswers(a => ({ ...a, [q.id]: v }));
                              setErrors(e => { const next = { ...e }; delete next[`custom_${q.id}`]; return next; });
                            }}
                          />
                          {errors[`custom_${q.id}`] && (
                            <p className="text-xs text-rose-600">{errors[`custom_${q.id}`]}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting}
                    className="w-full h-11 font-bold text-base"
                    style={{ background: "linear-gradient(135deg, hsl(210, 51%, 21%) 0%, hsl(177, 35%, 40%) 100%)" }}
                    data-testid="button-submit-registration"
                  >
                    {submitting ? "جاري التسجيل..." : "تسجيل"}
                  </Button>
                </form>

                <div className="mt-4 text-center">
                  <Link href="/login" className="text-xs text-muted-foreground hover:text-primary">
                    لديك حساب؟ تسجيل الدخول
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
      <footer className="text-center py-3 text-xs text-muted-foreground">
        جميع الحقوق محفوظة لمقرأة سَنا الآي &copy; 2026
      </footer>
    </div>
  );
}
