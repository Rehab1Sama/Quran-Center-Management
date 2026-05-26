export function NavyGold() {
  const p = {
    bg: "#F7F6F2",
    sidebar: "#192B52",
    sidebarText: "#C4CEEA",
    sidebarActive: "#264480",
    sidebarActiveText: "#FFFFFF",
    attendanceBar: "#C8A96E",
    achievementBar: "#E8D4A8",
    button: "#192B52",
    buttonText: "#FFFFFF",
    title: "#192B52",
    description: "#7B8AAC",
    content: "#2E4070",
    stats: ["#C8A96E", "#A8B8D8", "#E0C888", "#8AAAC8"],
    cardBg: "#FFFFFF",
    border: "#E8E4D8",
    accent: "#FBF8F0",
  };

  const circles = [
    { name: "حلقة الفجر", teacher: "أ. نورة", students: 12, attendance: 85, achievement: 72 },
    { name: "حلقة الصباح", teacher: "أ. هدى", students: 9, attendance: 60, achievement: 88 },
    { name: "حلقة المغرب", teacher: "أ. ريم", students: 15, attendance: 92, achievement: 65 },
  ];

  const stats = [
    { label: "الطالبات", value: "٤٧", color: p.stats[0] },
    { label: "الحلقات", value: "٦", color: p.stats[1] },
    { label: "أوجه التثبيت", value: "١٢٠", color: p.stats[2] },
    { label: "أوجه الحفظ", value: "٢٤٠", color: p.stats[3] },
  ];

  return (
    <div dir="rtl" style={{ display: "flex", minHeight: "100vh", background: p.bg, fontFamily: "'Tajawal', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet" />

      <div style={{ width: 224, background: p.sidebar, display: "flex", flexDirection: "column", padding: "28px 0", gap: 2, flexShrink: 0 }}>
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>مقرأة سنا الآي</div>
          <div style={{ fontSize: 12, color: "#C8A96E", marginTop: 3 }}>لوحة التحكم</div>
        </div>
        {["الرئيسية", "الحلقات", "الطالبات", "الحضور", "الإحصائيات"].map((item, i) => (
          <div key={i} style={{
            padding: "11px 20px", fontSize: 14,
            background: i === 0 ? p.sidebarActive : "transparent",
            color: i === 0 ? p.sidebarActiveText : p.sidebarText,
            fontWeight: i === 0 ? 600 : 400,
            borderRadius: i === 0 ? "0 24px 24px 0" : 0,
          }}>{item}</div>
        ))}
      </div>

      <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: p.title, margin: 0 }}>الصفحة الرئيسية</h1>
          <p style={{ fontSize: 14, color: p.description, margin: "4px 0 0" }}>الأحد، ١٥ محرم ١٤٤٦ هـ</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: p.cardBg, border: `1px solid ${p.border}`, borderRadius: 16, padding: "20px 20px 16px", borderTop: `3px solid ${s.color}` }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, marginBottom: 4 }}>{s.value}</div>
              <div style={{ fontSize: 13, color: p.content }}>{s.label}</div>
            </div>
          ))}
        </div>

        <h2 style={{ fontSize: 17, fontWeight: 600, color: p.title, marginBottom: 14 }}>الحلقات</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 24 }}>
          {circles.map((c, i) => (
            <div key={i} style={{ background: p.cardBg, border: `1px solid ${p.border}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: 15, color: p.title }}>{c.name}</div>
                  <div style={{ fontSize: 12, color: p.description, marginTop: 2 }}>{c.teacher} · {c.students} طالبات</div>
                </div>
                <button style={{ background: p.button, color: p.buttonText, border: "none", borderRadius: 10, padding: "7px 16px", fontSize: 13, fontWeight: 600 }}>تفاصيل</button>
              </div>
              {[{ label: "الحضور", val: c.attendance, color: p.attendanceBar }, { label: "الإنجاز", val: c.achievement, color: p.achievementBar }].map((bar, bi) => (
                <div key={bi} style={{ marginBottom: bi === 0 ? 10 : 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 5 }}>
                    <span style={{ fontSize: 12, color: p.content }}>{bar.label}</span>
                    <span style={{ fontSize: 12, fontWeight: 700, color: p.title }}>{bar.val}%</span>
                  </div>
                  <div style={{ height: 8, background: p.border, borderRadius: 6, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${bar.val}%`, background: bar.color, borderRadius: 6 }} />
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div style={{ background: p.accent, border: `1px solid ${p.border}`, borderRadius: 14, padding: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: p.title, marginBottom: 12 }}>🎨 لوحة ج — كحلي + ذهبي باستيل</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "القائمة", color: p.sidebar }, { label: "الأزرار", color: p.button },
              { label: "العنوان", color: p.title }, { label: "ذهبي باستيل", color: p.attendanceBar },
              { label: "ذهبي فاتح", color: p.achievementBar }, { label: "الخلفية", color: p.bg },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <div style={{ width: 28, height: 28, borderRadius: 7, background: s.color, border: `1px solid ${p.border}` }} />
                <span style={{ fontSize: 11, color: p.content }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
