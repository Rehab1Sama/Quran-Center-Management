import { MessageSquare, Bell } from "lucide-react";

const MOCK_MESSAGES = [
  {
    id: 1,
    targetType: "track",
    targetLabel: "مسار البهور",
    content: "السلام عليكن جميعًا ❤️\nأحب أنوّه أن اجتماع هذا الأسبوع سيكون يوم الأربعاء بعد صلاة المغرب. أرجو الالتزام بالحضور والاستعداد المسبق.",
    createdAt: "2026-04-17T18:30:00Z",
    badge: "مسار",
    badgeColor: "bg-emerald-100 text-emerald-700",
  },
  {
    id: 2,
    targetType: "circle",
    targetLabel: "حلقة الفجر",
    content: "بارك الله فيكن على الجهود المبذولة هذا الشهر. نتائج الاختبار كانت ممتازة، واصلن التميز!",
    createdAt: "2026-04-15T10:00:00Z",
    badge: "حلقة",
    badgeColor: "bg-blue-100 text-blue-700",
  },
  {
    id: 3,
    targetType: "student",
    targetLabel: "رسالة شخصية",
    content: "ماشاء الله عليكِ يا أختي، حفظكِ المتقن هذا الأسبوع مميز جدًا. استمري على هذا المنهج وستكملين الجزء قريبًا بإذن الله.",
    createdAt: "2026-04-13T09:15:00Z",
    badge: "شخصية",
    badgeColor: "bg-violet-100 text-violet-700",
  },
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function MessagesHome() {
  return (
    <div
      className="min-h-screen bg-[#f5f3ff] flex flex-col"
      dir="rtl"
      style={{ fontFamily: "'Segoe UI', Tahoma, sans-serif" }}
    >
      {/* Header */}
      <div className="bg-gradient-to-l from-[#6b4fa2] to-[#8b6cc4] px-5 pt-10 pb-6 shadow-md">
        <div className="flex items-center gap-3 mb-1">
          <div className="bg-white/20 rounded-full p-2">
            <Bell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-white text-lg font-bold leading-tight">رسائل من القائدة</h1>
            <p className="text-white/70 text-xs">آخر الرسائل الواردة إليكِ</p>
          </div>
        </div>
      </div>

      {/* Messages list */}
      <div className="flex-1 px-4 py-5 space-y-4 overflow-y-auto">
        {MOCK_MESSAGES.map((msg) => (
          <div
            key={msg.id}
            className="bg-white rounded-2xl shadow-sm border border-purple-100 overflow-hidden"
          >
            {/* Top strip */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
              <span
                className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${msg.badgeColor}`}
              >
                {msg.badge}
              </span>
              <div className="flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-purple-400" />
                <span className="text-xs text-purple-500 font-medium">{msg.targetLabel}</span>
              </div>
            </div>

            {/* Content */}
            <div className="px-4 py-3">
              <p
                className="text-gray-800 text-sm leading-relaxed whitespace-pre-line"
                style={{ lineHeight: "1.9" }}
              >
                {msg.content}
              </p>
            </div>

            {/* Footer */}
            <div className="px-4 pb-3 flex items-center justify-between">
              <span className="text-xs text-gray-400">{formatDate(msg.createdAt)}</span>
              <span className="text-xs text-purple-400 font-medium">القائدة رِحاب</span>
            </div>
          </div>
        ))}

        {/* Empty state preview */}
        <div className="bg-white/60 rounded-2xl border border-dashed border-purple-200 px-4 py-8 text-center mt-2">
          <MessageSquare className="w-8 h-8 text-purple-300 mx-auto mb-2" />
          <p className="text-sm text-gray-400">لا توجد رسائل أخرى</p>
        </div>
      </div>
    </div>
  );
}

export default MessagesHome;
