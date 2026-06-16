import { Router, type IRouter } from "express";
import { db, usersTable, studentsTable, recordsTable, reviewPlansTable, studentGoalsTable, studentNotesTable, studentTransfersTable, planNotificationsTable, examRecordsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "../lib/auth";
import { authenticate, requireRole } from "../middlewares/authenticate";
import { CreateUserBody, UpdateUserBody, ResetUserPasswordBody } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/users", authenticate, async (req, res): Promise<void> => {
  // مسؤولة المسار ترى الطالبات في مسارها فقط
  if (req.userRole === "track_supervisor") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const myTrack = me?.track ?? null;
    const all = await db.select().from(usersTable);
    const filtered = all.filter(u => u.role === "student" && u.track === myTrack);
    res.json(filtered.map(({ passwordHash: _ph, ...u }) => u));
    return;
  }
  if (req.userRole !== "leader") {
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
      await db.delete(reviewPlansTable).where(eq(reviewPlansTable.studentId, sid));
      await db.delete(studentGoalsTable).where(eq(studentGoalsTable.studentId, sid));
      await db.delete(studentNotesTable).where(eq(studentNotesTable.studentId, sid));
      await db.delete(studentTransfersTable).where(eq(studentTransfersTable.studentId, sid));
      await db.delete(planNotificationsTable).where(eq(planNotificationsTable.studentId, sid));
      await db.delete(examRecordsTable).where(eq(examRecordsTable.studentId, sid));
      await db.delete(studentsTable).where(eq(studentsTable.id, sid));
    }
  }
  await db.delete(usersTable).where(eq(usersTable.id, id));
  res.sendStatus(204);
});

router.patch("/users/:id/reset-password", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const raw = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  const id = parseInt(raw, 10);
  const parsed = ResetUserPasswordBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
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
