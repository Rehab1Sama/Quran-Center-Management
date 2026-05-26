import { Router, type IRouter } from "express";
import { db, circlesTable, usersTable, studentsTable, tracksTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { CreateCircleBody, UpdateCircleBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/circles", authenticate, async (req, res): Promise<void> => {
  const trackFilter = req.query.track as string | undefined;
  const isArchivedFilter = req.query.isArchived;

  const allCircles = await db.select().from(circlesTable);
  const allTracks = await db.select().from(tracksTable);
  const trackMap: Record<number, string> = {};
  allTracks.forEach(t => { trackMap[t.id] = t.dataEntryType; });

  let circles = allCircles.map(c => ({
    ...c,
    dataEntryType: c.trackId != null ? (trackMap[c.trackId] ?? "girls") : "girls",
  }));

  if (trackFilter) {
    circles = circles.filter(c => c.track === trackFilter);
  }
  if (isArchivedFilter !== undefined) {
    const archived = isArchivedFilter === "true";
    circles = circles.filter(c => c.isArchived === archived);
  }

  // Track supervisors and data entry can only see their track's circles
  if (req.userRole === "track_supervisor" || req.userRole === "data_entry") {
    circles = circles.filter(c => c.track === req.userTrack);
  }

  // Teachers/supervisors can only see their circle
  if (req.userRole === "teacher" || req.userRole === "supervisor") {
    circles = circles.filter(c => c.id === req.userCircleId);
  }

  res.json(circles);
});

router.post("/circles", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = CreateCircleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [circle] = await db.insert(circlesTable).values(parsed.data).returning();
  res.status(201).json(circle);
});

// Enriched circles — leader/track_supervisor: includes teacher name, supervisor name, student list
router.get("/circles/enriched", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  let circles = await db.select().from(circlesTable).where(eq(circlesTable.isArchived, false));
  if (req.userRole === "track_supervisor") {
    circles = circles.filter(c => c.track === req.userTrack);
  }

  const allUsers = await db.select({
    id: usersTable.id, name: usersTable.name, phone: usersTable.phone,
  }).from(usersTable);
  const userMap: Record<number, { name: string; phone: string | null }> = {};
  allUsers.forEach(u => { userMap[u.id] = { name: u.name, phone: u.phone }; });

  const allStudents = await db.select({
    id: studentsTable.id, fullName: studentsTable.fullName, circleId: studentsTable.circleId,
    phone: studentsTable.phone,
  }).from(studentsTable).where(eq(studentsTable.isArchived, false));
  const studentsByCircle: Record<number, { id: number; fullName: string }[]> = {};
  for (const s of allStudents) {
    if (s.circleId != null) {
      if (!studentsByCircle[s.circleId]) studentsByCircle[s.circleId] = [];
      studentsByCircle[s.circleId].push({ id: s.id, fullName: s.fullName });
    }
  }

  const enriched = circles.map(c => ({
    ...c,
    teacherName: c.teacherId ? (userMap[c.teacherId]?.name ?? null) : null,
    teacherPhone: c.teacherId ? (userMap[c.teacherId]?.phone ?? null) : null,
    supervisorName: c.supervisorId ? (userMap[c.supervisorId]?.name ?? null) : null,
    supervisorPhone: c.supervisorId ? (userMap[c.supervisorId]?.phone ?? null) : null,
    students: studentsByCircle[c.id] ?? [],
  }));

  res.json(enriched);
});

// Returns minimal circle info (id, name, track) for ALL circles regardless of role — used for transfer selections
router.get("/circles/names", authenticate, async (req, res): Promise<void> => {
  const circles = await db.select({
    id: circlesTable.id,
    name: circlesTable.name,
    track: circlesTable.track,
  }).from(circlesTable).where(eq(circlesTable.isArchived, false));
  res.json(circles);
});

router.get("/circles/:id", authenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
  if (!circle) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }

  // Permission check
  if (req.userRole === "teacher" || req.userRole === "supervisor") {
    if (req.userCircleId !== id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }
  if (req.userRole === "track_supervisor" || req.userRole === "data_entry") {
    if (circle.track !== req.userTrack) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
  }

  let teacher = null, supervisor = null;
  if (circle.teacherId) {
    const [t] = await db.select().from(usersTable).where(eq(usersTable.id, circle.teacherId));
    if (t) {
      const { passwordHash: _ph, ...safe } = t;
      teacher = safe;
    }
  }
  if (circle.supervisorId) {
    const [s] = await db.select().from(usersTable).where(eq(usersTable.id, circle.supervisorId));
    if (s) {
      const { passwordHash: _ph, ...safe } = s;
      supervisor = safe;
    }
  }

  const students = await db.select().from(studentsTable).where(
    and(eq(studentsTable.circleId, id), eq(studentsTable.isArchived, false))
  );

  res.json({ ...circle, teacher, supervisor, students });
});

router.patch("/circles/:id", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateCircleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  // Track supervisors can only edit meetingTime and whatsappLink for their own track's circles
  if (req.userRole === "track_supervisor") {
    const [existing] = await db.select().from(circlesTable).where(eq(circlesTable.id, id));
    if (!existing || existing.track !== req.userTrack) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const { meetingTime, whatsappLink } = parsed.data;
    const [updated] = await db.update(circlesTable).set({ meetingTime, whatsappLink }).where(eq(circlesTable.id, id)).returning();
    res.json(updated);
    return;
  }

  const [circle] = await db.update(circlesTable).set(parsed.data).where(eq(circlesTable.id, id)).returning();
  if (!circle) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }
  res.json(circle);
});

export default router;
