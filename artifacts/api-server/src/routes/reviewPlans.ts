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
import { eq, and, desc, inArray, isNotNull, gte, lte, sql } from "drizzle-orm";
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

// Validates a "YYYY-MM-DD" string is both well-formed AND a real calendar date
// (rejects things like "2026-02-30" that a regex alone would let through).
function isValidIsoDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  const date = new Date(Date.UTC(y!, m! - 1, d!));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m! - 1 && date.getUTCDate() === d;
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

async function upsertSetting(key: string, value: string): Promise<void> {
  const existing = await db.select({ key: globalSettingsTable.key })
    .from(globalSettingsTable)
    .where(eq(globalSettingsTable.key, key))
    .limit(1);
  if (existing.length > 0) {
    await db.update(globalSettingsTable).set({ value }).where(eq(globalSettingsTable.key, key));
  } else {
    await db.insert(globalSettingsTable).values({ key, value });
  }
}

async function getGlobalCycleStartDate(): Promise<string | null> {
  const [row] = await db.select().from(globalSettingsTable)
    .where(eq(globalSettingsTable.key, "girls_cycle_start_date"));
  return row?.value ?? null;
}

// A leader-scheduled forced end date for the CURRENT girls cycle (may fall before
// each plan's natural start+21 end date, so the cycle can be closed on a fixed
// calendar date such as "٧ صفر" regardless of when individual plans started).
async function getGlobalCycleEndDate(): Promise<string | null> {
  const [row] = await db.select().from(globalSettingsTable)
    .where(eq(globalSettingsTable.key, "girls_cycle_end_date"));
  return row?.value ?? null;
}

// Effective end date for a plan: the scheduled forced cycle-end date if it applies
// to this plan (plan started on/before it, and it actually shortens the cycle),
// otherwise the plan's own natural start+21 end date.
async function getEffectiveEndDate(plan: { startDate: string; planType: string }): Promise<string> {
  const natural = getPlanEndDate(plan.startDate, plan.planType as "girls_review" | "fixation");
  if (plan.planType !== "girls_review") return natural;
  const forced = await getGlobalCycleEndDate();
  if (forced && plan.startDate <= forced && forced < natural) return forced;
  return natural;
}

const AUTO_PLAN_EDIT_WINDOW_MS = 48 * 60 * 60 * 1000;

// Auto-generated plans (created by the cycle renewal) may be freely replaced by
// the student/staff within 48 hours of creation, even though they'd normally be
// locked for the whole cycle — this lets a student correct an auto-carried quota.
function isWithinAutoPlanEditWindow(plan: { planMode: string | null; createdAt: Date }): boolean {
  if (plan.planMode !== "auto") return false;
  return Date.now() - plan.createdAt.getTime() <= AUTO_PLAN_EDIT_WINDOW_MS;
}

// Auto-renew a girls plan for the new cycle.
// newCycleStart: the start date of the new cycle (from global settings).
// overrideEndDate: if provided, use this as the memorization cut-off instead of
//   the plan's natural/effective end date. Used by bulk-renew so active plans are
//   closed at newCycleStart-1 rather than their original end date.
async function autoRenewGirlsPlan(
  oldPlan: typeof reviewPlansTable.$inferSelect,
  studentId: number,
  circleId: number,
  newCycleStart: string,
  overrideEndDate?: string
): Promise<(typeof reviewPlansTable.$inferSelect & { days: typeof reviewPlanDaysTable.$inferSelect[] }) | null> {
  return db.transaction(async (tx: Parameters<Parameters<typeof db.transaction>[0]>[0]) => {
    // Serialize concurrent renewal attempts for the same student+circle (e.g. two
    // overview requests racing) so only one ever creates the new-cycle plan.
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`renew:${studentId}:${circleId}`}))`);

    // Guard: check if new plan for this cycle already exists
    const [existing] = await tx.select({ id: reviewPlansTable.id })
      .from(reviewPlansTable)
      .where(and(
        eq(reviewPlansTable.studentId, studentId),
        eq(reviewPlansTable.circleId, circleId),
        eq(reviewPlansTable.startDate, newCycleStart),
        eq(reviewPlansTable.status, "active")
      ))
      .limit(1);
    if (existing) return null;

    // Re-check the old plan is still active under the lock (another concurrent
    // renewal may have already archived it while we waited for the lock).
    const [stillActive] = await tx.select({ id: reviewPlansTable.id })
      .from(reviewPlansTable)
      .where(and(eq(reviewPlansTable.id, oldPlan.id), eq(reviewPlansTable.status, "active")))
      .limit(1);
    if (!stillActive) return null;

    // Collect new memorization during old plan period (respecting a forced/scheduled
    // cycle-end date if it shortened this plan's cycle, so days after the forced
    // cutoff aren't counted toward the previous cycle's carry-over quota).
    const oldEndDate = overrideEndDate ?? await getEffectiveEndDate(oldPlan);
    const memRows = await tx.select({ memorizePages: recordsTable.memorizePages })
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
    await tx.update(reviewPlansTable)
      .set({ status: "cancelled" })
      .where(eq(reviewPlansTable.id, oldPlan.id));

    // Create new plan
    const [newPlan] = await tx.insert(reviewPlansTable).values({
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
      const inserted = await tx.insert(reviewPlanDaysTable).values(
        dist.map((pages, i) => ({ planId: newPlan.id, dayNumber: i + 1, pages }))
      ).returning();
      savedDays = inserted;
    }

    return { ...newPlan, days: savedDays };
  });
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
    const endDate = await getEffectiveEndDate(plan);

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

  // For girls_review plans, fetch far-review records for per-day colour coding
  // Use DISTINCT ON (date) ordered by updated_at DESC to pick the latest record per day
  let dayRecords: Record<string, { reviewFarPages: number | null; isAbsent: boolean }> = {};
  if (plan.planType === "girls_review" && plan.startDate) {
    const cycleDates = getCycleDates(plan.startDate, 21);
    const recs = await db
      .select({ date: recordsTable.date, reviewFarPages: recordsTable.reviewFarPages, isAbsent: recordsTable.isAbsent })
      .from(recordsTable)
      .where(and(
        eq(recordsTable.studentId, studentId),
        eq(recordsTable.circleId, plan.circleId),
        inArray(recordsTable.date, cycleDates),
      ))
      .orderBy(recordsTable.date, desc(recordsTable.updatedAt));
    // Keep only the latest record per date (first occurrence after ordering by updatedAt desc)
    for (const r of recs) {
      if (!dayRecords[r.date]) {
        dayRecords[r.date] = { reviewFarPages: r.reviewFarPages, isAbsent: r.isAbsent };
      }
    }
  }

  res.json({
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt?.toISOString(),
    days,
    cycleInfo,
    dayRecords,
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
        // أولاً: بحث مباشر عبر students.circle_id
        const [s] = await db.select({ id: studentsTable.id })
          .from(studentsTable)
          .where(and(
            eq(studentsTable.circleId, searchCircleId),
            eq(studentsTable.isArchived, false),
            sql`TRIM(${studentsTable.fullName}) = TRIM(${currentUser.name})`
          ))
          .limit(1);
        ownStudentId = s?.id ?? null;

        // ثانياً: بحث عبر student_enrollments (طالبات في حلقتين لهن تسجيل رئيسي في حلقة أخرى)
        if (!ownStudentId) {
          const res2 = await db.execute(
            sql`SELECT s.id FROM students s
                JOIN student_enrollments se ON se.student_id = s.id
                  AND se.circle_id = ${searchCircleId}
                  AND se.is_archived = false
                WHERE TRIM(s.full_name) = TRIM(${currentUser.name})
                  AND s.is_archived = false
                LIMIT 1`
          );
          ownStudentId = (res2 as any).rows?.[0]?.id ?? null;
        }
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

    if (activePlan?.startDate && !isWithinAutoPlanEditWindow(activePlan)) {
      const endDate = await getEffectiveEndDate(activePlan);
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

    // ── Girls: use global cycle start date, fall back to provided date ────────
    let startDate: string;
    if (planType === "girls_review") {
      const cycleStart = await getGlobalCycleStartDate();
      startDate = cycleStart ?? req.body?.startDate ?? getTodayMecca();
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

  const adminRoles = ["leader", "deputy", "track_supervisor"];
  if (
    !adminRoles.includes(req.userRole!) &&
    planToDelete?.planType === "girls_review" &&
    planToDelete.startDate &&
    !isWithinAutoPlanEditWindow(planToDelete)
  ) {
    const endDate = await getEffectiveEndDate(planToDelete);
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
  if (!isValidIsoDate(newCycleStart)) {
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

  // Compute the day before the new cycle starts — this is the inclusive cut-off
  // for counting old-cycle memorization, so records on or before that date count
  // toward the previous cycle's carry-over quota regardless of whether the plan's
  // natural 21-day window had already elapsed.
  const dayBeforeNewCycle = (() => {
    const d = new Date(newCycleStart + "T12:00:00Z");
    d.setDate(d.getDate() - 1);
    return d.toISOString().slice(0, 10);
  })();

  let renewed = 0;
  let skipped = 0;

  for (const plan of activePlans) {
    // Renew all active plans that haven't been moved to the new cycle yet,
    // regardless of whether their 21-day window has elapsed. Memorization is
    // counted up to dayBeforeNewCycle so the new quota is always based on the
    // correct period.
    if (plan.startDate !== newCycleStart) {
      const result = await autoRenewGirlsPlan(plan, plan.studentId, plan.circleId, newCycleStart, dayBeforeNewCycle);
      if (result) renewed++;
      else skipped++;
    } else {
      skipped++;
    }
  }

  res.json({ renewed, skipped, newCycleStart });
});

// ─── POST: schedule the current cycle's forced end date + the next cycle's start ──
// Lets a leader/deputy fix a specific end date for the cycle in progress (e.g. "٧
// صفر") even if individual plans' natural start+21 end date falls later, and set
// when the next 21-day cycle begins. The actual lock/renewal happens automatically,
// lazily, the moment that end date arrives (via the existing per-student and
// overview auto-renew checks) — no separate trigger is needed on the day itself.
router.post("/review-plans/schedule-cycle-end", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const { cycleEndDate, newCycleStart } = req.body ?? {};
  if (!isValidIsoDate(cycleEndDate)) {
    res.status(400).json({ error: "cycleEndDate مطلوب بصيغة YYYY-MM-DD" }); return;
  }
  if (!isValidIsoDate(newCycleStart)) {
    res.status(400).json({ error: "newCycleStart مطلوب بصيغة YYYY-MM-DD" }); return;
  }
  if (newCycleStart <= cycleEndDate) {
    res.status(400).json({ error: "تاريخ بداية الدورة الجديدة يجب أن يكون بعد تاريخ نهاية الدورة الحالية" }); return;
  }

  await upsertSetting("girls_cycle_end_date", cycleEndDate);
  await upsertSetting("girls_cycle_start_date", newCycleStart);

  res.json({ cycleEndDate, newCycleStart });
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

  // Only circles whose track type supports review plans appear in the overview.
  // Children, mothers, recitation, archive, and registration circles never have
  // review plans, so including them would just show every student as "بدون خطة".
  const REVIEW_PLAN_TRACK_TYPES = ["girls", "fixation"];

  let circles: Array<{ id: number; name: string; track: string; trackType: string; trackId: number | null }> = [];

  if (role === "teacher") {
    circles = await db.select({
      id: circlesTable.id,
      name: circlesTable.name,
      track: circlesTable.track,
      trackType: circlesTable.trackType,
      trackId: circlesTable.trackId,
    }).from(circlesTable)
      .where(and(
        eq(circlesTable.teacherId, userId),
        eq(circlesTable.isArchived, false),
        inArray(circlesTable.trackType, REVIEW_PLAN_TRACK_TYPES),
      ));
  } else if (role === "supervisor") {
    circles = await db.select({
      id: circlesTable.id,
      name: circlesTable.name,
      track: circlesTable.track,
      trackType: circlesTable.trackType,
      trackId: circlesTable.trackId,
    }).from(circlesTable)
      .where(and(
        eq(circlesTable.supervisorId, userId),
        eq(circlesTable.isArchived, false),
        inArray(circlesTable.trackType, REVIEW_PLAN_TRACK_TYPES),
      ));
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
      .where(and(
        eq(circlesTable.track, currentUser.track),
        eq(circlesTable.isArchived, false),
        inArray(circlesTable.trackType, REVIEW_PLAN_TRACK_TYPES),
      ));
  } else {
    circles = await db.select({
      id: circlesTable.id,
      name: circlesTable.name,
      track: circlesTable.track,
      trackType: circlesTable.trackType,
      trackId: circlesTable.trackId,
    }).from(circlesTable)
      .where(and(
        eq(circlesTable.isArchived, false),
        inArray(circlesTable.trackType, REVIEW_PLAN_TRACK_TYPES),
      ))
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
  let activePlans = await db.select().from(reviewPlansTable)
    .where(and(
      inArray(reviewPlansTable.circleId, circleIds),
      eq(reviewPlansTable.status, "active")
    ));

  // Eagerly auto-renew any plans whose (possibly forced) cycle end date has
  // already passed, so the overview always reflects the current cycle without
  // requiring the leader to press a separate "renew" action first.
  const sweepNewCycleStart = await getGlobalCycleStartDate();
  if (sweepNewCycleStart) {
    const today = getTodayMecca();
    let anyRenewed = false;
    for (const plan of activePlans) {
      if (plan.planType !== "girls_review" || !plan.startDate || plan.startDate === sweepNewCycleStart) continue;
      const effectiveEnd = await getEffectiveEndDate(plan);
      if (today > effectiveEnd && sweepNewCycleStart > effectiveEnd) {
        const renewedPlan = await autoRenewGirlsPlan(plan, plan.studentId, plan.circleId, sweepNewCycleStart);
        if (renewedPlan) anyRenewed = true;
      }
    }
    if (anyRenewed) {
      activePlans = await db.select().from(reviewPlansTable)
        .where(and(
          inArray(reviewPlansTable.circleId, circleIds),
          eq(reviewPlansTable.status, "active")
        ));
    }
  }

  const planIds = activePlans.map((p: typeof activePlans[0]) => p.id);
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

  let cycleStartDate = await getGlobalCycleStartDate();

  // Auto-detect: if the global cycle start was never set but there are active
  // girls_review plans (e.g. migrating a database that had plans before this
  // feature was added), derive the cycle start from the most common startDate
  // among those plans and persist it so subsequent requests skip this step.
  if (!cycleStartDate) {
    const girlsCircleIds = circles.filter(c => c.trackType === "girls").map(c => c.id);
    if (girlsCircleIds.length > 0) {
      const startDateCounts = new Map<string, number>();
      for (const plan of activePlans) {
        if (plan.planType === "girls_review" && plan.startDate && girlsCircleIds.includes(plan.circleId)) {
          startDateCounts.set(plan.startDate, (startDateCounts.get(plan.startDate) ?? 0) + 1);
        }
      }
      if (startDateCounts.size > 0) {
        const detected = [...startDateCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
        await upsertSetting("girls_cycle_start_date", detected);
        cycleStartDate = detected;
      }
    }
  }

  const forcedCycleEndDate = await getGlobalCycleEndDate();
  let cycleInfo: {
    cycleStartDate: string; cycleEndDate: string; currentDay: number; isCompleted: boolean;
    scheduledEndDate: string | null;
  } | null = null;
  if (cycleStartDate) {
    const cycleDates = getCycleDates(cycleStartDate, 21);
    const cycleEndDate = cycleDates[cycleDates.length - 1] ?? cycleStartDate;
    const today = getTodayMecca();
    const dayIdx = cycleDates.indexOf(today);
    const currentDay = dayIdx >= 0 ? dayIdx + 1 : today < cycleDates[0]! ? 0 : 22;
    // scheduledEndDate: a forced end date only counts as "the previous cycle is
    // being wound down" while it still lies before this (new) cycle's start.
    const scheduledEndDate = forcedCycleEndDate && forcedCycleEndDate < cycleStartDate ? forcedCycleEndDate : null;
    cycleInfo = { cycleStartDate, cycleEndDate, currentDay, isCompleted: today > cycleEndDate, scheduledEndDate };
  }

  // Compute per-student overall status (behind / ontrack / ahead) for girls_review plans
  const girlsPlans = activePlans.filter((p: typeof activePlans[0]) => p.planType === "girls_review" && p.startDate);
  const cycleDatesByPlan = new Map<number, string[]>();
  const allDatesSet = new Set<string>();
  for (const p of girlsPlans) {
    const dates = getCycleDates(p.startDate!, 21);
    cycleDatesByPlan.set(p.id, dates);
    dates.forEach(d => allDatesSet.add(d));
  }

  const studentIdsForRecords = girlsPlans.map((p: typeof activePlans[0]) => p.studentId);
  // Key by `${studentId}:${circleId}` so records from another circle (e.g. after a transfer) never leak into this plan's status.
  const dayRecordsByStudentCircle = new Map<string, Record<string, { reviewFarPages: number | null; isAbsent: boolean }>>();
  if (studentIdsForRecords.length > 0 && allDatesSet.size > 0) {
    const recordsRaw = await db
      .select({
        studentId: recordsTable.studentId,
        circleId: recordsTable.circleId,
        date: recordsTable.date,
        reviewFarPages: recordsTable.reviewFarPages,
        isAbsent: recordsTable.isAbsent,
      })
      .from(recordsTable)
      .where(and(
        inArray(recordsTable.studentId, studentIdsForRecords),
        inArray(recordsTable.date, [...allDatesSet]),
      ))
      .orderBy(recordsTable.studentId, recordsTable.date, desc(recordsTable.updatedAt));
    for (const r of recordsRaw) {
      const key = `${r.studentId}:${r.circleId}`;
      let m = dayRecordsByStudentCircle.get(key);
      if (!m) { m = {}; dayRecordsByStudentCircle.set(key, m); }
      if (!m[r.date]) m[r.date] = { reviewFarPages: r.reviewFarPages, isAbsent: r.isAbsent };
    }
  }

  type PlanStatus = "behind" | "ontrack" | "ahead" | null;
  function computePlanStatus(plan: typeof activePlans[0], planDays: typeof allDays): PlanStatus {
    const cycleDates = cycleDatesByPlan.get(plan.id);
    if (!cycleDates) return null;
    const today = getTodayMecca();
    const dayIdx = cycleDates.indexOf(today);
    const currentDay = dayIdx >= 0 ? dayIdx + 1 : today < cycleDates[0]! ? 0 : 22;
    if (currentDay <= 0) return null; // plan hasn't started yet

    const dayRecords = dayRecordsByStudentCircle.get(`${plan.studentId}:${plan.circleId}`) ?? {};
    let hasBehind = false, hasAhead = false, hasOntrack = false;

    const evaluateDay = (dayNumber: number) => {
      const day = planDays.find((d: typeof allDays[0]) => d.dayNumber === dayNumber);
      const dateStr = cycleDates[dayNumber - 1];
      const rec = dateStr ? dayRecords[dateStr] : undefined;
      if (rec?.isAbsent) return;
      const quota = day?.pages ?? 0;
      if (rec && rec.reviewFarPages != null) {
        const done = rec.reviewFarPages;
        if (quota <= 0) hasOntrack = true;
        else if (done > quota) hasAhead = true;
        else if (done >= quota) hasOntrack = true;
        else hasBehind = true;
      } else {
        hasBehind = true;
      }
    };

    for (let d = 1; d < currentDay; d++) evaluateDay(d);
    // Also factor in today's entry if it has already been recorded
    const todayDateStr = cycleDates[currentDay - 1];
    const todayRec = todayDateStr ? dayRecords[todayDateStr] : undefined;
    if (todayRec && !todayRec.isAbsent && todayRec.reviewFarPages != null) evaluateDay(currentDay);

    if (hasBehind) return "behind";
    if (hasAhead) return "ahead";
    if (hasOntrack) return "ontrack";
    return null;
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
            status: plan ? computePlanStatus(plan, planDays) : null,
          } : null,
        };
      }),
    };
  });

  res.json({ circles: result, cycleInfo });
});

export default router;
