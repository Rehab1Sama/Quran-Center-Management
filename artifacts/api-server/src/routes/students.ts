import { Router, type IRouter } from "express";
import { db, studentsTable, circlesTable, studentTransfersTable, studentNotesTable, messagesTable, recordsTable, reviewPlansTable, usersTable, studentArchiveEventsTable, studentLeaveHistoryTable, studentEnrollmentsTable } from "@workspace/db";
import { eq, and, gte, desc, sql, ne } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import { CreateStudentBody, UpdateStudentBody } from "@workspace/api-zod";

const router: IRouter = Router();

function parseId(raw: string | string[]): number {
  return parseInt(Array.isArray(raw) ? raw[0] : raw, 10);
}

const STAFF_ROLES = ["leader", "track_supervisor", "teacher", "supervisor"];

// ── List students ──────────────────────────────────────────────────────────────
router.get("/students", authenticate, async (req, res): Promise<void> => {
  const circleIdRaw = req.query.circleId;
  const isArchivedRaw = req.query.isArchived;
  const q = (req.query.q as string | undefined)?.trim().toLowerCase();

  // When filtering by circleId: use enrollments as the source of truth
  if (circleIdRaw) {
    const circleId = parseInt(circleIdRaw as string, 10);
    // isArchived=true → show enrollment-archived in this circle; otherwise show active
    const wantEnrollmentArchived = isArchivedRaw === "true";
    const enrollments = await db
      .select({
        id: studentsTable.id,
        fullName: studentsTable.fullName,
        circleId: studentEnrollmentsTable.circleId,
        phone: studentsTable.phone,
        country: studentsTable.country,
        ageRange: studentsTable.ageRange,
        educationLevel: studentsTable.educationLevel,
        memorizeFrom: studentsTable.memorizeFrom,
        extraData: studentsTable.extraData,
        isArchived: studentsTable.isArchived,
        isNewcomer: studentsTable.isNewcomer,
        archivedAt: studentsTable.archivedAt,
        leaveStart: studentEnrollmentsTable.leaveStart,
        leaveEnd: studentEnrollmentsTable.leaveEnd,
        createdAt: studentsTable.createdAt,
        updatedAt: studentsTable.updatedAt,
        enrollmentId: studentEnrollmentsTable.id,
        enrollmentIsArchived: studentEnrollmentsTable.isArchived,
      })
      .from(studentsTable)
      .innerJoin(
        studentEnrollmentsTable,
        and(
          eq(studentEnrollmentsTable.studentId, studentsTable.id),
          eq(studentEnrollmentsTable.circleId, circleId),
        ),
      )
      .where(eq(studentEnrollmentsTable.isArchived, wantEnrollmentArchived));

    let result = enrollments;
    if (q) result = result.filter(s => s.fullName.toLowerCase().includes(q));
    res.json(result);
    return;
  }

  let students = await db.select().from(studentsTable);

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

// ── Create student ─────────────────────────────────────────────────────────────
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

  // Auto-create enrollment if circleId provided
  if (parsed.data.circleId) {
    await db.insert(studentEnrollmentsTable)
      .values({ studentId: student.id, circleId: parsed.data.circleId, isArchived: false })
      .onConflictDoNothing();
  }

  res.status(201).json(student);
});

// ── Get single student ─────────────────────────────────────────────────────────
router.get("/students/:id", authenticate, async (req, res): Promise<void> => {
  const id = parseId(req.params.id);
  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }
  res.json(student);
});

// ── Update student ─────────────────────────────────────────────────────────────
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

  // If circleId changed, log transfer + create/update enrollment
  if (parsed.data.circleId !== undefined && parsed.data.circleId !== before.circleId) {
    await db.insert(studentTransfersTable).values({
      studentId: id,
      fromCircleId: before.circleId ?? undefined,
      toCircleId: parsed.data.circleId!,
      transferredById: req.userId!,
    });
    // Ensure enrollment exists in new circle
    if (parsed.data.circleId) {
      await db.insert(studentEnrollmentsTable)
        .values({ studentId: id, circleId: parsed.data.circleId, isArchived: false })
        .onConflictDoUpdate({
          target: [studentEnrollmentsTable.studentId, studentEnrollmentsTable.circleId],
          set: { isArchived: false, archivedAt: null },
        });
    }
  }

  res.json(student);
});

// ── Delete (soft) student ──────────────────────────────────────────────────────
router.delete("/students/:id", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  await db.update(studentsTable).set({ isArchived: true }).where(eq(studentsTable.id, id));
  res.sendStatus(204);
});

// ── Archive student (per-circle or global) ─────────────────────────────────────
// Body: { circleId?: number }
// If circleId → archive only that enrollment
// If no circleId → global archive (leader only): archive student + all enrollments
router.patch("/students/:id/archive", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  const { circleId } = req.body as { circleId?: number };

  const [before] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!before) { res.status(404).json({ error: "Student not found" }); return; }

  if (circleId) {
    // Per-circle archive: archive the enrollment
    await db.update(studentEnrollmentsTable)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(
        and(
          eq(studentEnrollmentsTable.studentId, id),
          eq(studentEnrollmentsTable.circleId, circleId),
        ),
      );

    // If this was the student's primary circle, clear it
    if (before.circleId === circleId) {
      // Find another active enrollment to promote as primary
      const [otherEnrollment] = await db.select()
        .from(studentEnrollmentsTable)
        .where(
          and(
            eq(studentEnrollmentsTable.studentId, id),
            eq(studentEnrollmentsTable.isArchived, false),
            ne(studentEnrollmentsTable.circleId, circleId),
          ),
        )
        .limit(1);
      await db.update(studentsTable)
        .set({ circleId: otherEnrollment?.circleId ?? null })
        .where(eq(studentsTable.id, id));
    }

    await db.insert(studentArchiveEventsTable).values({
      studentId: id, eventType: "archived", circleIdAtTime: circleId, performedById: req.userId ?? null,
    });

    const [updated] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
    res.json(updated);
  } else {
    // Global archive (leader-only)
    const [student] = await db.update(studentsTable)
      .set({ isArchived: true, circleId: null, archivedAt: new Date() })
      .where(eq(studentsTable.id, id)).returning();
    if (!student) { res.status(404).json({ error: "Student not found" }); return; }

    // Archive all enrollments
    await db.update(studentEnrollmentsTable)
      .set({ isArchived: true, archivedAt: new Date() })
      .where(eq(studentEnrollmentsTable.studentId, id));

    await db.insert(studentArchiveEventsTable).values({
      studentId: id, eventType: "archived", circleIdAtTime: before?.circleId ?? null, performedById: req.userId ?? null,
    });
    res.json(student);
  }
});

// ── Restore student ────────────────────────────────────────────────────────────
// Body: { circleId?: number }
// If circleId → restore/upsert enrollment + make student active
// If no circleId → restore globally (no circle assignment)
router.patch("/students/:id/restore", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const id = parseId(req.params.id);
  const { circleId } = req.body as { circleId?: number | null };

  const updateData: { isArchived: boolean; archivedAt: null; circleId?: number | null } = {
    isArchived: false, archivedAt: null,
  };
  if (circleId !== undefined) updateData.circleId = circleId;

  const [student] = await db.update(studentsTable).set(updateData).where(eq(studentsTable.id, id)).returning();
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  if (circleId) {
    await db.insert(studentEnrollmentsTable)
      .values({ studentId: id, circleId, isArchived: false })
      .onConflictDoUpdate({
        target: [studentEnrollmentsTable.studentId, studentEnrollmentsTable.circleId],
        set: { isArchived: false, archivedAt: null },
      });
  }

  await db.insert(studentArchiveEventsTable).values({
    studentId: id, eventType: "restored", circleIdAtTime: circleId ?? null, performedById: req.userId ?? null,
  });
  res.json(student);
});

// ── Students on leave ──────────────────────────────────────────────────────────
router.get("/students/on-leave", authenticate, async (req, res): Promise<void> => {
  if (!req.userId) { res.status(401).json({ error: "Unauthorized" }); return; }

  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Get all active enrollments that have a current leave
  const enrollments = await db
    .select({
      id: studentsTable.id,
      fullName: studentsTable.fullName,
      phone: studentsTable.phone,
      circleId: studentEnrollmentsTable.circleId,
      leaveStart: studentEnrollmentsTable.leaveStart,
      leaveEnd: studentEnrollmentsTable.leaveEnd,
      enrollmentId: studentEnrollmentsTable.id,
    })
    .from(studentEnrollmentsTable)
    .innerJoin(studentsTable, eq(studentsTable.id, studentEnrollmentsTable.studentId))
    .where(
      and(
        eq(studentEnrollmentsTable.isArchived, false),
        eq(studentsTable.isArchived, false),
      ),
    );

  const onLeaveEnrollments = enrollments.filter(e => {
    if (!e.leaveStart || !e.leaveEnd) return false;
    return e.leaveStart <= today && today <= e.leaveEnd;
  });

  if (!onLeaveEnrollments.length) { res.json([]); return; }

  const circles = await db.select().from(circlesTable);
  const circleMap: Record<number, typeof circles[0]> = {};
  for (const c of circles) circleMap[c.id] = c;

  const activePlans = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.status, "active"));
  const planByStudent: Record<number, typeof activePlans[0]> = {};
  for (const p of activePlans) planByStudent[p.studentId] = p;

  function getWorkingDaysBetween(start: string, end: string): string[] {
    const days: string[] = [];
    const cur = new Date(start + "T12:00:00Z");
    const endD = new Date(end + "T12:00:00Z");
    while (cur <= endD) {
      const dow = cur.getUTCDay();
      if (dow !== 5) days.push(cur.toISOString().slice(0, 10));
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
    return days;
  }

  const result = await Promise.all(onLeaveEnrollments.map(async enr => {
    const circle = circleMap[enr.circleId];
    const plan = planByStudent[enr.id];

    const leaveStart = enr.leaveStart!;
    const leaveEnd = enr.leaveEnd!;
    const leaveDays = getWorkingDaysBetween(leaveStart, today);

    const trackType = circle?.trackType ?? "girls";
    const useMemoForTrack = trackType === "simple_review" || trackType === "fixation";
    let enteredDays = 0;
    let enteredToday = false;
    let todayStatus: "full" | "partial" | "none" | null = null;

    if (plan && leaveDays.length > 0) {
      const records = await db.select().from(recordsTable)
        .where(and(eq(recordsTable.studentId, enr.id), gte(recordsTable.date, leaveStart)));
      for (const day of leaveDays) {
        const rec = records.find(r => r.date === day && !r.isAbsent);
        if (rec) { enteredDays++; if (day === today) enteredToday = true; }
      }
      const todayRec = records.find(r => r.date === today && !r.isAbsent);
      if (todayRec) {
        const actualPages = useMemoForTrack ? (todayRec.memorizePages ?? 0) : (todayRec.reviewFarPages ?? 0);
        const plannedPerDay = plan.cycleLength > 0 ? plan.totalPages / plan.cycleLength : 0;
        if (actualPages >= plannedPerDay && plannedPerDay > 0) todayStatus = "full";
        else if (actualPages > 0) todayStatus = "partial";
        else todayStatus = "none";
      }
    }

    return {
      id: enr.id,
      fullName: enr.fullName,
      circleId: enr.circleId,
      circleName: circle?.name ?? null,
      track: circle?.track ?? null,
      trackType,
      leaveStart,
      leaveEnd,
      hasPlan: !!plan,
      leaveDaysCount: leaveDays.length,
      enteredDays,
      enteredToday,
      todayStatus,
    };
  }));

  res.json(result);
});

// ── Grant / cancel leave (per-circle) ─────────────────────────────────────────
// Body: { leaveStart, leaveEnd, circleId? }
// If circleId → update enrollment's leave dates
// If no circleId → update student's leave dates (backward compat)
router.patch("/students/:id/leave", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const id = parseId(req.params.id);
  const { leaveStart, leaveEnd, circleId } = req.body as {
    leaveStart?: string | null;
    leaveEnd?: string | null;
    circleId?: number;
  };

  if (circleId) {
    // Update enrollment leave dates
    await db.update(studentEnrollmentsTable)
      .set({ leaveStart: leaveStart ?? null, leaveEnd: leaveEnd ?? null })
      .where(
        and(
          eq(studentEnrollmentsTable.studentId, id),
          eq(studentEnrollmentsTable.circleId, circleId),
        ),
      );
  } else {
    // Backward compat: also update students table + primary enrollment
    await db.update(studentsTable)
      .set({ leaveStart: leaveStart ?? null, leaveEnd: leaveEnd ?? null })
      .where(eq(studentsTable.id, id));

    // Update all active enrollments of the student
    await db.update(studentEnrollmentsTable)
      .set({ leaveStart: leaveStart ?? null, leaveEnd: leaveEnd ?? null })
      .where(
        and(
          eq(studentEnrollmentsTable.studentId, id),
          eq(studentEnrollmentsTable.isArchived, false),
        ),
      );
  }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  if (leaveStart && leaveEnd) {
    await db.insert(studentLeaveHistoryTable).values({
      studentId: id, leaveStart, leaveEnd, grantedById: req.userId ?? null,
    });
  } else if (!leaveStart && !leaveEnd) {
    const [lastLeave] = await db.select().from(studentLeaveHistoryTable)
      .where(and(
        eq(studentLeaveHistoryTable.studentId, id),
        sql`${studentLeaveHistoryTable.cancelledAt} IS NULL`,
      ))
      .orderBy(desc(studentLeaveHistoryTable.grantedAt))
      .limit(1);
    if (lastLeave) {
      await db.update(studentLeaveHistoryTable)
        .set({ cancelledAt: new Date(), cancelledById: req.userId ?? null })
        .where(eq(studentLeaveHistoryTable.id, lastLeave.id));
    }
  }

  res.json(student);
});

// ── Enroll student in a new circle ────────────────────────────────────────────
// POST /students/:id/enroll
// Body: { circleId: number }
router.post("/students/:id/enroll", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const id = parseId(req.params.id);
  const { circleId } = req.body as { circleId: number };
  if (!circleId) { res.status(400).json({ error: "circleId required" }); return; }

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, id));
  if (!student) { res.status(404).json({ error: "Student not found" }); return; }

  const [enrollment] = await db.insert(studentEnrollmentsTable)
    .values({ studentId: id, circleId, isArchived: false })
    .onConflictDoUpdate({
      target: [studentEnrollmentsTable.studentId, studentEnrollmentsTable.circleId],
      set: { isArchived: false, archivedAt: null },
    })
    .returning();

  // If student has no primary circle, set it
  if (!student.circleId) {
    await db.update(studentsTable).set({ circleId }).where(eq(studentsTable.id, id));
  }

  res.status(201).json(enrollment);
});

// ── List enrollments for a student ────────────────────────────────────────────
// GET /students/:id/enrollments
router.get("/students/:id/enrollments", authenticate, async (req, res): Promise<void> => {
  if (!STAFF_ROLES.includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const id = parseId(req.params.id);

  const enrollments = await db
    .select({
      id: studentEnrollmentsTable.id,
      studentId: studentEnrollmentsTable.studentId,
      circleId: studentEnrollmentsTable.circleId,
      isArchived: studentEnrollmentsTable.isArchived,
      archivedAt: studentEnrollmentsTable.archivedAt,
      leaveStart: studentEnrollmentsTable.leaveStart,
      leaveEnd: studentEnrollmentsTable.leaveEnd,
      circleName: circlesTable.name,
      circleTrack: circlesTable.track,
    })
    .from(studentEnrollmentsTable)
    .innerJoin(circlesTable, eq(circlesTable.id, studentEnrollmentsTable.circleId))
    .where(eq(studentEnrollmentsTable.studentId, id))
    .orderBy(studentEnrollmentsTable.createdAt);

  res.json(enrollments);
});

// ── Student notes ──────────────────────────────────────────────────────────────
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

// ── Student profile ────────────────────────────────────────────────────────────
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

  // All enrollments for this student
  const enrollments = await db
    .select({
      id: studentEnrollmentsTable.id,
      circleId: studentEnrollmentsTable.circleId,
      isArchived: studentEnrollmentsTable.isArchived,
      archivedAt: studentEnrollmentsTable.archivedAt,
      leaveStart: studentEnrollmentsTable.leaveStart,
      leaveEnd: studentEnrollmentsTable.leaveEnd,
      circleName: circlesTable.name,
      circleTrack: circlesTable.track,
    })
    .from(studentEnrollmentsTable)
    .innerJoin(circlesTable, eq(circlesTable.id, studentEnrollmentsTable.circleId))
    .where(eq(studentEnrollmentsTable.studentId, id))
    .orderBy(studentEnrollmentsTable.createdAt);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const allRecords = await db.select().from(recordsTable).where(eq(recordsTable.studentId, id));
  const recentAbsences = allRecords
    .filter(r => r.isAbsent && r.date >= thirtyDaysAgo)
    .map(r => r.date)
    .sort((a, b) => b.localeCompare(a));

  const totalSessions = allRecords.length;
  const totalAbsences = allRecords.filter(r => r.isAbsent).length;
  const attendanceRate = totalSessions > 0 ? Math.round(((totalSessions - totalAbsences) / totalSessions) * 100) : null;

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

  const presentRecords = allRecords.filter(r => !r.isAbsent);
  const totalMemorizePages = presentRecords.reduce((s, r) => s + (r.memorizePages ?? 0), 0);
  const totalReviewPages = presentRecords.reduce((s, r) => s + (r.reviewPages ?? 0) + (r.reviewNearPages ?? 0) + (r.reviewFarPages ?? 0), 0);
  const totalRecitationPages = presentRecords.reduce((s, r) => s + (r.recitationPages ?? 0), 0);

  const isRecitationTrack = circle?.trackType === "recitation";
  const totalShortcomings = presentRecords.filter(r => {
    if (r.shortcomingOverride === true) return true;
    if (r.shortcomingOverride === false) return false;
    if (isRecitationTrack) return r.listenedToReciter === false;
    const noReview = (r.reviewNearPages ?? 0) === 0 && (r.reviewFarPages ?? 0) === 0 && (r.reviewPages ?? 0) === 0;
    return noReview || r.listenedToReciter === false;
  }).length;

  const leaveHistoryRaw = await db.select().from(studentLeaveHistoryTable)
    .where(eq(studentLeaveHistoryTable.studentId, id))
    .orderBy(desc(studentLeaveHistoryTable.grantedAt));

  const lhUserIds = [...new Set([
    ...leaveHistoryRaw.map(l => l.grantedById).filter((x): x is number => x !== null),
    ...leaveHistoryRaw.map(l => l.cancelledById).filter((x): x is number => x !== null),
  ])];
  const lhUsers = lhUserIds.length
    ? await db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable)
        .where(sql`${usersTable.id} = ANY(ARRAY[${sql.join(lhUserIds.map(uid => sql`${uid}`), sql`, `)}]::int[])`)
    : [];
  const lhUserMap: Record<number, string> = {};
  for (const u of lhUsers) lhUserMap[u.id] = u.name;

  const leaveHistory = leaveHistoryRaw.map(l => ({
    id: l.id,
    leaveStart: l.leaveStart,
    leaveEnd: l.leaveEnd,
    grantedAt: l.grantedAt.toISOString(),
    grantedBy: l.grantedById ? (lhUserMap[l.grantedById] ?? "غير معروف") : null,
    cancelledAt: l.cancelledAt?.toISOString() ?? null,
    cancelledBy: l.cancelledById ? (lhUserMap[l.cancelledById] ?? "غير معروف") : null,
  }));

  const meccaNow = new Date(Date.now() + 3 * 60 * 60 * 1000);
  const cutoff180 = new Date(meccaNow);
  cutoff180.setDate(cutoff180.getDate() - 179);
  const cutoffStr = cutoff180.toISOString().slice(0, 10);
  const heatmapData = allRecords
    .filter(r => r.date >= cutoffStr)
    .map(r => {
      const totalPages =
        (r.memorizePages ?? 0) + (r.reviewNearPages ?? 0) +
        (r.reviewFarPages ?? 0) + (r.reviewPages ?? 0) + (r.recitationPages ?? 0);
      return {
        date: r.date,
        status: r.isAbsent
          ? "absent"
          : totalPages >= 2 ? "present" : totalPages > 0 ? "low" : "attended",
      };
    });

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
    enrollments,
    recentAbsences,
    totalSessions,
    totalAbsences,
    attendanceRate,
    monthlyTrend,
    transfers: transfersByUser,
    notes,
    messages,
    totalMemorizePages,
    totalReviewPages,
    totalRecitationPages,
    totalShortcomings,
    leaveHistory,
    heatmapData,
    recentRecords,
  });
});

export default router;
