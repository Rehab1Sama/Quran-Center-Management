import { Router, type IRouter } from "express";
import {
  db, reviewPlansTable, studentsTable, recordsTable,
  circlesTable, tracksTable, usersTable,
} from "@workspace/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";

const router: IRouter = Router();

router.get("/stats/review-plan-stats", authenticate, async (req, res): Promise<void> => {
  const allowed = ["leader", "track_supervisor"];
  if (!allowed.includes(req.userRole!)) { res.status(403).json({ error: "Forbidden" }); return; }

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  // Get current user's track (for track_supervisor)
  let allowedTrackIds: Set<number> | null = null;
  if (req.userRole === "track_supervisor") {
    const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const allTracks = await db.select().from(tracksTable);
    const myTrack = allTracks.find(t => t.name === currentUser?.track);
    if (myTrack) allowedTrackIds = new Set([myTrack.id]);
    else { res.json({ totalWithPlan: 0, committed: 0, uncommitted: 0, commitmentRate: 0, noStudentsYet: true, byTrack: [] }); return; }
  }

  // Fetch all active plans
  const activePlans = await db.select().from(reviewPlansTable)
    .where(eq(reviewPlansTable.status, "active"));

  if (activePlans.length === 0) {
    res.json({ totalWithPlan: 0, committed: 0, uncommitted: 0, commitmentRate: 0, byTrack: [] });
    return;
  }

  // Get students for these plans
  const planStudentIds = activePlans.map(p => p.studentId);
  const allStudents = await db.select().from(studentsTable);
  const allCircles = await db.select().from(circlesTable);
  const allTracks = await db.select().from(tracksTable);

  // Filter by track if needed
  const filteredPlans = activePlans.filter(plan => {
    if (!allowedTrackIds) return true;
    const student = allStudents.find(s => s.id === plan.studentId);
    if (!student?.circleId) return false;
    const circle = allCircles.find(c => c.id === student.circleId);
    if (!circle) return false;
    // Match by trackId on circle
    const circleTrack = allTracks.find(t => t.name === (circle as any).track);
    return allowedTrackIds.has(circleTrack?.id ?? -1);
  });

  if (filteredPlans.length === 0) {
    res.json({ totalWithPlan: 0, committed: 0, uncommitted: 0, commitmentRate: 0, byTrack: [] });
    return;
  }

  // Batch fetch recent records for all plan students
  const recentRecords = await db.select().from(recordsTable)
    .where(and(gte(recordsTable.date, thirtyDaysAgo), lte(recordsTable.date, today)));

  const recordsByStudent: Record<number, typeof recentRecords> = {};
  for (const r of recentRecords) {
    if (!planStudentIds.includes(r.studentId)) continue;
    if (!recordsByStudent[r.studentId]) recordsByStudent[r.studentId] = [];
    recordsByStudent[r.studentId].push(r);
  }

  // Track-level aggregation
  const byTrackMap: Record<string, { trackName: string; total: number; committed: number }> = {};

  let totalWithPlan = 0;
  let committed = 0;
  let uncommitted = 0;

  for (const plan of filteredPlans) {
    const student = allStudents.find(s => s.id === plan.studentId);
    if (!student || student.isArchived) continue;

    totalWithPlan++;

    // Determine track name for this student
    const circle = allCircles.find(c => c.id === student.circleId);
    const trackName = (circle as any)?.track ?? "غير محدد";

    if (!byTrackMap[trackName]) {
      byTrackMap[trackName] = { trackName, total: 0, committed: 0 };
    }
    byTrackMap[trackName].total++;

    // Calculate missed days in last 30 days
    const planRecords = (recordsByStudent[plan.studentId] ?? []).filter(r => !r.isAbsent);
    const pagesPerDay = plan.totalPages / plan.cycleLength;
    let missedDays = 0;

    for (const record of planRecords) {
      const daysFromStart = Math.max(0, Math.floor(
        (new Date(record.date).getTime() - new Date(plan.startDate).getTime()) / 86400000
      ));
      const dayN = (daysFromStart % plan.cycleLength) + 1;
      let planned = pagesPerDay;
      if (plan.planType === "manual") {
        const entries = (plan.planEntries ?? []) as unknown as { dayNumber: number; pages: number }[];
        const entry = entries.find(e => e.dayNumber === dayN);
        planned = entry?.pages ?? 0;
      }
      const actual = (record.reviewNearPages ?? 0) + (record.reviewFarPages ?? 0) + ((record as any).reviewPages ?? 0);
      if (actual < planned * 0.8) missedDays++;
    }

    const isCommitted = missedDays < 3;
    if (isCommitted) {
      committed++;
      byTrackMap[trackName].committed++;
    } else {
      uncommitted++;
    }
  }

  const commitmentRate = totalWithPlan > 0 ? Math.round((committed / totalWithPlan) * 100) : 0;

  const byTrack = Object.values(byTrackMap).map(t => ({
    ...t,
    rate: t.total > 0 ? Math.round((t.committed / t.total) * 100) : 0,
  })).sort((a, b) => b.total - a.total);

  res.json({ totalWithPlan, committed, uncommitted, commitmentRate, byTrack });
});

export default router;
