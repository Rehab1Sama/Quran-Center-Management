import { Router, type IRouter } from "express";
import { db, registrationSettingsTable, usersTable, studentsTable, circlesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/authenticate";
import { hashPassword } from "../lib/auth";
import { OpenRegistrationBody, SubmitRegistrationBody } from "@workspace/api-zod";
import { appendStudentToSheet } from "../lib/sheets";

const router: IRouter = Router();

async function getSettings() {
  const [settings] = await db.select().from(registrationSettingsTable);
  return settings ?? { isOpen: false, staffRegistrationOpen: true, existingStudentRegOpen: false, deadline: null, customQuestions: null, staffCustomQuestions: null };
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

// Public endpoint — all active circles (for existing-student form, no capacity filter)
router.get("/registration/circles-public", async (_req, res): Promise<void> => {
  const rows = await db
    .select({ id: circlesTable.id, name: circlesTable.name, track: circlesTable.track })
    .from(circlesTable)
    .where(eq(circlesTable.isArchived, false));
  res.json(rows);
});

// Public endpoint — circles with available capacity for NEW students
// Hides circles that are full (newStudentCapacity reached)
router.get("/registration/circles-new-students", async (_req, res): Promise<void> => {
  // Get all active circles with their settings
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

  // Count students per circle from studentsTable
  const counts = await db
    .select({
      circleId: studentsTable.circleId,
      count: sql<number>`cast(count(*) as int)`,
    })
    .from(studentsTable)
    .groupBy(studentsTable.circleId);

  const countMap = new Map(counts.map(r => [r.circleId, r.count]));

  // Filter: hide circles where newStudentCapacity is set AND count >= capacity
  const available = circles.filter(c => {
    if (c.newStudentCapacity == null) return true; // no limit
    const registered = countMap.get(c.id) ?? 0;
    return registered < c.newStudentCapacity;
  });

  // Include remaining spots in the response
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
  // Accept optional extra answers for custom questions
  const extraData = (req.body as any).extraData ?? null;

  const [user] = await db.insert(usersTable).values({
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
    registrationStatus: "pending",
  }).returning();

  if (!role || role === "student") {
    let targetCircleId = circleId;
    if (!targetCircleId) {
      const [regCircle] = await db.select().from(circlesTable).where(eq(circlesTable.trackType, "registration"));
      targetCircleId = regCircle?.id;
    }
    await db.insert(studentsTable).values({
      fullName,
      circleId: targetCircleId ?? null,
      phone: phone ?? null,
      country: country ?? null,
      ageRange: ageRange ?? null,
      educationLevel: educationLevel ?? null,
      memorizeFrom: memorizeFrom ?? null,
      extraData: extraData ? JSON.stringify(extraData) : null,
    });

    // Get circle name for Google Sheets
    const circleName = targetCircleId
      ? (await db.select({ name: circlesTable.name }).from(circlesTable).where(eq(circlesTable.id, targetCircleId)))[0]?.name
      : undefined;

    // Append to Google Sheets (non-blocking, errors are logged not thrown)
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

  res.status(201).json({ success: true });
});

export default router;
