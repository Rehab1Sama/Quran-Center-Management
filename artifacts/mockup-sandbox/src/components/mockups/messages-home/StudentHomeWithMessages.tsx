import { MessageSquare } from "lucide-react";

const PURPLE = "#7c3aed";
const LIGHT_BG = "#f5f3ff";

const MESSAGES = [
  {
    id: 1,
    badge: "مسار",
    badgeColor: "#d1fae5",
    badgeText: "#065f46",
    targetLabel: "مسار البهور",
    content: "السلام عليكن جميعًا ❤️\nأحب أنوّه أن اجتماع هذا الأسبوع سيكون يوم الأربعاء بعد صلاة المغرب.",
    date: "١٧ شوال ١٤٤٧هـ",
  },
  {
    id: 2,
    badge: "شخصية",
    badgeColor: "#ede9fe",
    badgeText: "#5b21b6",
    targetLabel: "رسالة شخصية",
    content: "ماشاء الله عليكِ يا أختي، حفظكِ المتقن هذا الأسبوع مميز جدًا. استمري!",
    date: "١٣ شوال ١٤٤٧هـ",
  },
];

export function StudentHomeWithMessages() {
  return (
    <div dir="rtl" style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif", background: LIGHT_BG, minHeight: "100vh" }}>

      {/* ─── Header ─── */}
      <div style={{
        background: `linear-gradient(135deg, #6b4fa2 0%, #8b6cc4 100%)`,
        padding: "36px 20px 20px",
      }}>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", marginBottom: 2 }}>مرحبًا بكِ</div>
        <div style={{ fontSize: 17, fontWeight: 800, color: "#fff" }}>نورة عبدالله</div>
        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", marginTop: 2 }}>حلقة الفجر • مسار البهور</div>
      </div>

      <div style={{ padding: "16px 16px 80px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* ─── إحصائية سريعة ─── */}
        <div style={{
          display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8,
        }}>
          {[
            { label: "أوجه هذا الأسبوع", value: "4.5", icon: "📖" },
            { label: "أيام الحضور", value: "5 / 6", icon: "✅" },
            { label: "التقدم الكلي", value: "7.5%", icon: "📈" },
          ].map(stat => (
            <div key={stat.label} style={{
              background: "#fff",
              borderRadius: 14,
              padding: "10px 8px",
              textAlign: "center",
              boxShadow: "0 2px 8px rgba(124,58,237,0.07)",
            }}>
              <div style={{ fontSize: 18, marginBottom: 4 }}>{stat.icon}</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: PURPLE }}>{stat.value}</div>
              <div style={{ fontSize: 9, color: "#94a3b8", marginTop: 2, lineHeight: 1.3 }}>{stat.label}</div>
            </div>
          ))}
        </div>

        {/* ─── آخر تسجيل ─── */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: 14,
          boxShadow: "0 2px 8px rgba(124,58,237,0.07)",
        }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: "#5b21b6", marginBottom: 8 }}>📅 آخر تسجيل</div>
          <div style={{ fontSize: 11, color: "#64748b", lineHeight: 1.8 }}>
            <span style={{ display: "block" }}>الحفظ: من البقرة (آية ١) إلى (آية ٣٠)</span>
            <span style={{ display: "block" }}>المراجعة القريبة: جزء عمّ</span>
          </div>
          <div style={{ fontSize: 10, color: "#a78bfa", marginTop: 6 }}>الأربعاء ١٦ شوال ١٤٤٧هـ</div>
        </div>

        {/* ─── قسم الرسائل ─── */}
        <div style={{
          background: "#fff",
          borderRadius: 16,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(124,58,237,0.07)",
        }}>
          {/* عنوان القسم */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 14px 10px",
            borderBottom: "1px solid #f3f0ff",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <MessageSquare size={15} color={PURPLE} />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#5b21b6" }}>رسائل من القائدة</span>
            </div>
            <span style={{
              fontSize: 10, background: "#ede9fe", color: PURPLE,
              borderRadius: 99, padding: "2px 8px", fontWeight: 700,
            }}>{MESSAGES.length}</span>
          </div>

          {/* الرسائل */}
          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {MESSAGES.map((msg, idx) => (
              <div key={msg.id} style={{
                padding: "12px 14px",
                borderBottom: idx < MESSAGES.length - 1 ? "1px solid #faf5ff" : "none",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <span style={{
                    fontSize: 10, fontWeight: 700, borderRadius: 99,
                    padding: "2px 8px",
                    background: msg.badgeColor, color: msg.badgeText,
                  }}>
                    {msg.badge}
                  </span>
                  <span style={{ fontSize: 9, color: "#a78bfa" }}>{msg.targetLabel}</span>
                </div>
                <p style={{
                  fontSize: 12, color: "#374151", lineHeight: 1.8,
                  whiteSpace: "pre-line", margin: 0,
                }}>
                  {msg.content}
                </p>
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: "#94a3b8" }}>{msg.date}</span>
                  <span style={{ fontSize: 10, color: "#a78bfa", fontWeight: 600 }}>القائدة رِحاب</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ─── صوتيات المصحف ─── */}
        <div style={{
          background: "#fff", borderRadius: 16, padding: 14,
          boxShadow: "0 2px 8px rgba(124,58,237,0.07)",
          display: "flex", alignItems: "center", gap: 10,
        }}>
          <span style={{ fontSize: 22 }}>🎧</span>
          <div>
            <div style={{ fontSize: 12, fontWeight: 700, color: "#5b21b6" }}>صوتيات المصحف</div>
            <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>استمعي وكرري مع كبار القرّاء</div>
          </div>
          <div style={{ marginRight: "auto", fontSize: 16, color: "#a78bfa" }}>←</div>
        </div>
      </div>
    </div>
  );
}

export default StudentHomeWithMessages;
