export function NavyRose() {
  const p = {
    bg: "#F5F7FB",
    sidebar: "#1E3A6E",
    sidebarText: "#C8D6F0",
    sidebarActive: "#2A4F96",
    sidebarActiveText: "#FFFFFF",
    attendanceBar: "#E8A4B8",
    achievementBar: "#F4C8D8",
    button: "#1E3A6E",
    buttonText: "#FFFFFF",
    title: "#1E3A6E",
    description: "#7A90B8",
    content: "#3D5280",
    stats: ["#E8A4B8", "#B8C8E8", "#D4A8D0", "#A8C4E0"],
    cardBg: "#FFFFFF",
    border: "#DDE5F4",
    accent: "#FDF0F4",
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
        <div style={{ padding: "0 20px 24px", borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: "#FFFFFF" }}>مقرأة سنا الآي</div>
          <div style={{ fontSize: 12, color: "#A8C0E0", marginTop: 3 }}>لوحة التحكم</div>
        </div>
        {["الرئيسية", "الحلقات", "الطالبات", "الحضور", "الإحصائيات"].map((item, i) => (
          <div key={i} style={{
            padding: "11px 20px", fontSize: 14,
            background: i === 0 ? p.sidebarActive : "transparent",
            color: i === 0 ? p.sidebarActiveText : p.sidebarText,
            fontWeight: i === 0 ? 600 : 400,
            borderRadius: i === 0 ? "0 24px 24px 0" : 0,
            marginLeft: 0,
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
            <div key={i} style={{ background: p.cardBg, border: `1px solid ${p.border}`, borderRadius: 16, padding: "20px 20px 16px" }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: s.color, marginBottom: 10, opacity: 0.9 }} />
              <div style={{ fontSize: 28, fontWeight: 700, color: p.title }}>{s.value}</div>
              <div style={{ fontSize: 13, color: p.description, marginTop: 2 }}>{s.label}</div>
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
          <div style={{ fontWeight: 700, fontSize: 14, color: p.title, marginBottom: 12 }}>🎨 لوحة أ — كحلي + وردي باستيل</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
            {[
              { label: "القائمة", color: p.sidebar }, { label: "الأزرار", color: p.button },
              { label: "العنوان", color: p.title }, { label: "وردي باستيل", color: p.attendanceBar },
              { label: "وردي فاتح", color: p.achievementBar }, { label: "الخلفية", color: p.bg },
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
