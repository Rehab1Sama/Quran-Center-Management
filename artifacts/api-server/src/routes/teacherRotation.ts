import { Router, type IRouter } from "express";
import { db, examRotationsTable, examTeacherAssignmentsTable, usersTable, circlesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.get("/exam-rotations", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") { res.status(403).json({ error: "Forbidden" }); return; }
  const rotations = await db.select().from(examRotationsTable).orderBy(examRotationsTable.createdAt);
  res.json(rotations.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })));
});

router.post("/exam-rotations", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") { res.status(403).json({ error: "Forbidden" }); return; }
  const { name, startDate, endDate, isActive } = req.body;
  if (!name || !startDate || !endDate) { res.status(400).json({ error: "name, startDate, endDate required" }); return; }
  const [row] = await db.insert(examRotationsTable).values({
    name, startDate, endDate, isActive: isActive ?? true, createdById: req.userId!,
  }).returning();
  res.status(201).json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.patch("/exam-rotations/:id", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") { res.status(403).json({ error: "Forbidden" }); return; }
  const id = parseInt(req.params.id as string);
  const [row] = await db.update(examRotationsTable).set(req.body).where(eq(examRotationsTable.id, id)).returning();
  if (!row) { res.status(404).json({ error: "Not found" }); return; }
  res.json({ ...row, createdAt: row.createdAt.toISOString() });
});

router.delete("/exam-rotations/:id", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") { res.status(403).json({ error: "Forbidden" }); return; }
  const id = parseInt(req.params.id as string);
  await db.delete(examTeacherAssignmentsTable).where(eq(examTeacherAssignmentsTable.rotationId, id));
  await db.delete(examRotationsTable).where(eq(examRotationsTable.id, id));
  res.status(204).send();
});

router.get("/exam-rotations/:id/assignments", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") { res.status(403).json({ error: "Forbidden" }); return; }
  const rotationId = parseInt(req.params.id as string);
  const assignments = await db.select().from(examTeacherAssignmentsTable).where(eq(examTeacherAssignmentsTable.rotationId, rotationId));
  const allUsers = await db.select().from(usersTable);
  const allCircles = await db.select().from(circlesTable);
  const userMap: Record<number, string> = {};
  allUsers.forEach(u => { userMap[u.id] = u.name; });
  const circleMap: Record<number, { name: string; meetingTime?: string | null }> = {};
  allCircles.forEach(c => { circleMap[c.id] = { name: c.name, meetingTime: c.meetingTime }; });

  res.json(assignments.map(a => ({
    ...a,
    teacherName: userMap[a.teacherId] ?? "غير معروف",
    originalCircleName: circleMap[a.originalCircleId]?.name ?? "غير معروف",
    originalMeetingTime: circleMap[a.originalCircleId]?.meetingTime ?? null,
    examCircleName: circleMap[a.examCircleId]?.name ?? "غير معروف",
    examMeetingTime: circleMap[a.examCircleId]?.meetingTime ?? null,
    createdAt: a.createdAt.toISOString(),
  })));
});

router.post("/exam-rotations/:id/assignments", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") { res.status(403).json({ error: "Forbidden" }); return; }
  const rotationId = parseInt(req.params.id as string);
  const { assignments } = req.body as { assignments: { teacherId: number; originalCircleId: number; examCircleId: number }[] };
  if (!Array.isArray(assignments)) { res.status(400).json({ error: "assignments array required" }); return; }
  await db.delete(examTeacherAssignmentsTable).where(eq(examTeacherAssignmentsTable.rotationId, rotationId));
  if (assignments.length > 0) {
    await db.insert(examTeacherAssignmentsTable).values(assignments.map(a => ({ ...a, rotationId })));
  }
  res.status(201).json({ saved: assignments.length });
});

export default router;
