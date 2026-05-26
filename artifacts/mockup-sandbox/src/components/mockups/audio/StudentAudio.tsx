import { useState } from "react";

const RECITERS = [
  { id: "ibrahim_akhdar",   name: "إبراهيم الأخضر" },
  { id: "hussary",          name: "محمود خليل الحصري" },
  { id: "hudhaifi",         name: "علي الحذيفي" },
  { id: "ayub",             name: "محمد أيوب" },
  { id: "tunaiji",          name: "خليفة الطنيجي" },
  { id: "suwaid",           name: "أيمن سويد" },
  { id: "minshawi",         name: "محمد صديق المنشاوي" },
  { id: "abdulbaset",       name: "عبدالباسط عبدالصمد" },
];

const REPEAT_OPTIONS = [1, 2, 3, 5, 10];

export function StudentAudio() {
  const [selectedReciter, setSelectedReciter] = useState<string | null>(null);
  const [page, setPage] = useState(3);
  const [playing, setPlaying] = useState(false);
  const [repeat, setRepeat] = useState(1);

  return (
    <div
      dir="rtl"
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #ede9f6 0%, #dbeafe 100%)",
        fontFamily: "Tahoma, 'Segoe UI', sans-serif",
        padding: "0 0 32px 0",
      }}
    >
      {/* Header */}
      <div style={{ padding: "24px 20px 12px" }}>
        <p style={{ fontSize: 11, color: "#a78bfa", fontWeight: 600, margin: "0 0 4px" }}>حسابي</p>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: "#4c1d95", margin: 0 }}>صوتيات المصحف</h1>
        <p style={{ fontSize: 12, color: "#94a3b8", margin: "4px 0 0" }}>استمعي لنصابك أو حمّليه</p>
      </div>

      {/* Page selector */}
      <div style={{
        margin: "0 16px 14px",
        background: "white",
        borderRadius: 20,
        padding: "16px",
        boxShadow: "0 2px 8px rgba(124,58,237,0.08)",
      }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#6d28d9", margin: "0 0 12px" }}>اختاري الوجه</p>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "#ede9f6", border: "none",
              fontSize: 20, color: "#7c3aed", cursor: "pointer",
              fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >‹</button>

          <div style={{ flex: 1, textAlign: "center" }}>
            <div style={{ fontSize: 36, fontWeight: 800, color: "#7c3aed", lineHeight: 1 }}>{page}</div>
            <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>من ٦٠٤ وجه</div>
          </div>

          <button
            onClick={() => setPage(p => Math.min(604, p + 1))}
            style={{
              width: 40, height: 40, borderRadius: "50%",
              background: "#ede9f6", border: "none",
              fontSize: 20, color: "#7c3aed", cursor: "pointer",
              fontWeight: 700, display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >›</button>
        </div>
        <div style={{
          marginTop: 12, background: "#f5f3ff",
          borderRadius: 12, padding: "8px 16px", textAlign: "center",
        }}>
          <span style={{ fontSize: 14, color: "#7c3aed", fontWeight: 600 }}>
            {page === 1 ? "الفاتحة ١ — ٧"
             : page === 2 ? "البقرة ١ — ٥"
             : page === 3 ? "البقرة ٦ — ١٦"
             : page === 4 ? "البقرة ١٧ — ٢٤"
             : `الوجه ${page}`}
          </span>
        </div>
      </div>

      {/* Repeat count */}
      <div style={{ margin: "0 16px 14px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#6d28d9", margin: "0 0 10px", paddingRight: 4 }}>
          عدد مرات التكرار
        </p>
        <div style={{ display: "flex", gap: 8 }}>
          {REPEAT_OPTIONS.map(n => (
            <button
              key={n}
              onClick={() => setRepeat(n)}
              style={{
                flex: 1, padding: "10px 0", borderRadius: 14, border: "none",
                cursor: "pointer", fontWeight: 700, fontSize: 14,
                transition: "all 0.15s",
                background: repeat === n
                  ? "linear-gradient(135deg, #7c3aed, #3b82f6)"
                  : "white",
                color: repeat === n ? "white" : "#7c3aed",
                boxShadow: repeat === n
                  ? "0 4px 12px rgba(124,58,237,0.3)"
                  : "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              {n}×
            </button>
          ))}
        </div>
      </div>

      {/* Reciter selection */}
      <div style={{ margin: "0 16px 14px" }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: "#6d28d9", margin: "0 0 10px", paddingRight: 4 }}>
          اختاري القارئ
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {RECITERS.map(r => (
            <button
              key={r.id}
              onClick={() => { setSelectedReciter(r.id); setPlaying(false); }}
              style={{
                borderRadius: 18, padding: "12px 14px", textAlign: "right",
                border: "none", cursor: "pointer", transition: "all 0.15s",
                background: selectedReciter === r.id
                  ? "linear-gradient(135deg, #7c3aed, #3b82f6)"
                  : "white",
                boxShadow: selectedReciter === r.id
                  ? "0 4px 14px rgba(124,58,237,0.35)"
                  : "0 1px 4px rgba(0,0,0,0.06)",
              }}
            >
              <div style={{ fontSize: 10, fontWeight: 600, marginBottom: 2,
                color: selectedReciter === r.id ? "rgba(255,255,255,0.7)" : "#a78bfa" }}>
                مجوّد
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, lineHeight: 1.3,
                color: selectedReciter === r.id ? "white" : "#4c1d95" }}>
                {r.name}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Action buttons */}
      <div style={{ margin: "0 16px" }}>
        {selectedReciter ? (
          <div style={{ display: "flex", gap: 10 }}>
            <button
              onClick={() => setPlaying(p => !p)}
              style={{
                flex: 1, padding: "14px 0", borderRadius: 18, border: "none",
                cursor: "pointer", fontWeight: 700, fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
                color: "white",
                boxShadow: "0 4px 14px rgba(124,58,237,0.4)",
              }}
            >
              <span style={{ fontSize: 16 }}>{playing ? "⏸" : "▶"}</span>
              <span>{playing ? "إيقاف" : "استماع"}</span>
            </button>
            <button
              style={{
                flex: 1, padding: "14px 0", borderRadius: 18, border: "2px solid #ede9f6",
                cursor: "pointer", fontWeight: 700, fontSize: 14,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                background: "white", color: "#7c3aed",
              }}
            >
              <span style={{ fontSize: 16 }}>⬇</span>
              <span>تحميل</span>
            </button>
          </div>
        ) : (
          <div style={{
            padding: "14px", borderRadius: 18, textAlign: "center",
            background: "white", color: "#c4b5fd", fontSize: 13,
          }}>
            اختاري القارئ أولاً
          </div>
        )}
      </div>

      {/* Mini player */}
      {playing && selectedReciter && (
        <div style={{
          margin: "14px 16px 0",
          background: "white",
          borderRadius: 18, padding: "14px 16px",
          boxShadow: "0 2px 12px rgba(124,58,237,0.10)",
          border: "1px solid #ede9f6",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <div style={{
              width: 38, height: 38, borderRadius: "50%",
              background: "linear-gradient(135deg, #7c3aed, #3b82f6)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 16, color: "white", flexShrink: 0,
            }}>♪</div>
            <div>
              <div style={{ fontSize: 12, fontWeight: 700, color: "#6d28d9" }}>
                {RECITERS.find(r => r.id === selectedReciter)?.name}
              </div>
              <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>
                البقرة ٦—١٦ · الوجه ٣ · التكرار {repeat}×
              </div>
            </div>
          </div>
          {/* Progress */}
          <div style={{ height: 6, borderRadius: 99, background: "#ede9f6", overflow: "hidden" }}>
            <div style={{
              width: "38%", height: "100%",
              background: "linear-gradient(90deg, #7c3aed, #3b82f6)",
              borderRadius: 99,
            }} />
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>٢:١٤</span>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>٥:٥٢</span>
          </div>
        </div>
      )}
    </div>
  );
}
