export function PaletteHoney() {
  const palette = {
    bg: "#FAF6EE",
    sidebar: "#C8CDA4",
    sidebarText: "#3D3B20",
    attendanceBar: "#7BB5AD",
    achievementBar: "#E8BE72",
    button: "#8A9E62",
    buttonText: "#FFFFFF",
    title: "#3D3520",
    description: "#7A6E50",
    content: "#4A4030",
    stats: ["#C49A3A", "#6B9E78", "#79B5AE", "#C4896B"],
    cardBg: "#FFFFFF",
    border: "#EAE5D5",
    sidebarActive: "#B5BA8A",
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
          }}>{item}</div>
        ))}
      </div>

      {/* Main */}
      <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 24, fontWeight: 700, color: palette.title, margin: 0 }}>الصفحة الرئيسية</h1>
          <p style={{ fontSize: 14, color: palette.description, margin: "4px 0 0" }}>الأحد، ١٥ محرم ١٤٤٦ هـ</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 28 }}>
          {stats.map((s, i) => (
            <div key={i} style={{ background: palette.cardBg, border: `1px solid ${palette.border}`, borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ fontSize: 28, fontWeight: 700, color: s.color, direction: "ltr", textAlign: "right" }}>{s.value}</div>
              <div style={{ fontSize: 13, color: palette.content, marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

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

        <div style={{ background: palette.cardBg, border: `1px solid ${palette.border}`, borderRadius: 12, padding: 20 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: palette.title, marginBottom: 14 }}>🎨 لوحة ٣ — عسل وزيتون</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
            {[
              { label: "خلفية رئيسية", color: palette.bg },
              { label: "القائمة الجانبية", color: palette.sidebar },
              { label: "شريط الحضور", color: palette.attendanceBar },
              { label: "شريط الإنجاز", color: palette.achievementBar },
              { label: "الأزرار", color: palette.button },
              { label: "العنوان", color: palette.title },
              { label: "الوصف", color: palette.description },
              { label: "المحتوى", color: palette.content },
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
