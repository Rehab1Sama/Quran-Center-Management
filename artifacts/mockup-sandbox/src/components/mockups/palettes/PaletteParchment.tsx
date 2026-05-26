export function PaletteParchment() {
  const p = {
    bg: "#F8F4EC",
    sidebar: "#BDC4E0",
    sidebarText: "#2D3055",
    sidebarActive: "#A5AECE",
    attendanceBar: "#96C4BC",
    achievementBar: "#EAB88A",
    button: "#7882C0",
    buttonText: "#FFFFFF",
    title: "#2D3055",
    description: "#7A7F9A",
    content: "#383D60",
    stats: ["#7882C0", "#C49A44", "#5AA8A0", "#C07888"],
    cardBg: "#FFFFFF",
    border: "#E0DDD4",
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
      <div style={{ width: 220, background: p.sidebar, display: "flex", flexDirection: "column", padding: "24px 0", gap: 4, flexShrink: 0 }}>
        <div style={{ padding: "0 20px 24px", borderBottom: `1px solid ${p.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: p.sidebarText }}>مقرأة سنا الآي</div>
          <div style={{ fontSize: 12, color: p.description, marginTop: 2 }}>لوحة التحكم</div>
        </div>
        {["الرئيسية", "الحلقات", "الطالبات", "الحضور", "الإحصائيات"].map((item, i) => (
          <div key={i} style={{ padding: "10px 20px", fontSize: 14, background: i === 0 ? p.sidebarActive : "transparent", color: i === 0 ? p.title : p.sidebarText, fontWeight: i === 0 ? 600 : 400, borderRadius: i === 0 ? "0 20px 20px 0" : 0 }}>{item}</div>
        ))}
      </div>
      <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: p.title, margin: 0 }}>الصفحة الرئيسية</h1>
          <p style={{ fontSize: 14, color: p.description, margin: "4px 0 0" }}>الأحد، ١٥ محرم ١٤٤٦ هـ</p>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: p.cardBg, border: `1px solid ${p.border}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color }}>{s.value}</div>
              <div style={{ fontSize: 13, color: p.content, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: p.title, marginBottom: 14 }}>الحلقات</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {circles.map((c, i) => (
              <div key={i} style={{ background: p.cardBg, border: `1px solid ${p.border}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: p.title }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: p.description, marginTop: 2 }}>{c.teacher} · {c.students} طالبات</div>
                  </div>
                  <button style={{ background: p.button, color: p.buttonText, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12 }}>تفاصيل</button>
                </div>
                {[{ label: "الحضور", val: c.attendance, color: p.attendanceBar }, { label: "الإنجاز", val: c.achievement, color: p.achievementBar }].map((bar, bi) => (
                  <div key={bi} style={{ marginBottom: bi === 0 ? 8 : 0 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: p.content }}>{bar.label}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: p.title }}>{bar.val}%</span>
                    </div>
                    <div style={{ height: 8, background: p.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${bar.val}%`, background: bar.color, borderRadius: 4 }} />
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div style={{ background: p.cardBg, border: `1px solid ${p.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: p.title, marginBottom: 14 }}>🎨 لوحة ج — ضوء المصحف (عاجي وبحري)</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 12 }}>
            {[
              { label: "الخلفية", color: p.bg }, { label: "القائمة", color: p.sidebar },
              { label: "شريط الحضور", color: p.attendanceBar }, { label: "شريط الإنجاز", color: p.achievementBar },
              { label: "الأزرار", color: p.button }, { label: "العنوان", color: p.title },
              { label: "الوصف", color: p.description }, { label: "المحتوى", color: p.content },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <div style={{ width: 22, height: 22, borderRadius: 5, background: s.color, border: `1px solid ${p.border}`, flexShrink: 0 }} />
                <span style={{ fontSize: 10, color: p.content }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <span style={{ fontSize: 11, color: p.description }}>أرقام الإحصائيات:</span>
            {p.stats.map((c, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                <div style={{ width: 18, height: 18, borderRadius: 4, background: c }} />
                <span style={{ fontSize: 24, fontWeight: 700, color: c, lineHeight: 1 }}>٩</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
