import { Router, type IRouter } from "express";
import {
  db, usersTable, circlesTable, studentsTable, recordsTable,
  teacherAbsencesTable, dailyCircleTasksTable, trackSupervisorNamesTable, tracksTable,
  reviewPlansTable, planNotificationsTable, deputyTasksTable,
} from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.get("/stats/stumbling", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const today = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() + 3 * 60 * 60 * 1000 - 30 * 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() + 3 * 60 * 60 * 1000 - 2 * 86400000).toISOString().slice(0, 10);

  const [allUsers, allCircles, allStudents, allTracks] = await Promise.all([
    db.select().from(usersTable),
    db.select().from(circlesTable).where(eq(circlesTable.isArchived, false)),
    db.select().from(studentsTable).where(eq(studentsTable.isArchived, false)),
    db.select().from(tracksTable),
  ]);

  let filteredCircles = allCircles;
  if (req.userRole === "track_supervisor") {
    const currentUser = allUsers.find(u => u.id === req.userId);
    filteredCircles = allCircles.filter(c => c.track === currentUser?.track);
  }
  const filteredCircleIds = new Set(filteredCircles.map(c => c.id));

  const circleTrackTypeMap: Record<number, string> = {};
  for (const c of allCircles) {
    if (c.trackId) {
      const t = allTracks.find(t => t.id === c.trackId);
      circleTrackTypeMap[c.id] = t ? t.dataEntryType : (c.trackType ?? "girls");
    } else {
      circleTrackTypeMap[c.id] = c.trackType ?? "girls";
    }
  }

  function getLastNWorkingDays(n: number, from: string): string[] {
    const days: string[] = [];
    const cur = new Date(from);
    cur.setDate(cur.getDate() - 1);
    while (days.length < n) {
      if (cur.getDay() !== 5) days.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() - 1);
    }
    return days;
  }
  const lastTwoWorkingDays = getLastNWorkingDays(2, today);
  const oldestWorkingDay = lastTwoWorkingDays[lastTwoWorkingDays.length - 1]!;

  const [recentRecords, teacherAbsences, circleTasks, reviewPlans] = await Promise.all([
    db.select().from(recordsTable).where(and(gte(recordsTable.date, thirtyDaysAgo), lte(recordsTable.date, today))),
    db.select().from(teacherAbsencesTable).where(and(gte(teacherAbsencesTable.date, twoDaysAgo), lte(teacherAbsencesTable.date, today))),
    db.select().from(dailyCircleTasksTable).where(and(gte(dailyCircleTasksTable.date, oldestWorkingDay), lte(dailyCircleTasksTable.date, today))),
    db.select().from(reviewPlansTable),
  ]);

  const circleMap: Record<number, typeof allCircles[number]> = {};
  for (const c of allCircles) circleMap[c.id] = c;
  const studentMap: Record<number, typeof allStudents[number]> = {};
  for (const s of allStudents) studentMap[s.id] = s;
  const userMap: Record<number, typeof allUsers[number]> = {};
  for (const u of allUsers) userMap[u.id] = u;

  // ── Data Entry Alerts ──
  const dataEntryAlerts: any[] = [];
  if (req.userRole === "leader") {
    const dataEntryUsers = allUsers.filter(u => u.role === "data_entry" && !u.isArchived);
    for (const u of dataEntryUsers) {
      const userCircles = filteredCircles.filter(c => c.track === u.track);
      const issues: string[] = [];
      for (const circle of userCircles) {
        const circleStudents = allStudents.filter(s => s.circleId === circle.id);
        for (const wd of lastTwoWorkingDays) {
          const recorded = recentRecords.filter(r => r.circleId === circle.id && r.date === wd).map(r => r.studentId);
          const missing = circleStudents.filter(s => !recorded.includes(s.id));
          if (missing.length > 0) {
            issues.push(`${wd}: ${circle.name} — ${missing.length} طالبة`);
          }
        }
      }
      if (issues.length > 0) {
        dataEntryAlerts.push({ userId: u.id, name: u.name, track: u.track ?? "", issue: "missing_data", issueLabel: "بيانات ناقصة", details: issues });
      }
    }
  }

  // ── Track Supervisor Alerts ──
  const supervisorAlerts: any[] = [];
  if (req.userRole === "leader") {
    const trackSupervisors = allUsers.filter(u => u.role === "track_supervisor" && !u.isArchived);
    for (const u of trackSupervisors) {
      const trackCircles = filteredCircles.filter(c => c.track === u.track);
      const trackCircleIds = new Set(trackCircles.map(c => c.id));
      const hasTasks = circleTasks.some(t => trackCircleIds.has(t.circleId));
      const lastLoginDays = u.lastLoginAt ? Math.floor((Date.now() - new Date(u.lastLoginAt).getTime()) / 86400000) : null;
      if (lastLoginDays !== null && lastLoginDays >= 3) {
        supervisorAlerts.push({ type: "login", name: u.name, track: u.track ?? "", issueLabel: `لم تدخل منذ ${lastLoginDays} أيام` });
      }
    }
  }

  // ── Teacher Alerts ──
  const teacherAlerts: any[] = [];
  const teacherUsers = allUsers.filter(u => u.role === "teacher" && !u.isArchived);
  for (const u of teacherUsers) {
    if (!u.circleId || !filteredCircleIds.has(u.circleId)) continue;
    const circle = circleMap[u.circleId];
    if (!circle) continue;
    const absences = teacherAbsences.filter(a => a.circleId === u.circleId);
    const lateRecords = recentRecords.filter(r => r.circleId === u.circleId && r.date >= thirtyDaysAgo && (r as any).isLate);
    if (absences.length >= 2 || lateRecords.length >= 3) {
      teacherAlerts.push({ userId: u.id, name: u.name, circleName: circle.name, track: circle.track ?? "", absenceCount: absences.length, lateCount: lateRecords.length });
    }
  }

  // ── Supervisor Stumbling ──
  const supervisorStumbling: any[] = [];
  const supervisorUsers = allUsers.filter(u => u.role === "supervisor" && !u.isArchived);
  for (const u of supervisorUsers) {
    if (!u.circleId || !filteredCircleIds.has(u.circleId)) continue;
    const circle = circleMap[u.circleId];
    if (!circle) continue;
    const absences = teacherAbsences.filter(a => a.circleId === u.circleId);
    const lateRecords = recentRecords.filter(r => r.circleId === u.circleId && r.date >= thirtyDaysAgo && (r as any).isLate);
    if (absences.length >= 2 || lateRecords.length >= 3) {
      supervisorStumbling.push({ userId: u.id, name: u.name, circleName: circle.name, track: circle.track ?? "", absenceCount: absences.length, lateCount: lateRecords.length });
    }
  }

  // ── Student Alerts ──
  const studentAlerts: any[] = [];
  const planMap: Record<number, typeof reviewPlans[number]> = {};
  for (const p of reviewPlans) planMap[p.studentId] = p;

  for (const s of allStudents) {
    if (!s.circleId || !filteredCircleIds.has(s.circleId)) continue;
    const circle = circleMap[s.circleId];
    if (!circle) continue;

    const studentRecs = recentRecords.filter(r => r.studentId === s.id);
    const absenceCount = studentRecs.filter(r => r.isAbsent).length;
    const shortcomingRecs = studentRecs.filter(r => !r.isAbsent && r.reviewFarPages === 0 && r.memorizePages === 0);
    const shortcomingCount = shortcomingRecs.length;

    const plan = planMap[s.id];
    let planMissedDays = 0;
    let issueLabel: string | undefined;
    let isLongStumbling = false;

    if (plan) {
      const cycleStart = plan.currentCycleStart ?? plan.startDate;
      const recsForPlan = studentRecs.filter(r => r.date >= cycleStart);
      for (const r of recsForPlan) {
        if (r.isAbsent) { planMissedDays++; continue; }
        const actual = (plan.trackType === "simple_review" || plan.trackType === "fixation")
          ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0);
        if (actual === 0) planMissedDays++;
      }
      if (planMissedDays >= 7) {
        issueLabel = `تعثّرت ${planMissedDays} يومًا في خطة المراجعة`;
        isLongStumbling = true;
      } else if (planMissedDays >= 3) {
        issueLabel = `${planMissedDays} أيام بدون مراجعة في الخطة`;
      }
    }

    if (absenceCount >= 3 || shortcomingCount >= 3 || planMissedDays >= 3) {
      studentAlerts.push({
        studentId: s.id, studentName: s.fullName, circleName: circle.name, track: circle.track ?? "",
        absenceCount, shortcomingCount, planMissedDays, issueLabel, isLongStumbling,
      });
    }
  }

  // ── Cycle Completed ──
  const cycleCompletedAlerts: any[] = [];
  const NO_PLAN_TRACKS = ["ألق", "سراج", "مهج", "مشكاة نور"];
  for (const p of reviewPlans) {
    const student = studentMap[p.studentId];
    if (!student?.circleId || !filteredCircleIds.has(student.circleId)) continue;
    const circle = circleMap[student.circleId];
    if (!circle || NO_PLAN_TRACKS.includes(circle.track ?? "")) continue;
    const cycleStart = p.currentCycleStart ?? p.startDate;
    const daysOverdue = Math.floor((Date.now() - new Date(cycleStart).getTime()) / 86400000) - p.cycleLength;
    if (daysOverdue > 0 && p.cycleCount > 0) {
      const useMemo = p.trackType === "simple_review" || p.trackType === "fixation";
      const cycleRecs = recentRecords.filter(r => r.studentId === p.studentId && r.date >= cycleStart && !r.isAbsent);
      const totalActual = cycleRecs.reduce((s, r) => s + (useMemo ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)), 0);
      if (totalActual >= p.totalPages) {
        cycleCompletedAlerts.push({
          studentId: p.studentId, studentName: student.fullName, circleName: circle.name,
          track: circle.track ?? "", cycleCount: p.cycleCount, totalPages: p.totalPages, daysOverdue,
        });
      }
    }
  }

  // ── Plan Notifications ──
  const allPlanNotifications = await db.select().from(planNotificationsTable)
    .where(eq(planNotificationsTable.isRead, false))
    .orderBy(desc(planNotificationsTable.createdAt));

  const NO_PLAN_NOTIF_TRACKS = ["ألق", "سراج", "مهج", "مشكاة نور"];
  let planNotifications = allPlanNotifications.filter(n => !NO_PLAN_NOTIF_TRACKS.includes(n.track ?? ""));
  if (req.userRole === "track_supervisor") {
    const currentUser = allUsers.find(u => u.id === req.userId);
    planNotifications = planNotifications.filter(n => n.track === currentUser?.track);
  }

  // ── Deputy alert (leader only) ──────────────────────────────────────────
  let deputyAlert: {
    hasDeputy: boolean; name?: string; inactive: boolean;
    neverLoggedIn: boolean; daysSinceLogin: number | null;
    pendingTasksCount: number; unansweredQaCount: number;
  } = { hasDeputy: false, inactive: false, neverLoggedIn: false, daysSinceLogin: null, pendingTasksCount: 0, unansweredQaCount: 0 };

  if (req.userRole === "leader") {
    const deputies = allUsers.filter(u => u.role === "deputy" && !u.isArchived);
    if (deputies.length > 0) {
      const deputy = deputies[0]!;
      const lastLogin = deputy.lastLoginAt;
      const daysSinceLogin = lastLogin
        ? Math.floor((Date.now() - new Date(lastLogin).getTime()) / 86400000)
        : null;
      const allDeputyTasks = await db.select().from(deputyTasksTable);
      const pendingTasksCount = allDeputyTasks.filter(t => !t.isCompleted).length;
      const unansweredQaCount = allDeputyTasks.filter(t =>
        t.taskType === "qa" && !t.response &&
        Math.floor((Date.now() - new Date(t.createdAt).getTime()) / 86400000) >= 3
      ).length;
      deputyAlert = {
        hasDeputy: true,
        name: deputy.name,
        inactive: daysSinceLogin !== null && daysSinceLogin >= 3,
        neverLoggedIn: lastLogin === null,
        daysSinceLogin,
        pendingTasksCount,
        unansweredQaCount,
      };
    }
  }

  res.json({
    dataEntry: dataEntryAlerts,
    trackSupervisors: supervisorAlerts,
    teachers: teacherAlerts,
    supervisors: supervisorStumbling,
    students: studentAlerts,
    cycleCompleted: cycleCompletedAlerts,
    deputyAlert,
    planNotifications: planNotifications.map(n => ({
      id: n.id, studentId: n.studentId, studentName: n.studentName,
      circleName: n.circleName, track: n.track, type: n.type,
      cycleCount: n.cycleCount, totalPages: n.totalPages, createdAt: n.createdAt.toISOString(),
    })),
  });
});

router.patch("/stats/stumbling/notifications/:id/read", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const id = parseInt(req.params.id as string);
  await db.update(planNotificationsTable).set({ isRead: true }).where(eq(planNotificationsTable.id, id));
  res.json({ ok: true });
});

router.patch("/stats/stumbling/notifications/read-all", authenticate, async (req, res): Promise<void> => {
  if (req.userRole !== "leader" && req.userRole !== "track_supervisor") {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  await db.update(planNotificationsTable).set({ isRead: true }).where(eq(planNotificationsTable.isRead, false));
  res.json({ ok: true });
});

export default router;
