import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable, studentsTable, circlesTable, studentEnrollmentsTable } from "@workspace/db";
import { eq, and, isNull, isNotNull, sql } from "drizzle-orm";
import { hashPassword } from "./lib/auth";
import cron from "node-cron";
import { runWeeklyBackup } from "./lib/backup";

if (!process.env.SESSION_SECRET) {
  logger.warn("[SECURITY] SESSION_SECRET is not set — using insecure fallback. Set it before going to production!");
}

async function repairMissingEnrollments() {
  try {
    const studentsWithCircle = await db
      .select({ id: studentsTable.id, circleId: studentsTable.circleId })
      .from(studentsTable)
      .where(and(eq(studentsTable.isArchived, false), isNotNull(studentsTable.circleId)));

    let created = 0;
    for (const s of studentsWithCircle) {
      if (!s.circleId) continue;
      const existing = await db
        .select({ id: studentEnrollmentsTable.id })
        .from(studentEnrollmentsTable)
        .where(and(
          eq(studentEnrollmentsTable.studentId, s.id),
          eq(studentEnrollmentsTable.circleId, s.circleId),
          eq(studentEnrollmentsTable.isArchived, false),
        ));
      if (existing.length === 0) {
        await db.insert(studentEnrollmentsTable)
          .values({ studentId: s.id, circleId: s.circleId, isArchived: false })
          .onConflictDoNothing();
        created++;
      }
    }
    if (created > 0) logger.info({ created }, "Repaired missing student enrollments");
  } catch (err) {
    logger.error({ err }, "Failed to repair missing enrollments");
  }
}

// تصحيح إيميلات المستخدمين (إزالة المسافات + تحويل لحروف صغيرة)
async function normalizeEmails() {
  try {
    const result = await db.execute(
      sql`UPDATE users SET email = LOWER(TRIM(email)) WHERE email != LOWER(TRIM(email))`
    );
    const count = (result as any).rowCount ?? 0;
    if (count > 0) logger.info({ count }, "Normalized user emails (trim + lowercase)");
  } catch (err) {
    logger.error({ err }, "Failed to normalize emails");
  }
}

// ربط المعلمات والمشرفات بحلقاتهن عند بدء التشغيل
async function syncCircleStaff() {
  try {
    let updated = 0;
    const staff = await db
      .select({ id: usersTable.id, role: usersTable.role, circleId: usersTable.circleId })
      .from(usersTable)
      .where(and(eq(usersTable.isArchived, false), isNotNull(usersTable.circleId)));

    for (const u of staff) {
      if (!u.circleId) continue;
      if (u.role === "teacher") {
        const r = await db.update(circlesTable)
          .set({ teacherId: u.id })
          .where(and(eq(circlesTable.id, u.circleId), isNull(circlesTable.teacherId)));
        if ((r as any).rowCount > 0) updated++;
      } else if (u.role === "supervisor") {
        const r = await db.update(circlesTable)
          .set({ supervisorId: u.id })
          .where(and(eq(circlesTable.id, u.circleId), isNull(circlesTable.supervisorId)));
        if ((r as any).rowCount > 0) updated++;
      }
    }
    if (updated > 0) logger.info({ updated }, "Synced circle staff (teacher/supervisor) links");
  } catch (err) {
    logger.error({ err }, "Failed to sync circle staff");
  }
}

async function seedLeader() {
  try {
    const hash = hashPassword("mnbvcxzrr");
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.email, "sana.qur3n@gmail.com"), eq(usersTable.role, "leader")));

    if (existing.length === 0) {
      await db.insert(usersTable).values({
        email: "sana.qur3n@gmail.com",
        name: "سنا",
        passwordHash: hash,
        role: "leader",
      });
      logger.info("Leader account created automatically");
    } else {
      // Always sync password hash to match the one defined here
      await db
        .update(usersTable)
        .set({ passwordHash: hash })
        .where(and(eq(usersTable.email, "sana.qur3n@gmail.com"), eq(usersTable.role, "leader")));
      logger.info("Leader account password hash synced");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed leader account");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void seedLeader();
  void normalizeEmails();
  void repairMissingEnrollments();
  void syncCircleStaff();

  cron.schedule("0 2 * * 0", () => {
    logger.info("Starting weekly backup...");
    runWeeklyBackup()
      .then(() => logger.info("Weekly backup completed"))
      .catch((e: unknown) => logger.error({ err: e }, "Weekly backup failed"));
  }, { timezone: "Asia/Riyadh" });
  logger.info("Weekly backup cron scheduled (Sundays 2:00 AM Riyadh time)");
});
