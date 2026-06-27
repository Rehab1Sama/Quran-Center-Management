import { Router, type IRouter } from "express";
import { db, usersTable, studentsTable, circlesTable, recordsTable, studentGoalsTable, studentNotesTable, studentTransfersTable, examRecordsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { authenticate, requireRole } from "../middlewares/authenticate";
import { CreateUserBody, UpdateUserBody, ResetUserPasswordBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users/archived-staff", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy"].includes(req.userRole ?? "")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const archived = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, track: usersTable.track, circleId: usersTable.circleId, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.isArchived, true));
  const staffRoles = ["teacher", "supervisor", "track_supervisor", "data_entry", "deputy"];
  res.json(archived.filter(u => staffRoles.includes(u.role)));
});

router.post("/users/:id/restore", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy"].includes(req.userRole ?? "")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const id = parseInt(req.params.id);
  const [user] = await db.update(usersTable).set({ isArchived: false }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  res.json({ success: true });
});

router.get("/users/unlinked-staff", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy"].includes(req.userRole ?? "")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const staff = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, circleId: usersTable.circleId, track: usersTable.track, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.role, "teacher"));
  const staffSup = await db
    .select({ id: usersTable.id, name: usersTable.name, email: usersTable.email, role: usersTable.role, circleId: usersTable.circleId, track: usersTable.track, createdAt: usersTable.createdAt })
    .from(usersTable)
    .where(eq(usersTable.role, "supervisor"));
  const allStaff = [...staff, ...staffSup];

  const circles = await db.select({ id: circlesTable.id, name: circlesTable.name, track: circlesTable.track, teacherId: circlesTable.teacherId, supervisorId: circlesTable.supervisorId }).from(circlesTable);

  const linkedTeacherIds = new Set(circles.map(c => c.teacherId).filter(Boolean));
  const linkedSupervisorIds = new Set(circles.map(c => c.supervisorId).filter(Boolean));

  const unlinked = allStaff.filter(u =>
    (u.role === "teacher" && !linkedTeacherIds.has(u.id)) ||
    (u.role === "supervisor" && !linkedSupervisorIds.has(u.id))
  );

  res.json({ unlinked, circles: circles.filter(c => !c.isArchived) });
});

router.get("/users", authenticate, async (req, res): Promise<void> => {
  // مسؤولة المسار ترى الطالبات والمعلمات والمشرفات في مسارها فقط
  if (req.userRole === "track_supervisor") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const myTrack = me?.track ?? null;
    const all = await db.select().from(usersTable);
    const filtered = all.filter(u =>
      u.track === myTrack && ["student", "teacher", "supervisor"].includes(u.role)
    );
    res.json(filtered.map(({ passwordHash: _ph, ...u }) => u));
    return;
  }
  if (req.userRole !== "leader" && req.userRole !== "deputy") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const roleFilter = req.query.role as string | undefined;
  const users = await db.select().from(usersTable);
  const filtered = roleFilter ? users.filter(u => u.role === roleFilter) : users;
  res.json(filtered.map(({ passwordHash: _ph, ...u }) => u));
});

router.get("/users/by-email", authenticate, async (req, res): Promise<void> => {
  const email = ((req.query.email as string) ?? "").toLowerCase().trim();
  if (!email) { res.status(400).json({ error: "Email required" }); return; }
  const [user] = await db.select({
    id: usersTable.id, name: usersTable.name, email: usersTable.email,
  }).from(usersTable).where(eq(usersTable.email, email));
  if (!user) { res.status(404).json({ error: "لم يُعثر على حساب بهذا البريد" }); return; }
  res.json(user);
});

router.post("/users", authenticate, async (req, res): Promise<void> => {
  // مسؤولة المسار يمكنها إضافة طالبات ومعلمات ومشرفات فقط
  if (req.userRole === "track_supervisor") {
    const body = req.body as { role?: string };
    const allowed = ["student", "teacher", "supervisor"];
    if (!body.role || !allowed.includes(body.role)) {
      res.status(403).json({ error: "مسؤولة المسار يمكنها إضافة طالبات ومعلمات ومشرفات فقط" });
      return;
    }
  } else if (req.userRole !== "leader") {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const parsed = CreateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { password, ...rest } = parsed.data;
  const lowerEmail = rest.email.toLowerCase();

  // If an account with this email already exists, reuse its passwordHash so
  // all roles for the same person share one password (multi-role login works).
  const existingAccounts = await db.select().from(usersTable).where(eq(usersTable.email, lowerEmail));
  const passwordHash = existingAccounts.length > 0
    ? existingAccounts[0].passwordHash
    : hashPassword(password);

  const [user] = await db.insert(usersTable).values({
    ...rest,
    email: lowerEmail,
    passwordHash,
  }).returning();

  if (rest.role === "student") {
    await db.insert(studentsTable).values({
      fullName: rest.name,
      circleId: rest.circleId ?? null,
      phone: rest.phone ?? null,
      country: rest.country ?? null,
      isArchived: false,
    });
  }

  // ربط المعلمة/المشرفة بالحلقة تلقائياً
  if (rest.circleId) {
    if (rest.role === "teacher") {
      await db.update(circlesTable).set({ teacherId: user.id }).where(eq(circlesTable.id, rest.circleId));
    } else if (rest.role === "supervisor") {
      await db.update(circlesTable).set({ supervisorId: user.id }).where(eq(circlesTable.id, rest.circleId));
    }
  }

  const { passwordHash: _ph, ...safeUser } = user;
  res.status(201).json(safeUser);
});

router.get("/users/:id", authenticate, async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  if (req.userRole !== "leader" && req.userId !== id) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  const { passwordHash: _ph, ...safeUser } = user;
  res.json(safeUser);
});

router.patch("/users/:id", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const [user] = await db.update(usersTable).set(parsed.data).where(eq(usersTable.id, id)).returning();
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.role === "student" && user.name) {
    const existing = await db.select().from(studentsTable)
      .where(eq(studentsTable.fullName, user.name));
    const circleId = user.circleId ?? null;
    if (existing.length === 0) {
      await db.insert(studentsTable).values({
        fullName: user.name,
        circleId,
        phone: user.phone ?? null,
        country: user.country ?? null,
        isArchived: false,
      });
    } else if (circleId !== null) {
      await db.update(studentsTable)
        .set({ circleId })
        .where(eq(studentsTable.fullName, user.name));
    }
  }

  // تحديث teacher_id / supervisor_id في جدول الحلقة عند تعديل المعلمة أو المشرفة
  if (user.circleId) {
    if (user.role === "teacher") {
      await db.update(circlesTable).set({ teacherId: user.id }).where(eq(circlesTable.id, user.circleId));
    } else if (user.role === "supervisor") {
      await db.update(circlesTable).set({ supervisorId: user.id }).where(eq(circlesTable.id, user.circleId));
    }
  }

  const { passwordHash: _ph, ...safeUser } = user;
  res.json(safeUser);
});

router.delete("/users/:id", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  await db.update(usersTable).set({ isArchived: true }).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

// الحذف النهائي — متاح للقائدة فقط، يحذف السجل نهائيًا من قاعدة البيانات
router.delete("/users/:id/permanent", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
  if (user?.role === "student") {
    const students = await db.select().from(studentsTable)
      .where(eq(studentsTable.fullName, user.name));
    for (const student of students) {
      const sid = student.id;
      await db.delete(recordsTable).where(eq(recordsTable.studentId, sid));
      await db.delete(studentGoalsTable).where(eq(studentGoalsTable.studentId, sid));
      await db.delete(studentNotesTable).where(eq(studentNotesTable.studentId, sid));
      await db.delete(studentTransfersTable).where(eq(studentTransfersTable.studentId, sid));
      await db.delete(examRecordsTable).where(eq(examRecordsTable.studentId, sid));
      await db.delete(studentsTable).where(eq(studentsTable.id, sid));
    }
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

router.patch("/users/:id/set-role", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy", "track_supervisor"];
  if (!allowed.includes(req.userRole ?? "")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const { role, circleId, track } = req.body as { role: string; circleId?: number; track?: string };

  const validRoles = ["student", "teacher", "supervisor", "track_supervisor", "data_entry"];
  if (!role || !validRoles.includes(role)) {
    res.status(400).json({ error: "دور غير صالح" }); return;
  }
  if (req.userRole === "track_supervisor" && !["teacher", "supervisor"].includes(role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const updateData: Record<string, unknown> = { role };
  if (circleId !== undefined) updateData.circleId = circleId;
  if (track !== undefined) updateData.track = track;

  const [user] = await db.update(usersTable).set(updateData).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }

  if (circleId) {
    if (role === "teacher") {
      await db.update(circlesTable).set({ teacherId: id }).where(eq(circlesTable.id, circleId));
    } else if (role === "supervisor") {
      await db.update(circlesTable).set({ supervisorId: id }).where(eq(circlesTable.id, circleId));
    }
  }

  const { passwordHash: _ph, ...safeUser } = user;
  res.json(safeUser);
});

router.patch("/users/:id/reset-password", authenticate, async (req, res): Promise<void> => {
  const allowedRoles = ["leader", "deputy", "track_supervisor"];
  if (!allowedRoles.includes(req.userRole ?? "")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = ResetUserPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  // track_supervisor can only reset passwords for students
  if (req.userRole === "track_supervisor") {
    const [target] = await db.select({ role: usersTable.role }).from(usersTable).where(eq(usersTable.id, id));
    if (!target || target.role !== "student") {
      res.status(403).json({ error: "مسؤولة المسار تقدر فقط تعيد كلمة مرور الطالبات" }); return;
    }
  }
  await db.update(usersTable).set({ passwordHash: hashPassword(parsed.data.newPassword) }).where(eq(usersTable.id, id));
  res.json({ success: true });
});

router.patch("/users/:id/disable", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [user] = await db.update(usersTable).set({ isArchived: true }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _ph, ...safeUser } = user;
  res.json(safeUser);
});

router.patch("/users/:id/enable", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const [user] = await db.update(usersTable).set({ isArchived: false }).where(eq(usersTable.id, id)).returning();
  if (!user) { res.status(404).json({ error: "User not found" }); return; }
  const { passwordHash: _ph, ...safeUser } = user;
  res.json(safeUser);
});

export default router;
