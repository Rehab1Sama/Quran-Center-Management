import { Router, type IRouter } from "express";
import { db, dataEntrySessionsTable, usersTable } from "@workspace/db";
import { eq, and, gte, desc } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

function getMeccaTodayServer(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// هل الوقت الحالي (بتوقيت مكة) صباح أم مساء؟
// الصباح: 06:00 - 13:59 (بتوقيت مكة = UTC+3)
// المساء: 14:00 - 23:59
function isMorning(): boolean {
  const meccaHour = (new Date().getUTCHours() + 3) % 24;
  return meccaHour >= 6 && meccaHour < 14;
}

const HEARTBEAT_INTERVAL_MINUTES = 2; // كل ضربة قلب = دقيقتان من العمل الفعلي

// POST /api/data-entry/session/heartbeat — تحديث وقت الجلسة النشطة
router.post("/data-entry/session/heartbeat", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "data_entry") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const today = getMeccaTodayServer();
  const morning = isMorning();
  const userId = req.userId!;

  const [existing] = await db.select().from(dataEntrySessionsTable)
    .where(and(
      eq(dataEntrySessionsTable.userId, userId),
      eq(dataEntrySessionsTable.date, today),
    ));

  if (existing) {
    // تحقق من أن آخر ضربة قلب كانت مؤخرًا (في آخر 5 دقائق) لتجنب احتساب فترات الخمول
    const lastBeat = existing.lastHeartbeatAt ? new Date(existing.lastHeartbeatAt) : null;
    const minutesSinceLast = lastBeat
      ? (Date.now() - lastBeat.getTime()) / 60000
      : 999;

    const shouldAddMinutes = minutesSinceLast <= 5; // لا تحتسب إذا كانت آخر ضربة منذ أكثر من 5 دقائق

    const addMinutes = shouldAddMinutes ? HEARTBEAT_INTERVAL_MINUTES : 0;

    await db.update(dataEntrySessionsTable)
      .set({
        morningMinutes: morning ? existing.morningMinutes + addMinutes : existing.morningMinutes,
        eveningMinutes: !morning ? existing.eveningMinutes + addMinutes : existing.eveningMinutes,
        lastHeartbeatAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(dataEntrySessionsTable.id, existing.id));
  } else {
    await db.insert(dataEntrySessionsTable).values({
      userId,
      date: today,
      morningMinutes: morning ? HEARTBEAT_INTERVAL_MINUTES : 0,
      eveningMinutes: !morning ? HEARTBEAT_INTERVAL_MINUTES : 0,
      lastHeartbeatAt: new Date(),
    });
  }

  res.json({ ok: true });
});

// GET /api/data-entry/sessions/today — إحصائيات اليوم لجميع المدخلات (للقائدة والنائبة)
router.get("/data-entry/sessions/today", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const today = getMeccaTodayServer();

  const sessions = await db.select().from(dataEntrySessionsTable)
    .where(eq(dataEntrySessionsTable.date, today));

  const allDataEntryUsers = await db.select().from(usersTable)
    .where(and(eq(usersTable.role, "data_entry"), eq(usersTable.isArchived, false)));

  const result = allDataEntryUsers.map(user => {
    const session = sessions.find(s => s.userId === user.id);
    return {
      userId: user.id,
      userName: user.name,
      morningMinutes: Math.round((session?.morningMinutes ?? 0) * 10) / 10,
      eveningMinutes: Math.round((session?.eveningMinutes ?? 0) * 10) / 10,
      totalMinutes: Math.round(((session?.morningMinutes ?? 0) + (session?.eveningMinutes ?? 0)) * 10) / 10,
      lastActive: session?.lastHeartbeatAt?.toISOString() ?? null,
    };
  });

  res.json(result);
});

// GET /api/data-entry/sessions/range — إحصائيات نطاق تاريخي (للقائدة والنائبة)
router.get("/data-entry/sessions/range", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const { dateFrom, dateTo } = req.query as Record<string, string>;
  const today = getMeccaTodayServer();
  const from = dateFrom ?? today;
  const to = dateTo ?? today;

  const sessions = await db.select().from(dataEntrySessionsTable)
    .where(and(gte(dataEntrySessionsTable.date, from)));

  const filtered = sessions.filter(s => s.date <= to);

  const allDataEntryUsers = await db.select().from(usersTable)
    .where(and(eq(usersTable.role, "data_entry"), eq(usersTable.isArchived, false)));

  const result = allDataEntryUsers.map(user => {
    const userSessions = filtered.filter(s => s.userId === user.id);
    const totalMorning = userSessions.reduce((sum, s) => sum + s.morningMinutes, 0);
    const totalEvening = userSessions.reduce((sum, s) => sum + s.eveningMinutes, 0);
    return {
      userId: user.id,
      userName: user.name,
      morningMinutes: Math.round(totalMorning * 10) / 10,
      eveningMinutes: Math.round(totalEvening * 10) / 10,
      totalMinutes: Math.round((totalMorning + totalEvening) * 10) / 10,
      days: userSessions.length,
    };
  });

  res.json(result);
});

export default router;
