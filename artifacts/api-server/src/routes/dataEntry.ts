import { Router, type IRouter } from "express";
import { db, recordsTable, circlesTable, studentsTable, teacherAbsencesTable, dataEntryCircleAssignmentsTable, studentEnrollmentsTable } from "@workspace/db";
import { eq, and, gte, inArray, sql, isNotNull } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

function getMeccaTodayServer(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function getWeekSunday(today: string): string {
  const d = new Date(today + "T00:00:00Z");
  const dow = d.getUTCDay(); // 0=Sun
  d.setUTCDate(d.getUTCDate() - dow);
  return d.toISOString().slice(0, 10);
}

router.get("/data-entry/missing", authenticate, async (req, res): Promise<void> => {
  const today = (req.query.date as string) ?? getMeccaTodayServer();
  const userId = (req as any).userId;
  const userRole = (req as any).userRole;

  const todayRecords = await db.select().from(recordsTable).where(eq(recordsTable.date, today));
  const recordedStudentIds = new Set(todayRecords.map(r => r.studentId));

  // LEFT JOIN: يشمل الطالبات اللواتي لديهن سجل تسجيل أو لديهن circleId مباشرة على جدول students
  const studentsQuery = db
    .select({
      studentId: studentsTable.id,
      studentName: studentsTable.fullName,
      circleId: sql<number>`COALESCE(${studentEnrollmentsTable.circleId}, ${studentsTable.circleId})`.as("circleId"),
      circleName: circlesTable.name,
      track: circlesTable.track,
      leaveStart: studentEnrollmentsTable.leaveStart,
      leaveEnd: studentEnrollmentsTable.leaveEnd,
    })
    .from(studentsTable)
    .leftJoin(
      studentEnrollmentsTable,
      and(
        eq(studentEnrollmentsTable.studentId, studentsTable.id),
        eq(studentEnrollmentsTable.isArchived, false),
      ),
    )
    .innerJoin(
      circlesTable,
      sql`${circlesTable.id} = COALESCE(${studentEnrollmentsTable.circleId}, ${studentsTable.circleId})`,
    )
    .where(
      and(
        eq(studentsTable.isArchived, false),
        sql`COALESCE(${studentEnrollmentsTable.circleId}, ${studentsTable.circleId}) IS NOT NULL`,
      ),
    )
    .groupBy(
      studentsTable.id,
      studentsTable.fullName,
      studentsTable.circleId,
      studentEnrollmentsTable.circleId,
      studentEnrollmentsTable.leaveStart,
      studentEnrollmentsTable.leaveEnd,
      circlesTable.name,
      circlesTable.track,
    );

  const students = await studentsQuery;

  // للمدخلة: فقط الحلقات المُسندة لها
  let assignedCircleIds: Set<number> | null = null;
  if (userRole === "data_entry" && userId) {
    const assignments = await db.select().from(dataEntryCircleAssignmentsTable)
      .where(eq(dataEntryCircleAssignmentsTable.dataEntryUserId, userId));
    assignedCircleIds = new Set(assignments.map((a: any) => a.circleId));
  }

  const result = students
    .filter(s => {
      if (recordedStudentIds.has(s.studentId)) return false;
      if (assignedCircleIds !== null && !assignedCircleIds.has(s.circleId)) return false;
      const onLeave = !!(s.leaveStart && s.leaveEnd && s.leaveStart <= today && today <= s.leaveEnd);
      if (onLeave) return false;
      return true;
    })
    .map(s => ({ ...s, onLeave: false }));

  res.json(result);
});

// Returns dates in current week (Sun–Sat) where the circle already has records or teacher absence
router.get("/data-entry/circle-submitted-days", authenticate, async (req, res): Promise<void> => {
  const circleId = parseInt((req.query.circleId as string) ?? "0");
  if (!circleId) { res.json([]); return; }

  const today = getMeccaTodayServer();
  const weekStart = getWeekSunday(today);

  // Records for this circle this week
  const records = await db.select({ date: recordsTable.date })
    .from(recordsTable)
    .where(and(eq(recordsTable.circleId, circleId), gte(recordsTable.date, weekStart)));

  // Teacher absences for this circle this week
  const absences = await db.select({ date: teacherAbsencesTable.date })
    .from(teacherAbsencesTable)
    .where(and(eq(teacherAbsencesTable.circleId, circleId), gte(teacherAbsencesTable.date, weekStart)));

  const daysSet = new Set<string>();
  for (const r of records) daysSet.add(r.date);
  for (const a of absences) daysSet.add(a.date);

  res.json([...daysSet]);
});

export default router;
