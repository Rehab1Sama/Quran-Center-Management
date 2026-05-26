import { Router, type IRouter } from "express";
import { db, studentsTable, circlesTable, studentTransfersTable, studentNotesTable, messagesTable, recordsTable, usersTable, studentArchiveEventsTable } from "@workspace/db";
import { eq, and, gte, desc, sql } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { CreateStudentBody, UpdateStudentBody } from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

const STAFF_ROLES = ["leader", "track_supervisor", "teacher", "supervisor"];

router.get("/students", authenticate, async (req, res): Promise<void> => {
  const circleIdRaw = req.query.circleId;
  const isArchivedRaw = req.query.isArchived;
  const q = (req.query.q as string | undefined)?.trim().toLowerCase();

  let students = await db.select().from(studentsTable);

  if (circleIdRaw) {
    const circleId = parseInt(circleIdRaw as string, 10);
    students = students.filter(s => s.circleId === circleId);
  }
  if (isArchivedRaw !== undefined) {
    const archived = isArchivedRaw === "true";
    students = students.filter(s => s.isArchived === archived);
  } else {
    students = students.filter(s => !s.isArchived);
  }

  if (req.userRole === "student") {
    students = students.filter(s => s.circleId === req.userCircleId);
  }

  if (q) {
    students = students.filter(s => s.fullName.toLowerCase().includes(q));
  }

  res.json(students);
});

router.post("/students", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor", "data_entry"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = CreateStudentBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [student] = await db.insert(studentsTable).values(parsed.data).returning();
  res.status(201).json(student);
});

router.get("/students/:id", authenticate, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  res.json(student);
});

router.patch("/students/:id", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  const parsed = UpdateStudentBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }

  const [before] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!before) { res.status(404).json({ error: "Student not found" }); return; }

  const [student] = await db.update(studentsTable).set(parsed.data).where(eq(studentsTable.id, id)).returning();
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  if (parsed.data.circleId !== undefined && parsed.data.circleId !== before.circleId) {
    await db.insert(studentTransfersTable).values({
      studentId: id,
      fromCircleId: before.circleId ?? undefined,
      toCircleId: parsed.data.circleId!,
      transferredById: req.userId!,
    });
  }

  res.json(student);
});

router.delete("/students/:id", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  await db.update(studentsTable).set({ isArchived: true }).where(eq(studentsTable.id, id));
  res.sendStatus(204);
});

router.patch("/students/:id/archive", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  const [before] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  const [student] = await db.update(studentsTable).set({ isArchived: true, circleId: null, archivedAt: new Date() }).where(eq(studentsTable.id, id)).returning();
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  await db.insert(studentArchiveEventsTable).values({ studentId: id, eventType: "archived", circleIdAtTime: before?.circleId ?? null, performedById: req.userId ?? null });
  res.json(student);
});

router.patch("/students/:id/restore", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  const { circleId } = req.body as { circleId?: number | null };
  const updateData: { isArchived: boolean; archivedAt: null; circleId?: number | null } = { isArchived: false, archivedAt: null };
  if (circleId !== undefined) updateData.circleId = circleId;
  const [student] = await db.update(studentsTable).set(updateData).where(eq(studentsTable.id, id)).returning();
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  await db.insert(studentArchiveEventsTable).values({ studentId: id, eventType: "restored", circleIdAtTime: circleId ?? null, performedById: req.userId ?? null });
  res.json(student);
});

router.patch("/students/:id/leave", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  const { leaveStart, leaveEnd } = req.body as { leaveStart?: string | null; leaveEnd?: string | null };
  const [student] = await db.update(studentsTable)
    .set({ leaveStart: leaveStart ?? null, leaveEnd: leaveEnd ?? null })
    .where(eq(studentsTable.id, id)).returning();
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  res.json(student);
});

router.get("/students/:id/notes", authenticate, async (req, res): Promise<void> => {
  if (!STAFF_ROLES.includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  const notes = await db.select().from(studentNotesTable)
    .where(eq(studentNotesTable.studentId, id))
    .orderBy(desc(studentNotesTable.createdAt));

  const authorIds = [...new Set(notes.map(n => n.authorId))];
  const authors = authorIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(authorIds.map(id => sql`${id}`), sql`, `)}]::int[])`)
    : [];
  const authorMap: Record<number, string> = {};
  for (const a of authors) authorMap[a.id] = a.name;

  res.json(notes.map(n => ({
    id: n.id,
    studentId: n.studentId,
    authorId: n.authorId,
    authorName: authorMap[n.authorId] ?? "غير معروف",
    content: n.content,
    createdAt: n.createdAt.toISOString(),
  })));
});

router.post("/students/:id/notes", authenticate, async (req, res): Promise<void> => {
  if (!STAFF_ROLES.includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  const { content } = req.body as { content: string };
  if (!content?.trim()) { res.status(400).json({ error: "Content required" }); return; }

  const [note] = await db.insert(studentNotesTable).values({
    studentId: id,
    authorId: req.userId!,
    content: content.trim(),
  }).returning();

  const [author] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, req.userId!));

  res.status(201).json({
    id: note.id,
    studentId: note.studentId,
    authorId: note.authorId,
    authorName: author?.name ?? "غير معروف",
    content: note.content,
    createdAt: note.createdAt.toISOString(),
  });
});

router.delete("/students/:id/notes/:noteId", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!) && req.userRole !== "teacher" && req.userRole !== "supervisor") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const noteId = parseId(req.params.noteId);
  await db.delete(studentNotesTable).where(
    and(eq(studentNotesTable.id, noteId), eq(studentNotesTable.authorId, req.userId!))
  );
  res.sendStatus(204);
});

router.get("/students/:id/profile", authenticate, async (req, res): Promise<void> => {
  if (!STAFF_ROLES.includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const [circle] = student.circleId
    ? await db.select().from(circlesTable).where(eq(circlesTable.id, student.circleId))
    : [];

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const allRecords = await db.select().from(recordsTable).where(eq(recordsTable.studentId, id));
  const recentAbsences = allRecords
    .filter(r => r.isAbsent && r.date >= thirtyDaysAgo)
    .map(r => r.date)
    .sort((a, b) => b.localeCompare(a));

  const totalSessions = allRecords.length;
  const totalAbsences = allRecords.filter(r => r.isAbsent).length;
  const attendanceRate = totalSessions > 0 ? Math.round(((totalSessions - totalAbsences) / totalSessions) * 100) : null;

  // Monthly attendance trend for last 6 months
  const monthlyMap: Record<string, { sessions: number; absences: number }> = {};
  for (const r of allRecords) {
    const month = r.date.slice(0, 7);
    if (!monthlyMap[month]) monthlyMap[month] = { sessions: 0, absences: 0 };
    monthlyMap[month].sessions++;
    if (r.isAbsent) monthlyMap[month].absences++;
  }
  const now = new Date();
  const monthlyTrend = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const month = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const data = monthlyMap[month] ?? { sessions: 0, absences: 0 };
    return {
      month,
      sessions: data.sessions,
      absences: data.absences,
      attendanceRate: data.sessions > 0 ? Math.round(((data.sessions - data.absences) / data.sessions) * 100) : null,
    };
  }).reverse();

  const transfers = await db.select().from(studentTransfersTable)
    .where(eq(studentTransfersTable.studentId, id))
    .orderBy(desc(studentTransfersTable.transferredAt));

  const circleIds = [...new Set(transfers.flatMap(t => [t.fromCircleId, t.toCircleId].filter(Boolean) as number[]))];
  const circles = circleIds.length
    ? await db.select().from(circlesTable).where(sql`${circlesTable.id} = ANY(ARRAY[${sql.join(circleIds.map(cid => sql`${cid}`), sql`, `)}]::int[])`)
    : [];
  const circleNameMap: Record<number, string> = {};
  for (const c of circles) circleNameMap[c.id] = `${c.name} (${c.track})`;

  const transfersByUser = await Promise.all(
    transfers.map(async t => {
      const [user] = await db.select({ name: usersTable.name }).from(usersTable).where(eq(usersTable.id, t.transferredById));
      return {
        id: t.id,
        fromCircle: t.fromCircleId ? (circleNameMap[t.fromCircleId] ?? "غير معروف") : null,
        toCircle: circleNameMap[t.toCircleId] ?? "غير معروف",
        transferredBy: user?.name ?? "غير معروف",
        transferredAt: t.transferredAt.toISOString(),
      };
    })
  );

  // Notes
  const rawNotes = await db.select().from(studentNotesTable)
    .where(eq(studentNotesTable.studentId, id))
    .orderBy(desc(studentNotesTable.createdAt));
  const authorIds = [...new Set(rawNotes.map(n => n.authorId))];
  const noteAuthors = authorIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(authorIds.map(aid => sql`${aid}`), sql`, `)}]::int[])`)
    : [];
  const noteAuthorMap: Record<number, string> = {};
  for (const a of noteAuthors) noteAuthorMap[a.id] = a.name;
  const notes = rawNotes.map(n => ({
    id: n.id,
    studentId: n.studentId,
    authorId: n.authorId,
    authorName: noteAuthorMap[n.authorId] ?? "غير معروف",
    content: n.content,
    createdAt: n.createdAt.toISOString(),
  }));

  // Messages relevant to this student (personal + circle + track)
  const allMessages = await db.select().from(messagesTable).orderBy(desc(messagesTable.createdAt));
  const relevantMessages = allMessages.filter(m => {
    if (m.targetType === "student") return m.targetId === String(student.id);
    if (m.targetType === "circle") return student.circleId && m.targetId === String(student.circleId);
    if (m.targetType === "track") return circle && m.targetId === circle.track;
    return false;
  });

  const senderIds = [...new Set(relevantMessages.map(m => m.senderId))];
  const senders = senderIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(senderIds.map(sid => sql`${sid}`), sql`, `)}]::int[])`)
    : [];
  const senderMap: Record<number, string> = {};
  for (const s of senders) senderMap[s.id] = s.name;

  const messages = relevantMessages.map(m => {
    let targetLabel = m.targetId;
    if (m.targetType === "student") targetLabel = student.fullName;
    else if (m.targetType === "circle") targetLabel = circle?.name ?? m.targetId;
    else if (m.targetType === "track") targetLabel = m.targetId;
    return {
      id: m.id,
      senderId: m.senderId,
      senderName: senderMap[m.senderId] ?? "غير معروف",
      targetType: m.targetType,
      targetId: m.targetId,
      targetLabel,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    };
  });

  // Totals from all non-absent records
  const presentRecords = allRecords.filter(r => !r.isAbsent);
  const totalMemorizePages = presentRecords.reduce((s, r) => s + (r.memorizePages ?? 0), 0);
  const totalReviewPages = presentRecords.reduce((s, r) => s + (r.reviewPages ?? 0) + (r.reviewNearPages ?? 0) + (r.reviewFarPages ?? 0), 0);
  const totalRecitationPages = presentRecords.reduce((s, r) => s + (r.recitationPages ?? 0), 0);

  // Recent sessions (last 20 records sorted by date desc)
  const recentRecords = [...allRecords]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 20)
    .map(r => ({
      id: r.id,
      date: r.date,
      isAbsent: r.isAbsent,
      memorizePages: r.memorizePages ?? null,
      memorizeSurahStart: r.memorizeSurahStart ?? null,
      memorizeSurahEnd: r.memorizeSurahEnd ?? null,
      memorizeAyahStart: r.memorizeAyahStart ?? null,
      memorizeAyahEnd: r.memorizeAyahEnd ?? null,
      reviewNearPages: r.reviewNearPages ?? null,
      reviewNearSurahStart: r.reviewNearSurahStart ?? null,
      reviewNearSurahEnd: r.reviewNearSurahEnd ?? null,
      reviewFarPages: r.reviewFarPages ?? null,
      reviewFarSurahStart: r.reviewFarSurahStart ?? null,
      reviewFarSurahEnd: r.reviewFarSurahEnd ?? null,
      reviewPages: r.reviewPages ?? null,
      reviewSurahStart: r.reviewSurahStart ?? null,
      reviewSurahEnd: r.reviewSurahEnd ?? null,
      recitationPages: r.recitationPages ?? null,
      recitationSurahStart: r.recitationSurahStart ?? null,
      recitationSurahEnd: r.recitationSurahEnd ?? null,
      listenedToReciter: r.listenedToReciter ?? null,
      shortcomingOverride: r.shortcomingOverride ?? null,
    }));

  res.json({
    id: student.id,
    fullName: student.fullName,
    phone: student.phone,
    country: student.country,
    ageRange: student.ageRange,
    educationLevel: student.educationLevel,
    memorizeFrom: student.memorizeFrom,
    isArchived: student.isArchived,
    leaveStart: student.leaveStart,
    leaveEnd: student.leaveEnd,
    createdAt: student.createdAt.toISOString(),
    circle: circle ? { id: circle.id, name: circle.name, track: circle.track, trackType: circle.trackType } : null,
    attendanceSummary: { totalSessions, totalAbsences, attendanceRate },
    recentAbsences,
    monthlyTrend,
    transfers: transfersByUser,
    notes,
    messages,
    recentRecords,
    totalMemorizePages: Math.round(totalMemorizePages * 10) / 10,
    totalReviewPages: Math.round(totalReviewPages * 10) / 10,
    totalRecitationPages: Math.round(totalRecitationPages * 10) / 10,
  });
});

export default router;
