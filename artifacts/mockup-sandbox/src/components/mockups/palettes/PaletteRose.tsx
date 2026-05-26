export function PaletteRose() {
  const palette = {
    bg: "#FFF8F5",
    sidebar: "#E8D0CB",
    sidebarText: "#7A4A44",
    attendanceBar: "#A8C5A0",
    achievementBar: "#F4C4A0",
    button: "#C07B75",
    buttonText: "#FFFFFF",
    title: "#5C3833",
    description: "#8B6B65",
    content: "#4A3532",
    stats: ["#9B7FA0", "#7BAF87", "#D4956B", "#6B9AB5"],
    statsLabels: ["#9B7FA0", "#7BAF87", "#D4956B", "#6B9AB5"],
    cardBg: "#FFFFFF",
    border: "#F0E0DC",
    sidebarActive: "#D4A09A",
  };

  const circles = [
    { name: "حلقة الفجر", teacher: "أ. نورة", students: 12, attendance: 85, achievement: 72 },
    { name: "حلقة الصباح", teacher: "أ. هدى", students: 9, attendance: 60, achievement: 88 },
    { name: "حلقة المغرب", teacher: "أ. ريم", students: 15, attendance: 92, achievement: 65 },
  ];

  const stats = [
    { label: "الطالبات", value: "٤٧", color: palette.stats[0] },
    { label: "الحلقات", value: "٦", color: palette.stats[1] },
    { label: "أوجه التثبيت", value: "١٢٠", color: palette.stats[2] },
    { label: "أوجه الحفظ", value: "٢٤٠", color: palette.stats[3] },
  ];

  return (
    <div dir="rtl" style={{ display: "flex", minHeight: "100vh", background: palette.bg, fontFamily: "'Tajawal', 'Cairo', sans-serif" }}>
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@300;400;500;700&display=swap" rel="stylesheet" />

      {/* Sidebar */}
      <div style={{ width: 220, background: palette.sidebar, display: "flex", flexDirection: "column", padding: "24px 0", gap: 4, flexShrink: 0 }}>
        <div style={{ padding: "0 20px 24px", borderBottom: `1px solid ${palette.border}` }}>
          <div style={{ fontWeight: 700, fontSize: 18, color: palette.sidebarText }}>مقرأة سنا الآي</div>
          <div style={{ fontSize: 12, color: palette.description, marginTop: 2 }}>لوحة التحكم</div>
        </div>
        {["الرئيسية", "الحلقات", "الطالبات", "الحضور", "الإحصائيات"].map((item, i) => (
          <div key={i} style={{
            padding: "10px 20px", fontSize: 14, cursor: "pointer",
            background: i === 0 ? palette.sidebarActive : "transparent",
            color: i === 0 ? palette.title : palette.sidebarText,
            fontWeight: i === 0 ? 600 : 400,
            borderRadius: i === 0 ? "0 20px 20px 0" : 0,
            marginLeft: 0,
          }}>{item}</div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: palette.title, margin: 0 }}>الصفحة الرئيسية</h1>
          <p style={{ fontSize: 14, color: palette.description, margin: "4px 0 0" }}>الأحد، ١٥ محرم ١٤٤٦ هـ</p>
        </div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: palette.cardBg, border: `1px solid ${palette.border}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, direction: "ltr", textAlign: "right" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: palette.content, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Circles */}
        <div style={{ marginBottom: 20 }}>
          <h2 style={{ fontSize: 17, fontWeight: 600, color: palette.title, marginBottom: 14 }}>الحلقات</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {circles.map((c, i) => (
              <div key={i} style={{ background: palette.cardBg, border: `1px solid ${palette.border}`, borderRadius: 12, padding: "16px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15, color: palette.title }}>{c.name}</div>
                    <div style={{ fontSize: 12, color: palette.description, marginTop: 2 }}>{c.teacher} · {c.students} طالبات</div>
                  </div>
                  <button style={{ background: palette.button, color: palette.buttonText, border: "none", borderRadius: 8, padding: "6px 14px", fontSize: 12, cursor: "pointer" }}>تفاصيل</button>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: palette.content }}>الحضور</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: palette.title }}>{c.attendance}%</span>
                    </div>
                    <div style={{ height: 8, background: palette.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${c.attendance}%`, background: palette.attendanceBar, borderRadius: 4 }} />
                    </div>
                  </div>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ fontSize: 12, color: palette.content }}>الإنجاز</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: palette.title }}>{c.achievement}%</span>
                    </div>
                    <div style={{ height: 8, background: palette.border, borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${c.achievement}%`, background: palette.achievementBar, borderRadius: 4 }} />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Color swatch legend */}
        <div style={{ background: palette.cardBg, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: palette.title, marginBottom: 14 }}>🎨 لوحة ١ — ورد وعاج</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "خلفية رئيسية", color: palette.bg, text: palette.content },
              { label: "القائمة الجانبية", color: palette.sidebar, text: palette.sidebarText },
              { label: "شريط الحضور", color: palette.attendanceBar, text: "#fff" },
              { label: "شريط الإنجاز", color: palette.achievementBar, text: palette.title },
              { label: "الأزرار", color: palette.button, text: "#fff" },
              { label: "العنوان", color: palette.title, text: "#fff" },
              { label: "الوصف", color: palette.description, text: "#fff" },
              { label: "المحتوى", color: palette.content, text: "#fff" },
            ].map((s, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: s.color, border: `1px solid ${palette.border}`, flexShrink: 0 }} />
                <span style={{ fontSize: 11, color: palette.content }}>{s.label}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 12 }}>
            <div style={{ fontSize: 11, color: palette.description, marginBottom: 6 }}>أرقام الإحصائيات</div>
            <div style={{ display: "flex", gap: 10 }}>
              {palette.stats.map((c, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <div style={{ width: 20, height: 20, borderRadius: 4, background: c }} />
                  <span style={{ fontSize: 28, fontWeight: 700, color: c, lineHeight: 1 }}>٩</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
