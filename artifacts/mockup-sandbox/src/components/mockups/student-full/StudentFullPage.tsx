import { useState } from "react";

const PURPLE = "#7c3aed";
const BLUE = "#3b82f6";
const BG = "linear-gradient(135deg, #ede9f6 0%, #dbeafe 100%)";

const RECITERS = [
  { id: "ibrahim_akhdar", name: "إبراهيم الأخضر" },
  { id: "hussary",        name: "محمود خليل الحصري" },
  { id: "hudhaifi",       name: "علي الحذيفي" },
  { id: "ayub",           name: "محمد أيوب" },
  { id: "tunaiji",        name: "خليفة الطنيجي" },
  { id: "suwaid",         name: "أيمن سويد" },
  { id: "minshawi",       name: "محمد صديق المنشاوي" },
  { id: "abdulbaset",     name: "عبدالباسط عبدالصمد" },
];
const REPEAT_OPTIONS = [1, 2, 3, 5, 10];

function card(children: React.ReactNode, extra: React.CSSProperties = {}) {
  return (
    <div style={{
      background: "white", borderRadius: 20, padding: 16,
      boxShadow: "0 2px 10px rgba(124,58,237,0.08)", marginBottom: 14, ...extra,
    }}>
      {children}
    </div>
  );
}
function sectionTitle(text: string, icon: string) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
      <span style={{ fontSize: 14 }}>{icon}</span>
      <span style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6" }}>{text}</span>
    </div>
  );
}

/* ─── Tab 1: تقدمي ─── */
function TabProgress() {
  const total = 45.5;
  const pct = Math.round((total / 604) * 1000) / 10;
  return (
    <div style={{ padding: "4px 0 80px" }}>
      {/* Progress bar */}
      {card(<>
        {sectionTitle("التقدم في الحفظ", "📈")}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#94a3b8", marginBottom: 8 }}>
          <span>{total} وجه من أصل 604</span>
          <span style={{ fontWeight: 800, color: PURPLE }}>{pct}%</span>
        </div>
        <div style={{ height: 18, borderRadius: 99, background: "#ede9f6", overflow: "hidden" }}>
          <div style={{
            width: `${pct}%`, height: "100%", borderRadius: 99,
            background: `linear-gradient(90deg, ${PURPLE}, ${BLUE})`,
            transition: "width 0.5s",
          }} />
        </div>
        <p style={{ fontSize: 11, color: "#94a3b8", marginTop: 8 }}>
          آخر حفظ: من البقرة إلى آل عمران
        </p>
      </>)}

      {/* 3 summary cards */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { v: "45٫5", label: "إجمالي الحفظ\n(وجه)", color: PURPLE },
          { v: "32",   label: "الجلسات",              color: BLUE },
          { v: "2",    label: "الغيابات",              color: "#f43f5e" },
        ].map(c => (
          <div key={c.label} style={{
            background: "white", borderRadius: 18, padding: "14px 6px",
            textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 22, fontWeight: 800, color: c.color }}>{c.v}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4, whiteSpace: "pre-line", fontWeight: 600 }}>{c.label}</div>
          </div>
        ))}
      </div>

      {/* Last session */}
      {card(<>
        {sectionTitle("آخر جلسة · 2026-04-16", "✨")}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
          {[
            { label: "الحفظ",       v: "1٫5", bg: "#f5f3ff", c: PURPLE },
            { label: "مراجعة قريبة", v: "2",   bg: "#eff6ff", c: BLUE   },
            { label: "مراجعة بعيدة", v: "3",   bg: "#eef2ff", c: "#6366f1" },
          ].map(i => (
            <div key={i.label} style={{ background: i.bg, borderRadius: 14, padding: "10px 8px", textAlign: "center" }}>
              <div style={{ fontSize: 10, color: i.c, fontWeight: 700, marginBottom: 4 }}>{i.label}</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: i.c }}>{i.v}</div>
              <div style={{ fontSize: 9, color: i.c, opacity: 0.7 }}>وجه</div>
            </div>
          ))}
        </div>
      </>)}

      {/* History */}
      {card(<>
        {sectionTitle("السجل الكامل", "📅")}
        <table style={{ width: "100%", fontSize: 11, borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid #f1f0f5" }}>
              {["التاريخ","الحفظ","المراجعة","الحالة"].map(h => (
                <th key={h} style={{ textAlign: "right", padding: "6px 4px", color: "#94a3b8", fontWeight: 600 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              ["2026-04-16","1٫5","5","حاضرة"],
              ["2026-04-15","1",  "4","حاضرة"],
              ["2026-04-14","0",  "0","غائبة"],
              ["2026-04-13","2",  "5","حاضرة"],
              ["2026-04-12","1٫5","3","حاضرة"],
            ].map(([d,m,r,s]) => (
              <tr key={d} style={{ borderBottom: "1px solid #f9f8fd" }}>
                <td style={{ padding: "7px 4px", color: "#475569" }}>{d}</td>
                <td style={{ padding: "7px 4px", color: PURPLE, fontWeight: 700 }}>{m}</td>
                <td style={{ padding: "7px 4px", color: BLUE, fontWeight: 600 }}>{r}</td>
                <td style={{ padding: "7px 4px" }}>
                  <span style={{
                    padding: "2px 8px", borderRadius: 99, fontSize: 10, fontWeight: 700,
                    background: s === "حاضرة" ? "#dcfce7" : "#fee2e2",
                    color: s === "حاضرة" ? "#16a34a" : "#dc2626",
                  }}>{s}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </>)}
    </div>
  );
}

/* ─── Tab 2: إحصائياتي ─── */
function TabStats() {
  const [period, setPeriod] = useState(30);
  return (
    <div style={{ padding: "4px 0 80px" }}>
      {/* Period filter */}
      {card(<>
        {sectionTitle("الفترة الزمنية", "🗓")}
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {[{d:7,l:"هذا الأسبوع"},{d:30,l:"آخر 30 يوم"},{d:90,l:"آخر 90 يوم"},{d:365,l:"هذا العام"}].map(o => (
            <button key={o.d} onClick={() => setPeriod(o.d)} style={{
              padding: "8px 14px", borderRadius: 12, border: "none", cursor: "pointer",
              fontSize: 12, fontWeight: 600, transition: "all 0.15s",
              background: period === o.d ? `linear-gradient(135deg,${PURPLE},${BLUE})` : "#f3f0fb",
              color: period === o.d ? "white" : "#7c3aed",
              boxShadow: period === o.d ? "0 3px 10px rgba(124,58,237,0.3)" : "none",
            }}>{o.l}</button>
          ))}
        </div>
      </>)}

      {/* Stats for this period */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 14 }}>
        {[
          { v: "18",   label: "أيام الحضور",    color: "#16a34a", bg: "#f0fdf4", icon: "✅" },
          { v: "12",   label: "أوجه الحفظ",     color: PURPLE,    bg: "#f5f3ff", icon: "📖" },
          { v: "38",   label: "أوجه المراجعة",  color: BLUE,      bg: "#eff6ff", icon: "🔁" },
          { v: "1",    label: "الغيابات",        color: "#dc2626", bg: "#fff1f2", icon: "❌" },
        ].map(i => (
          <div key={i.label} style={{
            background: "white", borderRadius: 18, padding: 16,
            boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
          }}>
            <div style={{ fontSize: 20, marginBottom: 6 }}>{i.icon}</div>
            <div style={{ fontSize: 26, fontWeight: 800, color: i.color }}>{i.v}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4, fontWeight: 600 }}>{i.label}</div>
          </div>
        ))}
      </div>

      {/* Weekly average */}
      {card(<>
        {sectionTitle("متوسط أسبوعي", "📊")}
        {[
          { label: "حفظ", pct: 60, color: PURPLE },
          { label: "مراجعة قريبة", pct: 85, color: BLUE },
          { label: "مراجعة بعيدة", pct: 70, color: "#6366f1" },
        ].map(b => (
          <div key={b.label} style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>{b.label}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: b.color }}>{b.pct}%</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "#f3f0fb", overflow: "hidden" }}>
              <div style={{ width: `${b.pct}%`, height: "100%", borderRadius: 99, background: b.color }} />
            </div>
          </div>
        ))}
      </>)}

      {/* Progress in Quran */}
      {card(<>
        {sectionTitle("مسيرتي في القرآن", "🌟")}
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* Circular progress approximate */}
          <div style={{
            width: 80, height: 80, borderRadius: "50%", flexShrink: 0,
            background: `conic-gradient(${PURPLE} 0% 7.5%, #ede9f6 7.5% 100%)`,
            display: "flex", alignItems: "center", justifyContent: "center", position: "relative",
          }}>
            <div style={{
              width: 60, height: 60, borderRadius: "50%", background: "white",
              display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column",
            }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: PURPLE }}>7.5%</span>
            </div>
          </div>
          <div>
            <p style={{ fontSize: 13, fontWeight: 700, color: "#4c1d95", marginBottom: 4 }}>
              45٫5 وجه من 604
            </p>
            <p style={{ fontSize: 11, color: "#94a3b8" }}>
              تحفظين حالياً من الفاتحة حتى آل عمران
            </p>
            <div style={{
              marginTop: 8, padding: "4px 12px", borderRadius: 99, display: "inline-block",
              background: "linear-gradient(135deg, #7c3aed22, #3b82f622)",
              fontSize: 11, color: PURPLE, fontWeight: 700,
            }}>
              المسار: إشراق
            </div>
          </div>
        </div>
      </>)}
    </div>
  );
}

/* ─── Tab 3: صوتيات ─── */
function TabAudio() {
  const [reciter, setReciter] = useState<string | null>(null);
  const [page, setPage] = useState(3);
  const [repeat, setRepeat] = useState(1);
  const [playing, setPlaying] = useState(false);

  return (
    <div style={{ padding: "4px 0 80px" }}>
      {/* Page selector */}
      {card(<>
        {sectionTitle("اختاري الوجه", "📄")}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} style={{
            width: 38, height: 38, borderRadius: "50%", background: "#f3f0fb", border: "none",
            fontSize: 18, color: PURPLE, cursor: "pointer", fontWeight: 700,
          }}>‹</button>
          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 32, fontWeight: 800, color: PURPLE, lineHeight: 1 }}>{page}</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>من ٦٠٤ وجه</div>
          </div>
          <button onClick={() => setPage(p => Math.min(604, p + 1))} style={{
            width: 38, height: 38, borderRadius: "50%", background: "#f3f0fb", border: "none",
            fontSize: 18, color: PURPLE, cursor: "pointer", fontWeight: 700,
          }}>›</button>
        </div>
        <div style={{
          background: "#f5f3ff", borderRadius: 12, padding: "8px", textAlign: "center",
          fontSize: 13, fontWeight: 600, color: PURPLE,
        }}>
          {page === 1 ? "الفاتحة ١ — ٧" : page === 2 ? "البقرة ١ — ٥"
           : page === 3 ? "البقرة ٦ — ١٦" : page === 4 ? "البقرة ١٧ — ٢٤"
           : `الوجه ${page}`}
        </div>
      </>)}

      {/* Repeat */}
      {card(<>
        {sectionTitle("عدد مرات التكرار", "🔁")}
        <div style={{ display: "flex", gap: 6 }}>
          {REPEAT_OPTIONS.map(n => (
            <button key={n} onClick={() => setRepeat(n)} style={{
              flex: 1, padding: "9px 0", borderRadius: 12, border: "none", cursor: "pointer",
              fontWeight: 700, fontSize: 13,
              background: repeat === n ? `linear-gradient(135deg,${PURPLE},${BLUE})` : "#f3f0fb",
              color: repeat === n ? "white" : PURPLE,
              boxShadow: repeat === n ? "0 3px 10px rgba(124,58,237,0.3)" : "none",
            }}>{n}×</button>
          ))}
        </div>
      </>)}

      {/* Reciters */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6", marginBottom: 10, paddingRight: 4 }}>
          🎙 اختاري القارئ
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          {RECITERS.map(r => (
            <button key={r.id} onClick={() => { setReciter(r.id); setPlaying(false); }} style={{
              borderRadius: 16, padding: "11px 12px", textAlign: "right",
              border: "none", cursor: "pointer",
              background: reciter === r.id ? `linear-gradient(135deg,${PURPLE},${BLUE})` : "white",
              boxShadow: reciter === r.id
                ? "0 4px 14px rgba(124,58,237,0.35)"
                : "0 1px 4px rgba(0,0,0,0.06)",
            }}>
              <div style={{ fontSize: 9, fontWeight: 600, marginBottom: 2,
                color: reciter === r.id ? "rgba(255,255,255,0.7)" : "#a78bfa" }}>مجوّد</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: reciter === r.id ? "white" : "#4c1d95",
                lineHeight: 1.3 }}>{r.name}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Buttons */}
      {reciter ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 14 }}>
          <button onClick={() => setPlaying(p => !p)} style={{
            flex: 1, padding: "14px 0", borderRadius: 18, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 14, color: "white",
            background: `linear-gradient(135deg,${PURPLE},${BLUE})`,
            boxShadow: "0 4px 14px rgba(124,58,237,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <span>{playing ? "⏸" : "▶"}</span>
            <span>{playing ? "إيقاف" : "استماع"}</span>
          </button>
          <button style={{
            flex: 1, padding: "14px 0", borderRadius: 18,
            border: "2px solid #ede9f6", cursor: "pointer",
            fontWeight: 700, fontSize: 14, background: "white", color: PURPLE,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
          }}>
            <span>⬇</span><span>تحميل</span>
          </button>
        </div>
      ) : (
        <div style={{
          padding: 14, borderRadius: 18, textAlign: "center",
          background: "white", color: "#c4b5fd", fontSize: 13, marginBottom: 14,
        }}>اختاري القارئ أولاً</div>
      )}

      {/* Mini player */}
      {playing && reciter && (
        <div style={{
          background: "white", borderRadius: 18, padding: "14px 16px",
          boxShadow: "0 2px 12px rgba(124,58,237,0.10)", border: "1px solid #ede9f6",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 36, height: 36, borderRadius: "50%", flexShrink: 0,
              background: `linear-gradient(135deg,${PURPLE},${BLUE})`,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "white",
            }}>♪</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#5b21b6" }}>
                {RECITERS.find(r => r.id === reciter)?.name}
              </div>
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                البقرة ٦—١٦ · الوجه ٣ · التكرار {repeat}×
              </div>
            </div>
          </div>
          <div style={{ height: 6, borderRadius: 99, background: "#ede9f6", overflow: "hidden" }}>
            <div style={{
              width: "38%", height: "100%", borderRadius: 99,
              background: `linear-gradient(90deg,${PURPLE},${BLUE})`,
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>٢:١٤</span>
            <span style={{ fontSize: 10, color: "#94a3b8" }}>٥:٥٢</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Main Page ─── */
export function StudentFullPage() {
  const [tab, setTab] = useState<"progress" | "stats" | "audio">("progress");

  const TABS = [
    { id: "progress", label: "تقدمي",      icon: "📈" },
    { id: "stats",    label: "إحصائياتي",  icon: "📊" },
    { id: "audio",    label: "صوتيات",     icon: "🎙" },
  ] as const;

  return (
    <div dir="rtl" style={{
      minHeight: "100vh", background: BG,
      fontFamily: "Tahoma, 'Segoe UI', sans-serif",
      display: "flex", flexDirection: "column",
    }}>
      {/* Header */}
      <div style={{ padding: "22px 20px 10px", flexShrink: 0 }}>
        <p style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600, margin: "0 0 2px" }}>مقرأة سَنا الآي</p>
        <h1 style={{ fontSize: 18, fontWeight: 800, color: "#4c1d95", margin: 0 }}>حساب الطالبة</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "3px 0 0" }}>نورة عبدالله الحربي · مسار إشراق</p>
      </div>

      {/* Tab bar */}
      <div style={{
        display: "flex", gap: 6, padding: "0 16px 12px", flexShrink: 0,
      }}>
        {TABS.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            flex: 1, padding: "9px 4px", borderRadius: 14, border: "none", cursor: "pointer",
            fontWeight: 700, fontSize: 11, transition: "all 0.15s",
            background: tab === t.id ? `linear-gradient(135deg,${PURPLE},${BLUE})` : "white",
            color: tab === t.id ? "white" : "#7c3aed",
            boxShadow: tab === t.id ? "0 3px 10px rgba(124,58,237,0.3)" : "0 1px 4px rgba(0,0,0,0.05)",
            display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          }}>
            <span style={{ fontSize: 16 }}>{t.icon}</span>
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0 16px" }}>
        {tab === "progress" && <TabProgress />}
        {tab === "stats"    && <TabStats />}
        {tab === "audio"    && <TabAudio />}
      </div>
    </div>
  );
}
