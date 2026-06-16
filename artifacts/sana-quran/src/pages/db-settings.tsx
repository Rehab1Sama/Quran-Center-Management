import { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Database, RefreshCw, CheckCircle2, AlertTriangle, Terminal } from "lucide-react";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");
const tok = () => localStorage.getItem("sana_auth_token");

export default function DbSettingsPage() {
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [output, setOutput] = useState("");
  const outputRef = useRef<HTMLDivElement>(null);

  const handleSchemaPush = async () => {
    setStatus("running");
    setOutput("");

    try {
      const res = await fetch(`${BASE}/api/admin/schema-push`, {
        method: "POST",
        headers: { Authorization: `Bearer ${tok()}` },
      });

      if (!res.ok || !res.body) {
        const text = await res.text().catch(() => "خطأ غير معروف");
        setOutput(text);
        setStatus("error");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";
      let done = false;

      while (!done) {
        const { value, done: streamDone } = await reader.read();
        done = streamDone;
        if (value) {
          const chunk = decoder.decode(value, { stream: !done });
          fullText += chunk;
          setOutput(fullText);
          if (outputRef.current) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
          }
        }
      }

      setStatus(fullText.includes("✅") ? "success" : "error");
    } catch (err: any) {
      setOutput(`خطأ في الاتصال: ${err.message}`);
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/30 p-4 md:p-6" dir="rtl">
      <div className="max-w-2xl mx-auto space-y-5">

        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Database className="w-5 h-5 text-primary" />
            إعدادات قاعدة البيانات
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            أدوات صيانة وإدارة قاعدة بيانات النظام
          </p>
        </div>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="w-4 h-4 text-teal-600" />
              مزامنة مخطط قاعدة البيانات
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground leading-relaxed">
              تُحدِّث هذا الأداة هيكل قاعدة البيانات ليطابق أحدث إصدار من النظام.
              استخدميها بعد كل تحديث جديد، أو إذا ظهرت رسائل خطأ تتعلق بعدم وجود جداول أو أعمدة.
            </p>

            <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
              <p className="text-xs text-amber-700 leading-relaxed">
                هذه العملية آمنة ولا تحذف البيانات — تُضيف فقط الجداول والأعمدة الجديدة.
              </p>
            </div>

            <Button
              onClick={handleSchemaPush}
              disabled={status === "running"}
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto"
            >
              {status === "running" ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جاري المزامنة...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  مزامنة قاعدة البيانات
                </>
              )}
            </Button>

            {output && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-muted-foreground" />
                  <p className="text-xs font-semibold text-muted-foreground">المخرجات</p>
                  {status === "success" && (
                    <span className="flex items-center gap-1 text-xs text-emerald-600 font-semibold">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      ناجحة
                    </span>
                  )}
                  {status === "error" && (
                    <span className="flex items-center gap-1 text-xs text-rose-600 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      فشلت
                    </span>
                  )}
                </div>
                <div
                  ref={outputRef}
                  dir="ltr"
                  className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs font-mono leading-relaxed max-h-72 overflow-y-auto whitespace-pre-wrap"
                >
                  {output}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
