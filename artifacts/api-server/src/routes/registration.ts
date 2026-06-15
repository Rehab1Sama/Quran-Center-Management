import { Router, type IRouter } from "express";
import { db, registrationSettingsTable, usersTable, studentsTable, circlesTable, studentEnrollmentsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/authenticate";
import { hashPassword } from "../lib/auth";
import { OpenRegistrationBody, SubmitRegistrationBody } from "@workspace/api-zod";
import { appendStudentToSheet } from "../lib/sheets";
import { sendEmailOTP } from "../lib/email";


const router: IRouter = Router();

const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com","guerrillamail.com","10minutemail.com","throwam.com","yopmail.com",
  "trashmail.com","temp-mail.org","fakeinbox.com","sharklasers.com","guerrillamail.info",
  "guerrillamail.biz","guerrillamail.de","guerrillamail.net","guerrillamail.org",
  "spam4.me","tempr.email","discard.email","maildrop.cc","mailnull.com",
  "spamgourmet.com","trashmail.at","trashmail.io","trashmail.me","trashmail.net",
  "trashmail.xyz","dispostable.com","mailnesia.com","getairmail.com","mytemp.email",
  "tempmail.com","tempmail.net","tempmailaddress.com","throwaway.email","spamfree24.org",
  "getnada.com","inalid.com","tmail.com","mailsac.com","mailnull.com","throwam.com",
]);

const otpStore = new Map<string, { otp: string; expiresAt: number; attempts: number }>();
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of otpStore) { if (v.expiresAt < now) otpStore.delete(k); }
}, 5 * 60 * 1000);

router.post("/registration/send-email-otp", async (req, res): Promise<void> => {
  const { email } = req.body as { email?: string };
  if (!email || !email.includes("@") || !email.includes(".")) {
    res.status(400).json({ error: "بريد إلكتروني غير صحيح" }); return;
  }
  const domain = email.split("@")[1]?.toLowerCase() ?? "";
  if (DISPOSABLE_DOMAINS.has(domain)) {
    res.status(400).json({ error: "البريد المؤقت غير مقبول — استخدمي بريدًا حقيقيًا" }); return;
  }
  const key = email.toLowerCase();
  const existing = otpStore.get(key);
  if (existing && existing.expiresAt > Date.now() && existing.attempts >= 5) {
    res.status(429).json({ error: "تم إرسال الرمز كثيرًا، انتظري قليلاً ثم أعيدي المحاولة" }); return;
  }
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(key, { otp, expiresAt: Date.now() + 10 * 60 * 1000, attempts: (existing?.attempts ?? 0) + 1 });
  try {
    await sendEmailOTP(email, otp);
    res.json({ success: true });
  } catch {
    if (process.env.NODE_ENV !== "production") {
      res.json({ success: true, devOtp: otp });
    } else {
      res.status(500).json({ error: "فشل إرسال البريد — تأكد من ضبط EMAIL_USER و EMAIL_PASS" });
    }
  }
});

router.post("/registration/verify-email-otp", async (req, res): Promise<void> => {
  const { email, otp } = req.body as { email?: string; otp?: string };
  if (!email || !otp) { res.status(400).json({ error: "بيانات غير مكتملة" }); return; }
  const key = email.toLowerCase();
  const stored = otpStore.get(key);
  if (!stored) { res.status(400).json({ error: "لم يتم إرسال رمز لهذا البريد أو انتهت صلاحيته" }); return; }
  if (stored.expiresAt < Date.now()) {
    otpStore.delete(key);
    res.status(400).json({ error: "انتهت صلاحية الرمز — اطلبي رمزًا جديدًا" }); return;
  }
  if (stored.otp !== otp.trim()) { res.status(400).json({ error: "رمز التحقق غير صحيح" }); return; }
  otpStore.delete(key);
  res.json({ success: true });
});

async function getSettings() {
  try {
    const [settings] = await db.select().from(registrationSettingsTable);
    return settings ?? {
      isOpen: false,
      staffRegistrationOpen: true,
      existingStudentRegOpen: false,
      autoApproveStudents: false,
      deadline: null,
      customQuestions: null,
      staffCustomQuestions: null,
    };
  } catch {
    return {
      isOpen: false,
      staffRegistrationOpen: false,
      existingStudentRegOpen: false,
      autoApproveStudents: false,
      deadline: null,
      customQuestions: null,
      staffCustomQuestions: null,
    };
  }
}

async function upsertSettings(values: Record<string, unknown>) {
  const existing = await db.select().from(registrationSettingsTable);
  if (existing.length === 0) {
    await db.insert(registrationSettingsTable).values(values as any);
  } else {
    await db.update(registrationSettingsTable).set(values as any);
  }
}

router.get("/registration/status", async (_req, res): Promise<void> => {
  const settings = await getSettings();
  const now = new Date();
  const startDate = (settings as any).startDate ?? null;
  const deadline = settings.deadline ?? null;
  const effectivelyOpen = settings.isOpen
    && (!startDate || now >= new Date(startDate))
    && (!deadline || now <= new Date(deadline));

  if (settings.isOpen && deadline && now > new Date(deadline)) {
    await upsertSettings({ isOpen: false });
  }

  res.json({
    isOpen: effectivelyOpen,
    rawIsOpen: settings.isOpen,
    staffRegistrationOpen: settings.staffRegistrationOpen,
    existingStudentRegOpen: settings.existingStudentRegOpen,
    autoApproveStudents: (settings as any).autoApproveStudents ?? false,
    startDate,
    deadline,
    customQuestions: settings.customQuestions,
    staffCustomQuestions: (settings as any).staffCustomQuestions ?? null,
  });
});

router.post("/registration/open", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const parsed = OpenRegistrationBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const startDate = typeof (req.body as any).startDate === "string" ? (req.body as any).startDate : null;
  await upsertSettings({ isOpen: true, startDate, ...parsed.data });
  res.json({ success: true });
});

router.post("/registration/close", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  await upsertSettings({ isOpen: false });
  res.json({ success: true });
});

router.post("/registration/staff-open", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  await upsertSettings({ staffRegistrationOpen: true });
  res.json({ success: true });
});

router.post("/registration/staff-close", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  await upsertSettings({ staffRegistrationOpen: false });
  res.json({ success: true });
});

router.post("/registration/existing-open", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  await upsertSettings({ existingStudentRegOpen: true });
  res.json({ success: true });
});

router.post("/registration/existing-close", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  await upsertSettings({ existingStudentRegOpen: false });
  res.json({ success: true });
});

router.post("/registration/auto-approve-on", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  await upsertSettings({ autoApproveStudents: true });
  res.json({ success: true });
});

router.post("/registration/auto-approve-off", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  await upsertSettings({ autoApproveStudents: false });
  res.json({ success: true });
});

// Public endpoint — all active circles (for existing-student form, no capacity filter)
router.get("/registration/circles-public", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ id: circlesTable.id, name: circlesTable.name, track: circlesTable.track })
    .from(circlesTable)
    .where(eq(circlesTable.isArchived, false));
  res.json(rows);
});

// Public endpoint — circles with available capacity for NEW students
router.get("/registration/circles-new-students", async (_req, res): Promise<void> => {
  const circles = await db
    .select({
      id: circlesTable.id,
      name: circlesTable.name,
      track: circlesTable.track,
      meetingTime: circlesTable.meetingTime,
      newStudentCapacity: circlesTable.newStudentCapacity,
    })
    .from(circlesTable)
    .where(eq(circlesTable.isArchived, false));

  const counts = await db
    .select({
      circleId: studentsTable.circleId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(studentsTable)
    .groupBy(studentsTable.circleId);

  const countMap = new Map(counts.map(r => [r.circleId, r.count]));

  const available = circles.filter(c => {
    if (c.newStudentCapacity == null) return true;
    const registered = countMap.get(c.id) ?? 0;
    return registered < c.newStudentCapacity;
  });

  const result = available.map(c => ({
    id: c.id,
    name: c.name,
    track: c.track,
    meetingTime: c.meetingTime,
    newStudentCapacity: c.newStudentCapacity,
    registeredCount: countMap.get(c.id) ?? 0,
    spotsLeft: c.newStudentCapacity != null
      ? c.newStudentCapacity - (countMap.get(c.id) ?? 0)
      : null,
  }));

  res.json(result);
});

router.post("/registration/save-questions", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const { formType, questions } = req.body as { formType?: string; questions?: unknown[] };
  if (!Array.isArray(questions)) {
    res.status(400).json({ error: "questions must be an array" });
    return;
  }
  if (formType === "staff") {
    await upsertSettings({ staffCustomQuestions: JSON.stringify(questions) });
  } else {
    await upsertSettings({ customQuestions: JSON.stringify(questions) });
  }
  res.json({ success: true });
});

router.get("/registration/activate", async (_req, res): Promise<void> => {
  res.json({ success: true, message: "التفعيل التلقائي مُفعَّل — لا حاجة لرمز تفعيل" });
});

router.post("/registration/submit", async (req, res): Promise<void> => {
  const settings = await getSettings();
  if (!settings.isOpen) {
    res.status(400).json({ error: "التسجيل مغلق حاليًا" });
    return;
  }

  const parsed = SubmitRegistrationBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }

  const { email, password, fullName, phone, country, ageRange, educationLevel, memorizeFrom, track, circleId, role } = parsed.data;
  const extraData = (req.body as any).extraData ?? null;
  const isNewcomer = (req.body as any).isNewcomer === true;

  // منع تكرار التسجيل بنفس البريد الإلكتروني عبر نموذج التسجيل الذاتي
  const existingUser = await db
    .select({ id: usersTable.id })
    .from(usersTable)
    .where(eq(usersTable.email, email.toLowerCase()));
  if (existingUser.length > 0) {
    res.status(409).json({ error: "هذا البريد الإلكتروني مسجّل مسبقًا، إذا نسيتِ كلمة المرور تواصلي مع القائدة" });
    return;
  }

  await db.insert(usersTable).values({
    email: email.toLowerCase(),
    name: fullName,
    passwordHash: hashPassword(password),
    role: role ?? "student",
    track: track ?? null,
    circleId: circleId ?? null,
    phone: phone ?? null,
    country: country ?? null,
    ageRange: ageRange ?? null,
    educationLevel: educationLevel ?? null,
    registrationStatus: "approved",
    emailVerificationToken: null,
  }).returning();

  if (!role || role === "student") {
    let targetCircleId = circleId;
    if (!targetCircleId) {
      const [regCircle] = await db.select().from(circlesTable).where(eq(circlesTable.trackType, "registration"));
      targetCircleId = regCircle?.id;
    }

    const mergedExtra = extraData ? { ...extraData } : {};
    if (isNewcomer) mergedExtra.__isNewcomer = true;

    const [newStudent] = await db.insert(studentsTable).values({
      fullName,
      circleId: targetCircleId ?? null,
      phone: phone ?? null,
      country: country ?? null,
      ageRange: ageRange ?? null,
      educationLevel: educationLevel ?? null,
      memorizeFrom: memorizeFrom ?? null,
      extraData: Object.keys(mergedExtra).length > 0 ? JSON.stringify(mergedExtra) : null,
      isNewcomer,
    }).returning();

    if (newStudent && targetCircleId) {
      await db.insert(studentEnrollmentsTable)
        .values({ studentId: newStudent.id, circleId: targetCircleId, isArchived: false })
        .onConflictDoNothing();
    }

    const circleName = targetCircleId
      ? (await db.select({ name: circlesTable.name }).from(circlesTable).where(eq(circlesTable.id, targetCircleId)))[0]?.name
      : undefined;

    appendStudentToSheet({
      fullName,
      email: email.toLowerCase(),
      phone: phone ?? null,
      country: country ?? null,
      ageRange: ageRange ?? null,
      educationLevel: educationLevel ?? null,
      track: track ?? null,
      circleName: circleName ?? null,
      memorizeFrom: memorizeFrom ?? null,
    }).catch(() => {});
  }

  res.status(201).json({ success: true, autoApproved: true, emailSent: false });
});

export default router;
