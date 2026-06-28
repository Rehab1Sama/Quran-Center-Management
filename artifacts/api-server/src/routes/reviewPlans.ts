import { Router, type IRouter } from "express";
import { db, reviewPlansTable, reviewPlanDaysTable, studentsTable, circlesTable, usersTable } from "@workspace/db";
import { eq, and, desc, inArray } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

const GIRLS_TRACK_TYPES = ["girls"];
const FIXATION_TRACK_TYPES = ["fixation"];

function getPlanTypeForTrack(trackType: string): "girls_review" | "fixation" | null {
  if (GIRLS_TRACK_TYPES.includes(trackType)) return "girls_review";
  if (FIXATION_TRACK_TYPES.includes(trackType)) return "fixation";
  return null;
}

function getPlanEndDate(startDate: string, planType: "girls_review" | "fixation"): string {
  const totalDays = planType === "fixation" ? 24 : 21;
  const dates: string[] = [];
  const cur = new Date(startDate + "T12:00:00Z");
  const firstDow = cur.getUTCDay();
  const isValid = (dow: number) => planType === "fixation" ? dow <= 3 : dow !== 5;
  if (isValid(firstDow)) dates.push(cur.toISOString().slice(0, 10));
  while (dates.length < totalDays) {
    cur.setDate(cur.getDate() + 1);
    if (isValid(cur.getUTCDay())) dates.push(cur.toISOString().slice(0, 10));
  }
  return dates[dates.length - 1] ?? startDate;
}

function getTodayMecca(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

router.get("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "track_supervisor", "teacher", "supervisor", "student"];
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
  const plan = plans[0];

  const days = await db.select().from(reviewPlanDaysTable)
    .where(eq(reviewPlanDaysTable.planId, plan.id))
    .orderBy(reviewPlanDaysTable.dayNumber);

  res.json({
    ...plan,
    createdAt: plan.createdAt.toISOString(),
    updatedAt: plan.updatedAt?.toISOString(),
    days,
  });
});

router.post("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  try {
    const allowed = ["leader", "track_supervisor", "teacher", "supervisor", "student"];
    if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

    const studentId = parseInt(req.params.id as string);

    // الطالبة لا يحق لها إنشاء خطة إلا لنفسها
    if (req.userRole === "student") {
      const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
      if (!currentUser) { res.status(403).json({ error: "غير مسموح" }); return; }
      const bodyCircleId = req.body?.circleId ? parseInt(req.body.circleId) : null;
      const searchCircleId = bodyCircleId ?? currentUser.circleId;
      let ownStudentId: number | null = null;
      if (searchCircleId) {
        const [byCircle] = await db.select({ id: studentsTable.id }).from(studentsTable)
          .where(and(eq(studentsTable.fullName, currentUser.name), eq(studentsTable.circleId, searchCircleId))).limit(1);
        ownStudentId = byCircle?.id ?? null;
      }
      if (!ownStudentId) {
        const [byName] = await db.select({ id: studentsTable.id }).from(studentsTable)
          .where(eq(studentsTable.fullName, currentUser.name)).limit(1);
        ownStudentId = byName?.id ?? null;
      }
      if (ownStudentId !== studentId) {
        res.status(403).json({ error: "لا يمكنك إنشاء خطة لطالبة أخرى" }); return;
      }
    }

    const {
      circleId,
      quotaType,
      quotaJuz,
      quotaSurahStart,
      quotaAyahStart,
      quotaSurahEnd,
      quotaAyahEnd,
      extraRanges,
      planMode,
      totalPages,
      quantity,
      startDate,
      themeColor,
      days,
    } = req.body as {
      circleId: number;
      quotaType?: string;
      quotaJuz?: number;
      quotaSurahStart?: string;
      quotaAyahStart?: number;
      quotaSurahEnd?: string;
      quotaAyahEnd?: number;
      extraRanges?: string;
      planMode?: string;
      totalPages?: number;
      quantity?: string;
      startDate: string;
      themeColor: string;
      days: Array<{ dayNumber: number; surahStart?: string; ayahStart?: number; surahEnd?: string; ayahEnd?: number; pages?: number }>;
    };

    if (!circleId || !startDate || !days?.length) {
      res.status(400).json({ error: "بيانات ناقصة" }); return;
    }

    const circle = await db.select().from(circlesTable).where(eq(circlesTable.id, circleId)).limit(1);
    if (!circle.length) { res.status(404).json({ error: "الحلقة غير موجودة" }); return; }

    const planType = getPlanTypeForTrack(circle[0].trackType);
    if (!planType) { res.status(400).json({ error: "هذا المسار لا يدعم خطط المراجعة" }); return; }

    // الطالبة فقط تُمنع من إنشاء خطة جديدة إذا كان عندها خطة نشطة لم تنتهِ بعد
    if (req.userRole === "student") {
      const [activePlan] = await db.select()
        .from(reviewPlansTable)
        .where(and(eq(reviewPlansTable.studentId, studentId), eq(reviewPlansTable.circleId, circleId), eq(reviewPlansTable.status, "active")))
        .limit(1);
      if (activePlan && activePlan.startDate) {
        const endDate = getPlanEndDate(activePlan.startDate, activePlan.planType as "girls_review" | "fixation");
        const today = getTodayMecca();
        if (today <= endDate) {
          res.status(403).json({ error: `لا يمكنك إنشاء خطة جديدة قبل انتهاء خطتك الحالية (تنتهي ${endDate})` }); return;
        }
      }
    }

    await db.update(reviewPlansTable)
      .set({ status: "cancelled" })
      .where(and(eq(reviewPlansTable.studentId, studentId), eq(reviewPlansTable.circleId, circleId), eq(reviewPlansTable.status, "active")));

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
        days.map(d => ({
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

router.delete("/students/:id/review-plan/:planId", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "track_supervisor", "teacher", "supervisor", "student"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const studentId = parseInt(req.params.id as string);
  const planId = parseInt(req.params.planId as string);

  await db.update(reviewPlansTable)
    .set({ status: "cancelled" })
    .where(and(eq(reviewPlansTable.id, planId), eq(reviewPlansTable.studentId, studentId)));

  res.status(204).send();
});

router.get("/circles/:circleId/review-plans", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "track_supervisor", "teacher", "supervisor"];
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

// ─── Overview: all circles with students + plan status ─────────────────────────
router.get("/review-plans/overview", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "deputy", "track_supervisor", "teacher", "supervisor"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const role = req.userRole!;
  const userId = req.userId!;

  // Determine which circles to show based on role
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
    // leader or deputy: all circles
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

  // Get all active non-archived students in these circles
  const allStudents = await db.select({
    id: studentsTable.id,
    fullName: studentsTable.fullName,
    circleId: studentsTable.circleId,
  }).from(studentsTable)
    .where(and(
      inArray(studentsTable.circleId, circleIds),
      eq(studentsTable.isArchived, false)
    ))
    .orderBy(studentsTable.fullName);

  // Get all active plans for students in these circles
  const activePlans = await db.select({
    id: reviewPlansTable.id,
    studentId: reviewPlansTable.studentId,
    circleId: reviewPlansTable.circleId,
    planType: reviewPlansTable.planType,
    startDate: reviewPlansTable.startDate,
    themeColor: reviewPlansTable.themeColor,
    totalPages: reviewPlansTable.totalPages,
    quotaType: reviewPlansTable.quotaType,
    quotaJuz: reviewPlansTable.quotaJuz,
    quotaSurahStart: reviewPlansTable.quotaSurahStart,
    quotaSurahEnd: reviewPlansTable.quotaSurahEnd,
    createdAt: reviewPlansTable.createdAt,
  }).from(reviewPlansTable)
    .where(and(
      inArray(reviewPlansTable.circleId, circleIds),
      eq(reviewPlansTable.status, "active")
    ));

  // Build a map: studentId -> plan
  const planByStudent = new Map<number, typeof activePlans[0]>();
  for (const plan of activePlans) {
    planByStudent.set(plan.studentId, plan);
  }

  // Build result grouped by circle
  const result = circles.map(circle => {
    const students = allStudents.filter(s => s.circleId === circle.id);
    return {
      circleId: circle.id,
      circleName: circle.name,
      trackName: circle.track,
      trackType: circle.trackType,
      students: students.map(s => {
        const plan = planByStudent.get(s.id);
        return {
          studentId: s.id,
          studentName: s.fullName,
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
            quotaSurahEnd: plan.quotaSurahEnd,
            createdAt: plan.createdAt.toISOString(),
          } : null,
        };
      }),
    };
  });

  res.json(result);
});

export default router;
