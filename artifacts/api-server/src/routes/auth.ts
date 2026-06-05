import { Router, type IRouter } from "express";
import { db, usersTable, studentsTable, circlesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword, verifyPassword, generateToken } from "../lib/auth";
import { authenticate } from "../middlewares/authenticate";
import { LoginBody, LoginSelectAccountBody } from "@workspace/api-zod";
import { appendVolunteerToSheet } from "../lib/sheets";
import { sendPasswordResetEmail } from "../lib/email";
import { randomBytes } from "crypto";

const router: IRouter = Router();

router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { email, password } = parsed.data;
  const users = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));
  const activeUsers = users.filter(u => !u.isArchived);

  if (activeUsers.length === 0) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  const verified = activeUsers.filter(u => verifyPassword(password, u.passwordHash));
  if (verified.length === 0) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }

  if (verified.length === 1) {
    const user = verified[0];
    if (user.registrationStatus === "pending") {
      res.status(403).json({ error: "طلبك قيد المراجعة، سيتم إشعارك عند القبول" });
      return;
    }
    if (user.registrationStatus === "rejected") {
      res.status(403).json({ error: "تم رفض طلب التسجيل" });
      return;
    }
    const token = generateToken(user.id, user.role);
    const { passwordHash: _ph, ...safeUser } = user;
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    res.json({ user: safeUser, token });
    return;
  }

  const approvedVerified = verified.filter(
    u => u.registrationStatus !== "pending" && u.registrationStatus !== "rejected",
  );
  if (approvedVerified.length === 0) {
    res.status(403).json({ error: "طلبك قيد المراجعة، سيتم إشعارك عند القبول" });
    return;
  }
  if (approvedVerified.length === 1) {
    const user = approvedVerified[0];
    const token = generateToken(user.id, user.role);
    const { passwordHash: _ph, ...safeUser } = user;
    await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
    res.json({ user: safeUser, token });
    return;
  }
  const _unused_verified = verified;

  const roleLabels: Record<string, string> = {
    leader: "القائدة",
    deputy: "النائبة",
    data_entry: "مُدخلة بيانات",
    teacher: "معلمة",
    supervisor: "مشرفة",
    student: "طالبة",
    track_supervisor: "مسؤولة مسار",
  };

  res.json({
    requiresSelection: true,
    accounts: approvedVerified.map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      roleLabel: roleLabels[u.role] ?? u.role,
      track: u.track ?? null,
      circleId: u.circleId ?? null,
    })),
  });
});

router.post("/auth/login/select", async (req, res): Promise<void> => {
  const parsed = LoginSelectAccountBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }
  const { email, password, accountId } = parsed.data;
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, accountId));
  if (!user || user.isArchived || user.email !== email.toLowerCase()) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }
  if (!verifyPassword(password, user.passwordHash)) {
    res.status(401).json({ error: "بيانات الدخول غير صحيحة" });
    return;
  }
  const token = generateToken(user.id, user.role);
  const { passwordHash: _ph, ...safeUser } = user;
  await db.update(usersTable).set({ lastLoginAt: new Date() }).where(eq(usersTable.id, user.id));
  res.json({ user: safeUser, token });
});

const ROLE_LABELS: Record<string, string> = {
  leader: "القائدة",
  data_entry: "مُدخلة بيانات",
  teacher: "معلمة",
  supervisor: "مشرفة",
  student: "طالبة",
  track_supervisor: "مسؤولة مسار",
  exam_supervisor: "مسؤولة الاختبارات",
  volunteer: "متطوعة",
};

router.get("/auth/my-accounts", authenticate, async (req, res): Promise<void> => {
  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!currentUser) { res.status(404).json({ error: "Not found" }); return; }

  const all = await db.select().from(usersTable).where(eq(usersTable.email, currentUser.email));
  const active = all.filter(u => !u.isArchived);

  res.json(active.map(u => ({
    id: u.id,
    name: u.name,
    role: u.role,
    roleLabel: ROLE_LABELS[u.role] ?? u.role,
    track: u.track ?? null,
    circleId: u.circleId ?? null,
    isCurrent: u.id === req.userId,
  })));
});

router.post("/auth/switch-account", authenticate, async (req, res): Promise<void> => {
  const { targetUserId } = req.body as { targetUserId: number };
  const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  const [targetUser] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));

  if (!currentUser || !targetUser) { res.status(404).json({ error: "المستخدم غير موجود" }); return; }
  if (targetUser.email.toLowerCase() !== currentUser.email.toLowerCase()) {
    res.status(403).json({ error: "غير مسموح" }); return;
  }
  if (targetUser.isArchived) { res.status(403).json({ error: "الحساب موقوف" }); return; }

  const token = generateToken(targetUser.id, targetUser.role);
  const { passwordHash: _ph, ...safeUser } = targetUser;
  res.json({ user: safeUser, token });
});

router.post("/auth/staff-register", async (req, res): Promise<void> => {
  const { name, phone, email, password, role } = req.body ?? {};
  if (!name || typeof name !== "string" || name.trim().length < 2) {
    res.status(400).json({ error: "الاسم مطلوب" });
    return;
  }
  if (!phone || typeof phone !== "string" || phone.trim().length < 7) {
    res.status(400).json({ error: "رقم الجوال مطلوب" });
    return;
  }
  if (!email || typeof email !== "string" || !email.includes("@")) {
    res.status(400).json({ error: "البريد الإلكتروني غير صحيح" });
    return;
  }
  if (!password || typeof password !== "string" || password.length < 6) {
    res.status(400).json({ error: "كلمة المرور قصيرة جدًا" });
    return;
  }
  const targetRole = role ?? "data_entry";
  // يُسمح بتكرار نفس البريد مع نفس الدور (مثلاً: أم لها طفلتان في نفس الحلقة)

  const passwordHash = hashPassword(password);
  const { country, track, circleId, extraData } = req.body ?? {};
  const [user] = await db.insert(usersTable).values({
    name,
    phone,
    country: country ?? null,
    email: email.toLowerCase(),
    passwordHash,
    role: targetRole,
    track: track ?? null,
    circleId: circleId ? parseInt(circleId) : null,
    isArchived: false,
    registrationStatus: "approved",
    extraData: extraData ? JSON.stringify(extraData) : null,
  }).returning();
  const { passwordHash: _ph, ...safeUser } = user;

  // Get circle name for Google Sheets
  const parsedCircleId = circleId ? parseInt(circleId) : null;
  const circleName = parsedCircleId
    ? (await db.select({ name: circlesTable.name }).from(circlesTable).where(eq(circlesTable.id, parsedCircleId)))[0]?.name
    : undefined;

  // Append to Google Sheets (non-blocking)
  appendVolunteerToSheet({
    fullName: name,
    email: email.toLowerCase(),
    role: targetRole,
    phone: phone ?? null,
    country: country ?? null,
    track: track ?? null,
    circleName: circleName ?? null,
  }).catch(() => {});

  res.status(201).json(safeUser);
});

router.post("/auth/forgot-password", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !email.includes("@")) {
    res.status(400).json({ error: "البريد الإلكتروني غير صحيح" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email.toLowerCase()));

  if (!user || user.isArchived) {
    res.status(404).json({ error: "هذا البريد الإلكتروني غير مسجل في المنصة" });
    return;
  }

  const token = randomBytes(32).toString("hex");
  const expiry = new Date(Date.now() + 60 * 60 * 1000);

  await db.update(usersTable)
    .set({ passwordResetToken: token, passwordResetTokenExpiry: expiry })
    .where(eq(usersTable.id, user.id));

  const appUrl = process.env.APP_URL ?? `https://${req.get("host")}`;
  const resetUrl = `${appUrl}/reset-password?token=${token}`;

  try {
    await sendPasswordResetEmail(email.toLowerCase(), resetUrl);
  } catch {
    res.status(500).json({ error: "تعذّر إرسال البريد الإلكتروني — تأكدي من صحة عنوان بريدك" });
    return;
  }

  res.json({ success: true });
});

router.post("/auth/reset-password", async (req, res): Promise<void> => {
  const { token, password } = req.body as { token?: string; password?: string };
  if (!token || !password) {
    res.status(400).json({ error: "بيانات ناقصة" }); return;
  }
  if (password.length < 6) {
    res.status(400).json({ error: "كلمة المرور قصيرة جدًا (٦ أحرف على الأقل)" }); return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.passwordResetToken, token));

  if (!user) {
    res.status(400).json({ error: "رابط إعادة التعيين غير صحيح أو انتهت صلاحيته" }); return;
  }

  if (!user.passwordResetTokenExpiry || user.passwordResetTokenExpiry < new Date()) {
    res.status(400).json({ error: "انتهت صلاحية الرابط — اطلبي رابطًا جديدًا" }); return;
  }

  await db.update(usersTable)
    .set({
      passwordHash: hashPassword(password),
      passwordResetToken: null,
      passwordResetTokenExpiry: null,
    })
    .where(eq(usersTable.id, user.id));

  res.json({ success: true });
});

router.post("/auth/logout", (_req, res): void => {
  res.json({ success: true });
});

router.get("/auth/me", authenticate, async (req, res): Promise<void> => {
  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
  if (!user) {
    res.status(401).json({ error: "Not found" });
    return;
  }
  const { passwordHash: _ph, ...safeUser } = user;

  let studentId: number | null = null;
  if (user.role === "student") {
    const conditions: Parameters<typeof and>[0][] = [eq(studentsTable.fullName, user.name)];
    if (user.circleId) conditions.push(eq(studentsTable.circleId, user.circleId));
    const [student] = await db
      .select({ id: studentsTable.id })
      .from(studentsTable)
      .where(and(...conditions))
      .limit(1);
    studentId = student?.id ?? null;
  }

  res.json({ ...safeUser, studentId });
});

export default router;
