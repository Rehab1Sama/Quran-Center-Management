import { Router, type IRouter } from "express";
import {
  db,
  reviewPlansTable,
  reviewPlanDaysTable,
  studentsTable,
  circlesTable,
  usersTable,
  globalSettingsTable,
  recordsTable,
} from "@workspace/db";
import { eq, and, desc, inArray, isNotNull, gte, lte } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

const GIRLS_TRACK_TYPES = ["girls"];
const FIXATION_TRACK_TYPES = ["fixation"];

function getPlanTypeForTrack(trackType: string): "girls_review" | "fixation" | null {
  if (GIRLS_TRACK_TYPES.includes(trackType)) return "girls_review";
  if (FIXATION_TRACK_TYPES.includes(trackType)) return "fixation";
  return null;
}

function getTodayMecca(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

// Returns all non-Friday dates from startDate up to totalDays count
function getCycleDates(startDate: string, totalDays: number): string[] {
  const dates: string[] = [];
  const cur = new Date(startDate + "T12:00:00Z");
  if (cur.getUTCDay() !== 5) dates.push(cur.toISOString().slice(0, 10));
  while (dates.length < totalDays) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getUTCDay() !== 5) dates.push(cur.toISOString().slice(0, 10));
  }
  return dates;
}

function getPlanEndDate(startDate: string, planType: "girls_review" | "fixation"): string {
  const totalDays = planType === "fixation" ? 24 : 21;
  if (planType === "girls_review") {
    const dates = getCycleDates(startDate, totalDays);
    return dates[dates.length - 1] ?? startDate;
  }
  // fixation: Sun–Wed only
  const dates: string[] = [];
  const cur = new Date(startDate + "T12:00:00Z");
  if (cur.getUTCDay() <= 3) dates.push(cur.toISOString().slice(0, 10));
  while (dates.length < totalDays) {
    cur.setDate(cur.getDate() + 1);
    if (cur.getUTCDay() <= 3) dates.push(cur.toISOString().slice(0, 10));
  }
  return dates[dates.length - 1] ?? startDate;
}

function distribute(total: number, parts: number): number[] {
  const perDay = total / parts;
  const arr: number[] = [];
  let accumulated = 0;
  for (let i = 0; i < parts; i++) {
    accumulated += perDay;
    const val = Math.round(accumulated * 2) / 2 - Math.round((accumulated - perDay) * 2) / 2;
    arr.push(Math.round(val * 2) / 2);
  }
  return arr;
}

async function getGlobalCycleStartDate(): Promise<string | null> {
  const [row] = await db.select().from(globalSettingsTable)
    .where(eq(globalSettingsTable.key, "girls_cycle_start_date"));
  return row?.value ?? null;
}

// Auto-renew a completed girls plan for the new cycle.
// newCycleStart: the start date of the new cycle (from global settings).
async function autoRenewGirlsPlan(
  oldPlan: typeof reviewPlansTable.$inferSelect,
  studentId: number,
  circleId: number,
  newCycleStart: string
): Promise<(typeof reviewPlansTable.$inferSelect & { days: typeof reviewPlanDaysTable.$inferSelect[] }) | null> {
  // Guard: check if new plan for this cycle already exists
  const [existing] = await db.select({ id: reviewPlansTable.id })
    .from(reviewPlansTable)
    .where(and(
      eq(reviewPlansTable.studentId, studentId),
      eq(reviewPlansTable.circleId, circleId),
      eq(reviewPlansTable.startDate, newCycleStart),
      eq(reviewPlansTable.status, "active")
    ))
    .limit(1);
  if (existing) return null;

  // Collect new memorization during old plan period
  const oldEndDate = getPlanEndDate(oldPlan.startDate, "girls_review");
  const memRows = await db.select({ memorizePages: recordsTable.memorizePages })
    .from(recordsTable)
    .where(and(
      eq(recordsTable.studentId, studentId),
      gte(recordsTable.date, oldPlan.startDate),
      lte(recordsTable.date, oldEndDate),
      isNotNull(recordsTable.memorizePages)
    ));

  const newMemPages = memRows.reduce((s, r) => s + (r.memorizePages ?? 0), 0);

  // Compute new quota
  let newQuotaJuz = oldPlan.quotaJuz;
  let newTotalPages = oldPlan.totalPages;

  if (oldPlan.quotaType === "juz" && oldPlan.quotaJuz) {
    const extraJuz = Math.floor(newMemPages / 20);
    newQuotaJuz = Math.min(30, oldPlan.quotaJuz + extraJuz);
    newTotalPages = newQuotaJuz * 20;
  } else if (newTotalPages) {
    newTotalPages = newTotalPages + newMemPages;
  }

  const total = newTotalPages ?? (newQuotaJuz ?? 0) * 20;

  // Archive old plan
  await db.update(reviewPlansTable)
    .set({ status: "cancelled" })
    .where(eq(reviewPlansTable.id, oldPlan.id));

  // Create new plan
  const [newPlan] = await db.insert(reviewPlansTable).values({
    studentId,
    circleId,
    planType: "girls_review",
    status: "active",
    quotaType: oldPlan.quotaType,
    quotaJuz: newQuotaJuz ?? null,
    quotaSurahStart: oldPlan.quotaSurahStart ?? null,
    quotaAyahStart: oldPlan.quotaAyahStart ?? null,
    quotaSurahEnd: oldPlan.quotaSurahEnd ?? null,
    quotaAyahEnd: oldPlan.quotaAyahEnd ?? null,
    extraRanges: oldPlan.extraRanges ?? null,
    planMode: "auto",
    totalPages: total || null,
    startDate: newCycleStart,
    themeColor: oldPlan.themeColor,
  }).returning();

  let savedDays: typeof reviewPlanDaysTable.$inferSelect[] = [];
  if (total > 0) {
    const dist = distribute(total, 21);
    const inserted = await db.insert(reviewPlanDaysTable).values(
      dist.map((pages, i) => ({ planId: newPlan.id, dayNumber: i + 1, pages }))
    ).returning();
    savedDays = inserted;
  }

  return { ...newPlan, days: savedDays };
}

// ─── GET: student's active review plan ────────────────────────────────────────
router.get("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy", "track_supervisor", "teacher", "supervisor", "student"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const studentId = parseInt(req.params.id as string);
  const circleId = req.query.circleId ? parseInt(req.query.circleId as string) : undefined;

  const where = circleId
    ? and(eq(reviewPlansTable.studentId, studentId), eq(reviewPlansTable.circleId, circleId), eq(reviewPlansTable.status, "active"))
    : and(eq(reviewPlansTable.studentId, studentId), eq(reviewPlansTable.status, "active"));

  const plans = await db.select().from(reviewPlansTable)
    .where(where)
    .orderBy(desc(reviewPlansTable.createdAt))
    .limit(1);

  if (!plans.length) { res.json(null); return; }
  let plan = plans[0]!;

  // Auto-renew girls plans when cycle ends and new global cycle is set
  if (plan.planType === "girls_review" && plan.startDate && circleId) {
    const today = getTodayMecca();
    const endDate = getPlanEndDate(plan.startDate, "girls_review");

    if (today > endDate) {
      const newCycleStart = await getGlobalCycleStartDate();
      if (newCycleStart && newCycleStart > endDate) {
        const renewed = await autoRenewGirlsPlan(plan, studentId, circleId, newCycleStart);
        if (renewed) {
          const { days, ...planData } = renewed;
          res.json({
            ...planData,
            createdAt: planData.createdAt.toISOString(),
            updatedAt: planData.updatedAt?.toISOString(),
            days,
          });
          return;
        }
      }
    }
  }

  const days = await db.select().from(reviewPlanDaysTable)
    .where(eq(reviewPlanDaysTable.planId, plan.id))
    .orderBy(reviewPlanDaysTable.dayNumber);

  // Build cycleInfo for girls plans
  let cycleInfo: {
    cycleStartDate: string; cycleEndDate: string;
    currentDay: number; isCompleted: boolean; isLocked: boolean;
  } | null = null;

  if (plan.planType === "girls_review" && plan.startDate) {
    const today = getTodayMecca();
    const cycleDates = getCycleDates(plan.startDate, 21);
    const cycleEndDate = cycleDates[cycleDates.length - 1] ?? plan.startDate;
    const dayIdx = cycleDates.indexOf(today);
    const currentDay = dayIdx >= 0 ? dayIdx + 1 : today < cycleDates[0]! ? 0 : 22;
    const isCompleted = today > cycleEndDate;
    cycleInfo = {
      cycleStartDate: plan.startDate,
      cycleEndDate,
      currentDay,
      isCompleted,
      isLocked: !isCompleted && today >= plan.startDate,
    };
  }

  res.json({
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt?.toISOString(),
    days,
    cycleInfo,
  });
});

// ─── POST: create / renew plan ─────────────────────────────────────────────────
router.post("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  try {
    const allowed = ["leader", "deputy", "track_supervisor", "teacher", "supervisor", "student"];
    if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

    const studentId = parseInt(req.params.id as string);
    const {
      circleId: rawCircleId,
      quotaType, quotaJuz,
      quotaSurahStart, quotaAyahStart,
      quotaSurahEnd, quotaAyahEnd,
      extraRanges, planMode,
      totalPages, quantity,
      themeColor,
      days = [],
    } = req.body ?? {};

    // Determine circleId
    let circleId: number;
    if (req.userRole === "student") {
      const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
      if (!currentUser) { res.status(403).json({ error: "غير مسموح" }); return; }
      const bodyCircleId = rawCircleId ? parseInt(rawCircleId) : null;
      const searchCircleId = bodyCircleId ?? currentUser.circleId;
      let ownStudentId: number | null = null;
      if (searchCircleId) {
        const [s] = await db.select({ id: studentsTable.id })
          .from(studentsTable)
          .where(and(eq(studentsTable.circleId, searchCircleId), eq(studentsTable.isArchived, false)))
          .limit(1);
        ownStudentId = s?.id ?? null;
      }
      if (!ownStudentId || ownStudentId !== studentId) {
        res.status(403).json({ error: "يمكنك إنشاء خطة لنفسك فقط" }); return;
      }
      circleId = searchCircleId ?? rawCircleId;
    } else {
      circleId = parseInt(rawCircleId);
    }

    if (!circleId) { res.status(400).json({ error: "circleId مطلوب" }); return; }

    const circle = await db.select().from(circlesTable).where(eq(circlesTable.id, circleId)).limit(1);
    if (!circle.length) { res.status(404).json({ error: "الحلقة غير موجودة" }); return; }

    const planType = getPlanTypeForTrack(circle[0]!.trackType);
    if (!planType) { res.status(400).json({ error: "هذا المسار لا يدعم خطط المراجعة" }); return; }

    // ── Lock check: prevent creating/renewing if plan is still active ──────────
    const [activePlan] = await db.select()
      .from(reviewPlansTable)
      .where(and(
        eq(reviewPlansTable.studentId, studentId),
        eq(reviewPlansTable.circleId, circleId),
        eq(reviewPlansTable.status, "active")
      ))
      .limit(1);

    if (activePlan?.startDate) {
      const endDate = getPlanEndDate(activePlan.startDate, activePlan.planType as "girls_review" | "fixation");
      const today = getTodayMecca();
      if (today <= endDate) {
        res.status(403).json({
          error: `لا يمكن إنشاء خطة جديدة قبل انتهاء الخطة الحالية (تنتهي ${endDate})`,
          lockedUntil: endDate,
        });
        return;
      }
    }

    // ── Girls: Newcomer handling (isNewcomer = true) ─────────────────────────
    const [student] = await db.select().from(studentsTable)
      .where(eq(studentsTable.id, studentId)).limit(1);
    const isNewcomer = student?.isNewcomer ?? false;

    if (planType === "girls_review" && isNewcomer) {
      const cycleStartDate = await getGlobalCycleStartDate();
      if (cycleStartDate) {
        const cycleDates = getCycleDates(cycleStartDate, 21);
        const day11Date = cycleDates[10]; // day 11 = index 10

        if (day11Date) {
          // Fetch memorization records from cycle days 1-10
          const day1to10 = cycleDates.slice(0, 10);
          const memRecords = await db.select()
            .from(recordsTable)
            .where(and(
              eq(recordsTable.studentId, studentId),
              eq(recordsTable.circleId, circleId),
              inArray(recordsTable.date, day1to10)
            ))
            .orderBy(recordsTable.date);

          // Map day N → review at day N+10
          const newcomerDays = day1to10.map((date, i) => {
            const rec = memRecords.find(r => r.date === date);
            return {
              dayNumber: i + 11,
              surahStart: rec?.memorizeSurahStart ?? null,
              ayahStart: rec?.memorizeAyahStart ?? null,
              surahEnd: rec?.memorizeSurahEnd ?? null,
              ayahEnd: rec?.memorizeAyahEnd ?? null,
              pages: rec?.memorizePages ?? null,
            };
          });

          const totalNewcomerPages = newcomerDays.reduce((s, d) => s + (d.pages ?? 0), 0);

          // Cancel any previous plan
          await db.update(reviewPlansTable)
            .set({ status: "cancelled" })
            .where(and(
              eq(reviewPlansTable.studentId, studentId),
              eq(reviewPlansTable.circleId, circleId),
              eq(reviewPlansTable.status, "active")
            ));

          const [plan] = await db.insert(reviewPlansTable).values({
            studentId, circleId,
            planType: "girls_review",
            status: "active",
            quotaType: "surah",
            planMode: "manual",
            totalPages: totalNewcomerPages || null,
            startDate: day11Date,
            themeColor: themeColor ?? "#E8D5F5",
          }).returning();

          const savedDays = newcomerDays.length > 0
            ? await db.insert(reviewPlanDaysTable).values(
                newcomerDays.map(d => ({ planId: plan.id!, ...d }))
              ).returning()
            : [];

          res.status(201).json({
            ...plan,
            createdAt: plan.createdAt.toISOString(),
            updatedAt: plan.updatedAt?.toISOString(),
            days: savedDays,
            isNewcomerPlan: true,
          });
          return;
        }
      }
    }

    // ── Girls: use global cycle start date ────────────────────────────────────
    let startDate: string;
    if (planType === "girls_review") {
      const cycleStart = await getGlobalCycleStartDate();
      if (!cycleStart) {
        res.status(400).json({ error: "لم يتم تحديد تاريخ الدور. يرجى تحديده من لوحة الإعدادات." });
        return;
      }
      startDate = cycleStart;
    } else {
      startDate = req.body?.startDate ?? getTodayMecca();
    }

    // Cancel any previous active plan
    await db.update(reviewPlansTable)
      .set({ status: "cancelled" })
      .where(and(
        eq(reviewPlansTable.studentId, studentId),
        eq(reviewPlansTable.circleId, circleId),
        eq(reviewPlansTable.status, "active")
      ));

    const [plan] = await db.insert(reviewPlansTable).values({
      studentId,
      circleId,
      planType,
      status: "active",
      quotaType: quotaType ?? null,
      quotaJuz: quotaJuz ?? null,
      quotaSurahStart: quotaSurahStart ?? null,
      quotaAyahStart: quotaAyahStart ?? null,
      quotaSurahEnd: quotaSurahEnd ?? null,
      quotaAyahEnd: quotaAyahEnd ?? null,
      extraRanges: extraRanges ?? null,
      planMode: planMode ?? null,
      totalPages: totalPages ?? null,
      quantity: quantity ?? null,
      startDate,
      themeColor: themeColor ?? "#E8D5F5",
    }).returning();

    if (days.length > 0) {
      await db.insert(reviewPlanDaysTable).values(
        days.map((d: any) => ({
          planId: plan.id,
          dayNumber: d.dayNumber,
          surahStart: d.surahStart ?? null,
          ayahStart: d.ayahStart ?? null,
          surahEnd: d.surahEnd ?? null,
          ayahEnd: d.ayahEnd ?? null,
          pages: d.pages ?? null,
        }))
      );
    }

    const savedDays = await db.select().from(reviewPlanDaysTable)
      .where(eq(reviewPlanDaysTable.planId, plan.id))
      .orderBy(reviewPlanDaysTable.dayNumber);

    res.status(201).json({
      ...plan,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt?.toISOString(),
      days: savedDays,
    });
  } catch (err: any) {
    console.error("reviewPlan POST error:", err);
    res.status(500).json({ error: err?.message ?? "خطأ في الخادم" });
  }
});

// ─── DELETE: cancel a plan (locked if still active) ───────────────────────────
router.delete("/students/:id/review-plan/:planId", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy", "track_supervisor", "teacher", "supervisor", "student"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const studentId = parseInt(req.params.id as string);
  const planId = parseInt(req.params.planId as string);

  const [planToDelete] = await db.select().from(reviewPlansTable)
    .where(and(eq(reviewPlansTable.id, planId), eq(reviewPlansTable.studentId, studentId)))
    .limit(1);

  if (planToDelete?.planType === "girls_review" && planToDelete.startDate) {
    const endDate = getPlanEndDate(planToDelete.startDate, "girls_review");
    const today = getTodayMecca();
    if (today <= endDate) {
      res.status(403).json({
        error: "لا يمكن حذف خطة المراجعة قبل انتهاء الـ21 يوم",
        lockedUntil: endDate,
      });
      return;
    }
  }

  await db.update(reviewPlansTable)
    .set({ status: "cancelled" })
    .where(and(eq(reviewPlansTable.id, planId), eq(reviewPlansTable.studentId, studentId)));

  res.status(204).send();
});

// ─── GET: all plans in a circle ───────────────────────────────────────────────
router.get("/circles/:circleId/review-plans", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy", "track_supervisor", "teacher", "supervisor"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const circleId = parseInt(req.params.circleId as string);

  const plans = await db.select({
    plan: reviewPlansTable,
    studentName: studentsTable.fullName,
  })
    .from(reviewPlansTable)
    .leftJoin(studentsTable, eq(reviewPlansTable.studentId, studentsTable.id))
    .where(and(eq(reviewPlansTable.circleId, circleId), eq(reviewPlansTable.status, "active")))
    .orderBy(studentsTable.fullName);

  const result = await Promise.all(plans.map(async ({ plan, studentName }) => {
    const days = await db.select().from(reviewPlanDaysTable)
      .where(eq(reviewPlanDaysTable.planId, plan.id))
      .orderBy(reviewPlanDaysTable.dayNumber);
    return {
      ...plan,
      studentName,
      createdAt: plan.createdAt.toISOString(),
      updatedAt: plan.updatedAt?.toISOString(),
      days,
    };
  }));

  res.json(result);
});

// ─── POST: bulk renew all girls plans (leader/deputy only) ────────────────────
router.post("/review-plans/renew-all", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { newCycleStart } = req.body ?? {};
  if (!newCycleStart || !/^\d{4}-\d{2}-\d{2}$/.test(newCycleStart)) {
    res.status(400).json({ error: "newCycleStart مطلوب بصيغة YYYY-MM-DD" }); return;
  }

  // 1. Update global cycle start date
  const existing = await db.select({ key: globalSettingsTable.key })
    .from(globalSettingsTable)
    .where(eq(globalSettingsTable.key, "girls_cycle_start_date"))
    .limit(1);

  if (existing.length > 0) {
    await db.update(globalSettingsTable)
      .set({ value: newCycleStart })
      .where(eq(globalSettingsTable.key, "girls_cycle_start_date"));
  } else {
    await db.insert(globalSettingsTable).values({ key: "girls_cycle_start_date", value: newCycleStart });
  }

  // 2. Find all girls circles (not fixation)
  const girlsCircles = await db.select({ id: circlesTable.id })
    .from(circlesTable)
    .where(and(eq(circlesTable.trackType, "girls"), eq(circlesTable.isArchived, false)));

  if (!girlsCircles.length) {
    res.json({ renewed: 0, skipped: 0, newCycleStart }); return;
  }

  const circleIds = girlsCircles.map(c => c.id);

  // 3. Find all active girls_review plans
  const activePlans = await db.select()
    .from(reviewPlansTable)
    .where(and(
      inArray(reviewPlansTable.circleId, circleIds),
      eq(reviewPlansTable.planType, "girls_review"),
      eq(reviewPlansTable.status, "active")
    ));

  let renewed = 0;
  let skipped = 0;

  for (const plan of activePlans) {
    const endDate = getPlanEndDate(plan.startDate, "girls_review");
    const today = getTodayMecca();
    // Only renew completed plans that haven't been moved to new cycle yet
    if (today > endDate && plan.startDate !== newCycleStart) {
      const result = await autoRenewGirlsPlan(plan, plan.studentId, plan.circleId, newCycleStart);
      if (result) renewed++;
      else skipped++;
    } else {
      skipped++;
    }
  }

  res.json({ renewed, skipped, newCycleStart });
});

// ─── GET: global cycle info ────────────────────────────────────────────────────
router.get("/review-plans/cycle-info", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy", "track_supervisor", "teacher", "supervisor", "student"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const cycleStartDate = await getGlobalCycleStartDate();
  if (!cycleStartDate) { res.json(null); return; }

  const cycleDates = getCycleDates(cycleStartDate, 21);
  const cycleEndDate = cycleDates[cycleDates.length - 1] ?? cycleStartDate;
  const today = getTodayMecca();
  const dayIdx = cycleDates.indexOf(today);
  const currentDay = dayIdx >= 0 ? dayIdx + 1 : today < cycleDates[0]! ? 0 : 22;
  const isCompleted = today > cycleEndDate;

  res.json({
    cycleStartDate,
    cycleEndDate,
    currentDay,
    totalDays: 21,
    isCompleted,
  });
});

// ─── Overview: all circles with students + plan status ─────────────────────────
router.get("/review-plans/overview", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy", "track_supervisor", "teacher", "supervisor"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const role = req.userRole!;
  const userId = req.userId!;

  let circles: Array<{ id: number; name: string; track: string; trackType: string; trackId: number | null }> = [];

  if (role === "teacher") {
    circles = await db.select({
      id: circlesTable.id,
      name: circlesTable.name,
      track: circlesTable.track,
      trackType: circlesTable.trackType,
      trackId: circlesTable.trackId,
    }).from(circlesTable)
      .where(and(eq(circlesTable.teacherId, userId), eq(circlesTable.isArchived, false)));
  } else if (role === "supervisor") {
    circles = await db.select({
      id: circlesTable.id,
      name: circlesTable.name,
      track: circlesTable.track,
      trackType: circlesTable.trackType,
      trackId: circlesTable.trackId,
    }).from(circlesTable)
      .where(and(eq(circlesTable.supervisorId, userId), eq(circlesTable.isArchived, false)));
  } else if (role === "track_supervisor") {
    const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
    if (!currentUser?.track) { res.json([]); return; }
    circles = await db.select({
      id: circlesTable.id,
      name: circlesTable.name,
      track: circlesTable.track,
      trackType: circlesTable.trackType,
      trackId: circlesTable.trackId,
    }).from(circlesTable)
      .where(and(eq(circlesTable.track, currentUser.track), eq(circlesTable.isArchived, false)));
  } else {
    circles = await db.select({
      id: circlesTable.id,
      name: circlesTable.name,
      track: circlesTable.track,
      trackType: circlesTable.trackType,
      trackId: circlesTable.trackId,
    }).from(circlesTable)
      .where(eq(circlesTable.isArchived, false))
      .orderBy(circlesTable.track, circlesTable.name);
  }

  if (!circles.length) { res.json([]); return; }

  const circleIds = circles.map(c => c.id);

  const allStudents = await db.select({
    id: studentsTable.id,
    fullName: studentsTable.fullName,
    circleId: studentsTable.circleId,
    isNewcomer: studentsTable.isNewcomer,
  }).from(studentsTable)
    .where(and(
      inArray(studentsTable.circleId, circleIds),
      eq(studentsTable.isArchived, false)
    ))
    .orderBy(studentsTable.fullName);

  // Get active plans WITH their days for staff full-display
  const activePlans = await db.select().from(reviewPlansTable)
    .where(and(
      inArray(reviewPlansTable.circleId, circleIds),
      eq(reviewPlansTable.status, "active")
    ));

  const planIds = activePlans.map(p => p.id);
  const allDays = planIds.length > 0
    ? await db.select().from(reviewPlanDaysTable)
        .where(inArray(reviewPlanDaysTable.planId, planIds))
        .orderBy(reviewPlanDaysTable.dayNumber)
    : [];

  const planByStudent = new Map<number, typeof activePlans[0]>();
  for (const plan of activePlans) {
    planByStudent.set(plan.studentId, plan);
  }

  const daysByPlan = new Map<number, typeof allDays>();
  for (const day of allDays) {
    if (!daysByPlan.has(day.planId)) daysByPlan.set(day.planId, []);
    daysByPlan.get(day.planId)!.push(day);
  }

  const cycleStartDate = await getGlobalCycleStartDate();
  let cycleInfo: { cycleStartDate: string; cycleEndDate: string; currentDay: number; isCompleted: boolean } | null = null;
  if (cycleStartDate) {
    const cycleDates = getCycleDates(cycleStartDate, 21);
    const cycleEndDate = cycleDates[cycleDates.length - 1] ?? cycleStartDate;
    const today = getTodayMecca();
    const dayIdx = cycleDates.indexOf(today);
    const currentDay = dayIdx >= 0 ? dayIdx + 1 : today < cycleDates[0]! ? 0 : 22;
    cycleInfo = { cycleStartDate, cycleEndDate, currentDay, isCompleted: today > cycleEndDate };
  }

  const result = circles.map(circle => {
    const students = allStudents.filter(s => s.circleId === circle.id);
    return {
      circleId: circle.id,
      circleName: circle.name,
      trackName: circle.track,
      trackType: circle.trackType,
      students: students.map(s => {
        const plan = planByStudent.get(s.id);
        const planDays = plan ? (daysByPlan.get(plan.id) ?? []) : [];
        return {
          studentId: s.id,
          studentName: s.fullName,
          isNewcomer: s.isNewcomer,
          hasPlan: !!plan,
          plan: plan ? {
            id: plan.id,
            planType: plan.planType,
            startDate: plan.startDate,
            themeColor: plan.themeColor,
            totalPages: plan.totalPages,
            quotaType: plan.quotaType,
            quotaJuz: plan.quotaJuz,
            quotaSurahStart: plan.quotaSurahStart,
            quotaAyahStart: plan.quotaAyahStart,
            quotaSurahEnd: plan.quotaSurahEnd,
            quotaAyahEnd: plan.quotaAyahEnd,
            extraRanges: plan.extraRanges,
            planMode: plan.planMode,
            createdAt: plan.createdAt.toISOString(),
            days: planDays,
          } : null,
        };
      }),
    };
  });

  res.json({ circles: result, cycleInfo });
});

export default router;
