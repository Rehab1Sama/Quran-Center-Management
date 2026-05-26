import { Router, type IRouter } from "express";
import { db, reviewPlansTable, recordsTable, studentsTable, circlesTable, usersTable, tracksTable, planNotificationsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import type { PlanDayEntry, PlanTheme, PlanSnapshot } from "@workspace/db";

const router: IRouter = Router();

// Medina mushaf (مجمع الملك فهد، 604 صفحة) — صفحة بداية كل سورة
const SURAH_START_PAGE = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208,          // 1-10
  221, 235, 249, 255, 262, 267, 282, 293, 305, 312,     // 11-20
  322, 332, 342, 350, 359, 367, 377, 385, 396, 404,     // 21-30
  411, 415, 418, 428, 434, 440, 446, 453, 458, 467,     // 31-40
  477, 483, 489, 496, 499, 502, 507, 511, 515, 518,     // 41-50
  520, 523, 526, 528, 531, 534, 537, 542, 545, 549,     // 51-60
  551, 553, 554, 556, 558, 560, 562, 564, 566, 568,     // 61-70
  570, 572, 574, 575, 577, 578, 580, 582, 583, 585,     // 71-80
  586, 587, 588, 589, 590, 591, 591, 592, 593, 594,     // 81-90
  595, 595, 596, 596, 597, 597, 598, 598, 599, 599,     // 91-100
  600, 600, 601, 601, 601, 602, 602, 602, 603, 603,     // 101-110
  603, 604, 604, 604,                                    // 111-114
];

const SURAHS = [
  { n: 1, name: "الفاتحة", ayahs: 7 },{ n: 2, name: "البقرة", ayahs: 286 },{ n: 3, name: "آل عمران", ayahs: 200 },
  { n: 4, name: "النساء", ayahs: 176 },{ n: 5, name: "المائدة", ayahs: 120 },{ n: 6, name: "الأنعام", ayahs: 165 },
  { n: 7, name: "الأعراف", ayahs: 206 },{ n: 8, name: "الأنفال", ayahs: 75 },{ n: 9, name: "التوبة", ayahs: 129 },
  { n: 10, name: "يونس", ayahs: 109 },{ n: 11, name: "هود", ayahs: 123 },{ n: 12, name: "يوسف", ayahs: 111 },
  { n: 13, name: "الرعد", ayahs: 43 },{ n: 14, name: "إبراهيم", ayahs: 52 },{ n: 15, name: "الحجر", ayahs: 99 },
  { n: 16, name: "النحل", ayahs: 128 },{ n: 17, name: "الإسراء", ayahs: 111 },{ n: 18, name: "الكهف", ayahs: 110 },
  { n: 19, name: "مريم", ayahs: 98 },{ n: 20, name: "طه", ayahs: 135 },{ n: 21, name: "الأنبياء", ayahs: 112 },
  { n: 22, name: "الحج", ayahs: 78 },{ n: 23, name: "المؤمنون", ayahs: 118 },{ n: 24, name: "النور", ayahs: 64 },
  { n: 25, name: "الفرقان", ayahs: 77 },{ n: 26, name: "الشعراء", ayahs: 227 },{ n: 27, name: "النمل", ayahs: 93 },
  { n: 28, name: "القصص", ayahs: 88 },{ n: 29, name: "العنكبوت", ayahs: 69 },{ n: 30, name: "الروم", ayahs: 60 },
  { n: 31, name: "لقمان", ayahs: 34 },{ n: 32, name: "السجدة", ayahs: 30 },{ n: 33, name: "الأحزاب", ayahs: 73 },
  { n: 34, name: "سبأ", ayahs: 54 },{ n: 35, name: "فاطر", ayahs: 45 },{ n: 36, name: "يس", ayahs: 83 },
  { n: 37, name: "الصافات", ayahs: 182 },{ n: 38, name: "ص", ayahs: 88 },{ n: 39, name: "الزمر", ayahs: 75 },
  { n: 40, name: "غافر", ayahs: 85 },{ n: 41, name: "فصلت", ayahs: 54 },{ n: 42, name: "الشورى", ayahs: 53 },
  { n: 43, name: "الزخرف", ayahs: 89 },{ n: 44, name: "الدخان", ayahs: 59 },{ n: 45, name: "الجاثية", ayahs: 37 },
  { n: 46, name: "الأحقاف", ayahs: 35 },{ n: 47, name: "محمد", ayahs: 38 },{ n: 48, name: "الفتح", ayahs: 29 },
  { n: 49, name: "الحجرات", ayahs: 18 },{ n: 50, name: "ق", ayahs: 45 },{ n: 51, name: "الذاريات", ayahs: 60 },
  { n: 52, name: "الطور", ayahs: 49 },{ n: 53, name: "النجم", ayahs: 62 },{ n: 54, name: "القمر", ayahs: 55 },
  { n: 55, name: "الرحمن", ayahs: 78 },{ n: 56, name: "الواقعة", ayahs: 96 },{ n: 57, name: "الحديد", ayahs: 29 },
  { n: 58, name: "المجادلة", ayahs: 22 },{ n: 59, name: "الحشر", ayahs: 24 },{ n: 60, name: "الممتحنة", ayahs: 13 },
  { n: 61, name: "الصف", ayahs: 14 },{ n: 62, name: "الجمعة", ayahs: 11 },{ n: 63, name: "المنافقون", ayahs: 11 },
  { n: 64, name: "التغابن", ayahs: 18 },{ n: 65, name: "الطلاق", ayahs: 12 },{ n: 66, name: "التحريم", ayahs: 12 },
  { n: 67, name: "الملك", ayahs: 30 },{ n: 68, name: "القلم", ayahs: 52 },{ n: 69, name: "الحاقة", ayahs: 52 },
  { n: 70, name: "المعارج", ayahs: 44 },{ n: 71, name: "نوح", ayahs: 28 },{ n: 72, name: "الجن", ayahs: 28 },
  { n: 73, name: "المزمل", ayahs: 20 },{ n: 74, name: "المدثر", ayahs: 56 },{ n: 75, name: "القيامة", ayahs: 40 },
  { n: 76, name: "الإنسان", ayahs: 31 },{ n: 77, name: "المرسلات", ayahs: 50 },{ n: 78, name: "النبأ", ayahs: 40 },
  { n: 79, name: "النازعات", ayahs: 46 },{ n: 80, name: "عبس", ayahs: 42 },{ n: 81, name: "التكوير", ayahs: 29 },
  { n: 82, name: "الانفطار", ayahs: 19 },{ n: 83, name: "المطففين", ayahs: 36 },{ n: 84, name: "الانشقاق", ayahs: 25 },
  { n: 85, name: "البروج", ayahs: 22 },{ n: 86, name: "الطارق", ayahs: 17 },{ n: 87, name: "الأعلى", ayahs: 19 },
  { n: 88, name: "الغاشية", ayahs: 26 },{ n: 89, name: "الفجر", ayahs: 30 },{ n: 90, name: "البلد", ayahs: 20 },
  { n: 91, name: "الشمس", ayahs: 15 },{ n: 92, name: "الليل", ayahs: 21 },{ n: 93, name: "الضحى", ayahs: 11 },
  { n: 94, name: "الشرح", ayahs: 8 },{ n: 95, name: "التين", ayahs: 8 },{ n: 96, name: "العلق", ayahs: 19 },
  { n: 97, name: "القدر", ayahs: 5 },{ n: 98, name: "البينة", ayahs: 8 },{ n: 99, name: "الزلزلة", ayahs: 8 },
  { n: 100, name: "العاديات", ayahs: 11 },{ n: 101, name: "القارعة", ayahs: 11 },{ n: 102, name: "التكاثر", ayahs: 8 },
  { n: 103, name: "العصر", ayahs: 3 },{ n: 104, name: "الهمزة", ayahs: 9 },{ n: 105, name: "الفيل", ayahs: 5 },
  { n: 106, name: "قريش", ayahs: 4 },{ n: 107, name: "الماعون", ayahs: 7 },{ n: 108, name: "الكوثر", ayahs: 3 },
  { n: 109, name: "الكافرون", ayahs: 6 },{ n: 110, name: "النصر", ayahs: 3 },{ n: 111, name: "المسد", ayahs: 5 },
  { n: 112, name: "الإخلاص", ayahs: 4 },{ n: 113, name: "الفلق", ayahs: 5 },{ n: 114, name: "الناس", ayahs: 6 },
];

function absAyah(surahName: string, ayah: number): number {
  const idx = SURAHS.findIndex(s => s.name === surahName);
  if (idx === -1) return 0;
  let total = 0;
  for (let i = 0; i < idx; i++) total += SURAHS[i].ayahs;
  return total + ayah;
}

// الصفحة الدقيقة (بالكسور) لآية في مصحف المدينة
function pageOf(surahName: string, ayah: number): number {
  const idx = SURAHS.findIndex(s => s.name === surahName);
  if (idx === -1) return 0;
  const surah = SURAHS[idx];
  const startPage = SURAH_START_PAGE[idx];
  const endPage = idx < 113 ? SURAH_START_PAGE[idx + 1] : 605;
  const fraction = Math.max(0, Math.min(1, (ayah - 1) / surah.ayahs));
  return startPage + fraction * (endPage - startPage);
}

// حساب عدد الأوجه (بالكسور) بين نطاقين — يعمل في الاتجاهين
function pagesBetween(s1: string, a1: number, s2: string, a2: number): number {
  const p1 = pageOf(s1, a1);
  const p2 = pageOf(s2, a2);
  return Math.max(0.5, Math.abs(p2 - p1) + 1);
}

function posFromAbs(abs: number): { surah: string; ayah: number } {
  let rem = Math.max(1, abs);
  for (const s of SURAHS) {
    if (rem <= s.ayahs) return { surah: s.name, ayah: rem };
    rem -= s.ayahs;
  }
  const last = SURAHS[SURAHS.length - 1];
  return { surah: last.name, ayah: last.ayahs };
}

// آخر N أيام عمل (بدون الجمعة) من اليوم
function getLastNWorkingDays(today: string, n: number): string[] {
  const dates: string[] = [];
  const d = new Date(today);
  while (dates.length < n) {
    if (d.getDay() !== 5) dates.unshift(d.toISOString().slice(0, 10));
    if (dates.length < n) d.setDate(d.getDate() - 1);
  }
  return dates;
}

// التاريخ الحالي بتوقيت مكة المكرمة (منتصف الليل = بداية اليوم)
function getMeccaTodayServer(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns true if the given day-of-week (0=Sun) is a working day for the track type.
// fixation: only Sun–Wed (0,1,2,3) — skips Thu(4), Fri(5), Sat(6)
// others: skip only Fri(5)
function isWorkingDay(dayOfWeek: number, trackType: string | null): boolean {
  if (trackType === "fixation") return [0, 1, 2, 3].includes(dayOfWeek);
  return dayOfWeek !== 5;
}

// Returns the "last working day" stepping back from `date` (or same day if it's a working day).
function lastWorkingDayBefore(date: string, trackType: string | null): string {
  const d = new Date(date);
  while (!isWorkingDay(d.getDay(), trackType)) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Count working days from `a` (inclusive) up to but not including `b`
function workingDaysBetween(a: string, b: string, trackType: string | null = null): number {
  const start = new Date(a);
  const end = new Date(b);
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    if (isWorkingDay(cur.getDay(), trackType)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Returns 1-based working day number in the current cycle.
// If today is a non-working day, steps back to the last working day.
function workingDayNumber(cycleStart: string, today: string, trackType: string | null = null): number {
  const effective = lastWorkingDayBefore(today, trackType);
  const start = new Date(cycleStart);
  const end = new Date(effective);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (isWorkingDay(cur.getDay(), trackType)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

export function buildPlanEntries(
  startSurah: string, startAyah: number,
  endSurah: string, endAyah: number,
  totalPages: number,
  cycleLength: number = 21,
): PlanDayEntry[] {
  const len = Math.max(1, Math.min(60, cycleLength));
  const absStart = absAyah(startSurah, startAyah);
  const absEnd = absAyah(endSurah, endAyah);
  const totalAyahs = Math.max(1, absEnd - absStart + 1);
  const ayahsPerDay = Math.ceil(totalAyahs / len);
  const pagesPerDay = totalPages / len;

  const entries: PlanDayEntry[] = [];
  let cursor = absStart;

  for (let day = 1; day <= len; day++) {
    const start = posFromAbs(cursor);
    const isLast = day === len;
    const endAbs = isLast ? absEnd : Math.min(cursor + ayahsPerDay - 1, absEnd);
    const end = posFromAbs(endAbs);

    entries.push({
      dayNumber: day,
      surahStart: start.surah,
      ayahStart: start.ayah,
      surahEnd: end.surah,
      ayahEnd: end.ayah,
      pages: Math.round(pagesPerDay * 10) / 10,
    });

    cursor = endAbs + 1;
    if (cursor > absEnd && day < len) cursor = absStart;
  }
  return entries;
}

// Build plan entries from multiple (possibly non-contiguous) memorized sections
export function buildPlanEntriesFromSections(
  sections: Array<{startSurah: string; startAyah: number; endSurah: string; endAyah: number}>,
  totalPages: number,
  cycleLength: number = 21,
): PlanDayEntry[] {
  if (!sections.length) return buildPlanEntries("الفاتحة", 1, "الناس", 6, totalPages, cycleLength);
  const ranges = sections
    .map(s => ({ absStart: absAyah(s.startSurah, s.startAyah), absEnd: absAyah(s.endSurah, s.endAyah) }))
    .filter(r => r.absEnd >= r.absStart);
  if (!ranges.length) return buildPlanEntries("الفاتحة", 1, "الناس", 6, totalPages, cycleLength);
  const totalAyahs = ranges.reduce((s, r) => s + (r.absEnd - r.absStart + 1), 0);
  const len = Math.max(1, Math.min(60, cycleLength));
  const ayahsPerDay = Math.ceil(totalAyahs / len);
  const pagesPerDay = totalPages / len;
  function virtualToAbs(vi: number): number {
    let rem = ((vi % totalAyahs) + totalAyahs) % totalAyahs;
    for (const r of ranges) {
      const slen = r.absEnd - r.absStart + 1;
      if (rem < slen) return r.absStart + rem;
      rem -= slen;
    }
    return ranges[ranges.length - 1].absEnd;
  }
  const entries: PlanDayEntry[] = [];
  for (let day = 1; day <= len; day++) {
    const startVi = (day - 1) * ayahsPerDay;
    const endVi = Math.min(day * ayahsPerDay - 1, totalAyahs - 1);
    const start = posFromAbs(virtualToAbs(startVi));
    const end = posFromAbs(virtualToAbs(endVi));
    entries.push({
      dayNumber: day,
      surahStart: start.surah, ayahStart: start.ayah,
      surahEnd: end.surah, ayahEnd: end.ayah,
      pages: Math.round(pagesPerDay * 10) / 10,
    });
  }
  return entries;
}

// ── مسار التثبيت: حساب حالة اليوم بناءً على نطاق التثبيت الجديد ──────────
// يفحص إذا كان أي سجل في الدورة (حتى تاريخ اليوم المحدد) يغطي نطاق الخطة لهذا اليوم
function getFixationDayStatus(
  planEntry: PlanDayEntry,
  allCycleRecords: (typeof recordsTable.$inferSelect)[],
  planDayDate: string,
): { exceeded: boolean; completed: boolean; partial: boolean; absent: boolean; actual: number; planned: number } {
  const planned = planEntry.pages;
  const plannedStartAbs = absAyah(planEntry.surahStart, planEntry.ayahStart);
  const plannedEndAbs = absAyah(planEntry.surahEnd, planEntry.ayahEnd);

  // سجلات هذا اليوم تحديدًا (للأوجه الفعلية المعروضة)
  const dayRecs = allCycleRecords.filter(r => r.date === planDayDate);
  const isAbsentToday = dayRecs.some(r => r.isAbsent);
  const actualPagesThisDay = dayRecs.reduce((s, r) => s + (r.memorizePages ?? 0), 0);

  // جميع السجلات حتى هذا اليوم التي تحتوي على نطاق التثبيت الجديد
  const rangeRecords = allCycleRecords.filter(
    r => r.date <= planDayDate && !r.isAbsent && r.memorizeSurahStart && r.memorizeSurahEnd,
  );

  for (const rec of rangeRecords) {
    const actualStartAbs = absAyah(rec.memorizeSurahStart!, rec.memorizeAyahStart ?? 1);
    const actualEndAbs = absAyah(rec.memorizeSurahEnd!, rec.memorizeAyahEnd ?? 1);

    // هل يغطي هذا السجل النطاق المخطط لهذا اليوم بالكامل؟
    if (actualStartAbs <= plannedStartAbs && actualEndAbs >= plannedEndAbs) {
      const exceeded = actualEndAbs > plannedEndAbs || actualStartAbs < plannedStartAbs;
      return {
        exceeded,
        completed: true,
        partial: false,
        absent: false,
        actual: actualPagesThisDay > 0 ? actualPagesThisDay : planned,
        planned,
      };
    }

    // تغطية جزئية؟
    const overlapStart = Math.max(actualStartAbs, plannedStartAbs);
    const overlapEnd = Math.min(actualEndAbs, plannedEndAbs);
    if (overlapEnd >= overlapStart) {
      // يوجد تداخل جزئي — نرجع جزئي (لكن نكمل البحث عن تغطية كاملة)
      // سنكتفي بأول تداخل جزئي كنتيجة احتياطية
      const fallbackActual = actualPagesThisDay > 0 ? actualPagesThisDay : Math.round(planned * 0.5 * 10) / 10;
      return {
        exceeded: false,
        completed: false,
        partial: true,
        absent: false,
        actual: fallbackActual,
        planned,
      };
    }
  }

  // لا يوجد تغطية بالنطاق — نرجع للمقارنة بعدد الأوجه
  if (!isAbsentToday && actualPagesThisDay > 0) {
    return {
      exceeded: actualPagesThisDay > planned,
      completed: actualPagesThisDay >= planned,
      partial: actualPagesThisDay > 0 && actualPagesThisDay < planned,
      absent: false,
      actual: actualPagesThisDay,
      planned,
    };
  }

  return { exceeded: false, completed: false, partial: false, absent: true, actual: 0, planned };
}

function calcMissedDays(
  plan: typeof reviewPlansTable.$inferSelect,
  records: (typeof recordsTable.$inferSelect)[],
): number {
  const cycleStart = plan.currentCycleStart ?? plan.startDate;
  const isFixation = plan.trackType === "fixation";

  if (isFixation) {
    // مسار التثبيت: نحسب الأيام المفقودة بناءً على تغطية النطاق
    // نبني قائمة أيام العمل في آخر 30 يوم ونفحص كل يوم
    let missed = 0;
    const today = getMeccaTodayServer();
    const thirtyDaysAgo = addDays(today, -30);
    const workingDates: string[] = [];
    {
      const cur = new Date(thirtyDaysAgo);
      const end = new Date(today);
      while (cur <= end) {
        const ds = cur.toISOString().slice(0, 10);
        if (isWorkingDay(cur.getDay(), "fixation")) workingDates.push(ds);
        cur.setDate(cur.getDate() + 1);
      }
    }
    for (const dateStr of workingDates) {
      const dayRecs = records.filter(r => r.date === dateStr);
      if (dayRecs.length === 0) continue;
      if (dayRecs.some(r => r.isAbsent)) { missed++; continue; }
      // يوجد سجل — فحص تغطية النطاق أو الأوجه
      const workingDayIdx = workingDaysBetween(cycleStart, dateStr, "fixation") % plan.cycleLength;
      const entry = plan.planEntries[workingDayIdx];
      if (!entry) continue;
      const status = getFixationDayStatus(entry, records, dateStr);
      if (status.absent || (!status.completed && !status.partial && !status.exceeded)) {
        missed++;
      }
    }
    return missed;
  }

  let missed = 0;
  for (const r of records) {
    if (!isWorkingDay(new Date(r.date).getDay(), plan.trackType)) continue;
    const workingDayIdx = workingDaysBetween(cycleStart, r.date, plan.trackType) % plan.cycleLength;
    const entry = plan.planEntries[workingDayIdx];
    const planned = entry?.pages ?? (plan.totalPages / plan.cycleLength);
    if (r.isAbsent) {
      missed++;
    } else {
      const actual = plan.trackType === "simple_review"
        ? (r.memorizePages ?? 0)
        : (r.reviewFarPages ?? 0);
      if (actual < planned * 0.8) missed++;
    }
  }
  return missed;
}

function fmtPlan(plan: typeof reviewPlansTable.$inferSelect, extra: Record<string, unknown> = {}) {
  return { ...plan, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt?.toISOString() ?? null, ...extra };
}

// ── GET /api/students/:id/review-plan ──────────────────────────────────────
router.get("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  if (!["leader","track_supervisor","teacher","supervisor","student"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const studentId = parseInt(req.params.id as string);
  const [plan] = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.studentId, studentId));
  if (!plan) { res.json(null); return; }

  const today = getMeccaTodayServer();
  const cycleStart = plan.currentCycleStart ?? plan.startDate;
  const rawWorkingDay = workingDayNumber(cycleStart, today, plan.trackType);
  const dayInCycle = Math.min(rawWorkingDay, plan.cycleLength);
  const isFriday = !isWorkingDay(new Date(today).getDay(), plan.trackType);

  const thirtyDaysAgo = addDays(today, -30);
  const recentRecords = await db.select().from(recordsTable)
    .where(and(eq(recordsTable.studentId, studentId), gte(recordsTable.date, thirtyDaysAgo), lte(recordsTable.date, today)));

  const missedDaysLast30 = calcMissedDays(plan, recentRecords);
  const todayEntry = plan.planEntries[(dayInCycle - 1)] ?? null;
  const plannedPagesForToday = todayEntry?.pages ?? (plan.totalPages / plan.cycleLength);
  const todayRecords = recentRecords.filter(r => r.date === today);
  // المراجعة البعيدة فقط تُستخدم لحساب النصاب الفعلي والتعثر
  const useMemoForTrack = plan.trackType === "simple_review" || plan.trackType === "fixation";
  const actualPagesForToday = todayRecords.reduce((s, r) => s + (
    useMemoForTrack ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)
  ), 0);
  const cycleFarPages = recentRecords
    .filter(r => r.date >= cycleStart && !r.isAbsent)
    .reduce((s, r) => s + (
      useMemoForTrack ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)
    ), 0);
  const isCompletedEarly = cycleFarPages >= plan.totalPages && rawWorkingDay < plan.cycleLength;

  // ── Build per-day performance for current cycle ────────────────────────────
  // Fetch all records from cycle start (not just last 30)
  const cycleRecords = await db.select().from(recordsTable)
    .where(and(eq(recordsTable.studentId, studentId), gte(recordsTable.date, cycleStart), lte(recordsTable.date, today)));

  const dayPerformance: { dayNumber: number; date: string; exceeded: boolean; completed: boolean; partial: boolean; absent: boolean; actual: number; planned: number }[] = [];
  {
    const isFixationTrack = plan.trackType === "fixation";
    let wd = 0;
    const cur = new Date(cycleStart);
    const todayD = new Date(today);
    while (cur <= todayD) {
      const dayStr = cur.toISOString().slice(0, 10);
      if (isWorkingDay(cur.getDay(), plan.trackType)) {
        wd++;
        if (wd <= plan.cycleLength) {
          const entry = plan.planEntries[wd - 1];
          const planned = entry?.pages ?? (plan.totalPages / plan.cycleLength);
          const dayRecs = cycleRecords.filter(r => r.date === dayStr);
          const isAbsent = dayRecs.some(r => r.isAbsent);
          const actual = (plan.trackType === "simple_review" || isFixationTrack)
            ? dayRecs.reduce((s, r) => s + (r.memorizePages ?? 0), 0)
            : dayRecs.reduce((s, r) => s + (r.reviewFarPages ?? 0), 0);

          if (isFixationTrack) {
            // مسار التثبيت — الأداء يُحسب بناءً على نطاق التثبيت الجديد (السور والآيات)
            // أي إدخال يغطي نطاق يوم ما (حتى من يوم سابق) يُعلَّم كمنجز
            // هذا يسمح بتسجيل تقدم على الخطة لو الطالبة ثبتت نطاقًا أكبر من المخطط لليوم
            if (!entry) continue;
            // نُظهر الأداء فقط إذا اليوم ماضٍ أو اليوم الحالي مع وجود بيانات
            if (dayStr < today || (dayStr === today && actual > 0)) {
              // تحقق من تغطية النطاق — إذا يوم غياب صريح فهو غياب
              if (isAbsent) {
                dayPerformance.push({
                  dayNumber: wd, date: dayStr,
                  exceeded: false, completed: false, partial: false, absent: true,
                  actual: 0, planned: Math.round(planned * 10) / 10,
                });
              } else {
                const status = getFixationDayStatus(entry, cycleRecords, dayStr);
                dayPerformance.push({
                  dayNumber: wd,
                  date: dayStr,
                  exceeded: status.exceeded,
                  completed: status.completed,
                  partial: status.partial,
                  absent: status.absent,
                  actual: Math.round(status.actual * 10) / 10,
                  planned: Math.round(status.planned * 10) / 10,
                });
              }
            } else if (dayStr < today) {
              // يوم ماضٍ بدون أي سجل → غياب
              dayPerformance.push({
                dayNumber: wd, date: dayStr,
                exceeded: false, completed: false, partial: false, absent: true,
                actual: 0, planned: Math.round(planned * 10) / 10,
              });
            }
          } else {
            // باقي المسارات — النسب المئوية الحالية
            if (dayStr < today || (dayStr === today && actual > 0)) {
              dayPerformance.push({
                dayNumber: wd,
                date: dayStr,
                exceeded: !isAbsent && planned > 0 && actual > planned,
                completed: !isAbsent && actual >= planned * 0.8,
                partial: !isAbsent && actual > 0 && actual >= planned * 0.4 && actual < planned * 0.8,
                absent: isAbsent,
                actual: Math.round(actual * 10) / 10,
                planned: Math.round(planned * 10) / 10,
              });
            }
          }
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const planLockedMs = 48 * 60 * 60 * 1000;
  const planTime = plan.updatedAt ? new Date(plan.updatedAt).getTime() : new Date(plan.createdAt).getTime();
  const isLocked = Date.now() - planTime > planLockedMs;

  res.json(fmtPlan(plan, {
    dayInCycle, cycleStart, todayEntry,
    plannedPagesForToday: Math.round(plannedPagesForToday * 10) / 10,
    actualPagesForToday: Math.round(actualPagesForToday * 10) / 10,
    cycleFarPages: Math.round(cycleFarPages * 10) / 10,
    isCompletedEarly,
    missedDaysLast30,
    isStumbling: missedDaysLast30 >= 3,
    currentCycleNum: plan.cycleCount,
    isFriday,
    history: (plan.previousPlans ?? []) as PlanSnapshot[],
    dayPerformance,
    isLocked,
  }));
});

// ── POST /api/students/:id/review-plan — create or renew ──────────────────
router.post("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  const studentId = parseInt(req.params.id as string);

  if (req.userRole === "student") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const conditions: Parameters<typeof and>[0][] = [eq(studentsTable.fullName, me?.name ?? "")];
    if (me?.circleId) conditions.push(eq(studentsTable.circleId, me.circleId));
    const [myStudent] = await db.select().from(studentsTable).where(and(...conditions));
    if (!myStudent || myStudent.id !== studentId) { res.status(403).json({ error: "Forbidden" }); return; }
  } else if (req.userRole === "teacher") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
    if (!me?.circleId || me.circleId !== student?.circleId) { res.status(403).json({ error: "Forbidden" }); return; }
  } else if (req.userRole === "supervisor") {
    // supervisor: can create plans for students in circles they supervise
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
    const [circle] = student?.circleId ? await db.select().from(circlesTable).where(eq(circlesTable.id, student.circleId)) : [null];
    if (!circle || circle.supervisorId !== me?.id) { res.status(403).json({ error: "Forbidden" }); return; }
  } else if (!["leader","track_supervisor","data_entry"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const body = req.body as {
    planType?: "auto" | "manual";
    planEntries?: PlanDayEntry[];
    memorizedUpToSurah?: string;
    memorizedUpToAyah?: number;
    startSurah?: string;
    startAyah?: number;
    totalPages?: number;
    theme?: PlanTheme;
    cycleLength?: number;
    memorizedSections?: Array<{startSurah: string; startAyah: number; endSurah: string; endAyah: number}>;
    startDate?: string;
  };

  const { planType = "auto", theme } = body;
  const cycleLength = Math.max(7, Math.min(60, Number(body.cycleLength) || 21));

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student?.circleId) { res.status(400).json({ error: "الطالبة ليست في حلقة" }); return; }

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, student.circleId));
  const trackType = (circle as any)?.trackType ?? "girls";

  if (trackType !== "girls" && trackType !== "fixation") {
    res.status(400).json({ error: "خطة المراجعة متاحة فقط لمسار الفتيات والتثبيت" }); return;
  }

  const allRecords = await db.select().from(recordsTable)
    .where(eq(recordsTable.studentId, studentId))
    .orderBy(desc(recordsTable.date));

  const sections = body.memorizedSections ?? [];
  // حساب عدد الأوجه بدقة باستخدام مصحف المدينة
  const totalPagesFromSections = sections.length
    ? Math.max(1, Math.round(sections.reduce((s, sec) =>
        s + pagesBetween(sec.startSurah, sec.startAyah, sec.endSurah, sec.endAyah)
      , 0) * 10) / 10)
    : null;

  const latestNonAbsent = allRecords.find(r => !r.isAbsent && r.memorizeSurahEnd);
  const oldestNonAbsent = [...allRecords].reverse().find(r => !r.isAbsent && r.memorizeSurahStart);

  const startSurah = body.startSurah ?? oldestNonAbsent?.memorizeSurahStart ?? "الفاتحة";
  const startAyah = body.startAyah ?? oldestNonAbsent?.memorizeAyahStart ?? 1;
  const endSurah = body.memorizedUpToSurah ?? latestNonAbsent?.memorizeSurahEnd ?? startSurah;
  const endAyah = body.memorizedUpToAyah ?? latestNonAbsent?.memorizeAyahEnd ?? startAyah;

  // حساب المجموع الكلي بمصحف المدينة إذا لم يُحدَّد يدويًا ولا عبر نطاقات
  const totalPagesFromRange = Math.max(1, Math.round(pagesBetween(startSurah, startAyah, endSurah, endAyah) * 10) / 10);
  const totalPages = body.totalPages ?? totalPagesFromSections ?? totalPagesFromRange;

  const today = getMeccaTodayServer();
  const planStartDate = body.startDate ?? today;

  const planEntries: PlanDayEntry[] = (planType === "manual" && body.planEntries?.length)
    ? body.planEntries
    : sections.length
      ? buildPlanEntriesFromSections(sections, totalPages, cycleLength)
      : buildPlanEntries(startSurah, startAyah, endSurah, endAyah, totalPages, cycleLength);

  const defaultTheme: PlanTheme = { primaryColor: "#059669", secondaryColor: "#d1fae5", accentColor: "#065f46", bgPattern: "plain", fontStyle: "rounded" };

  const [existing] = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.studentId, studentId));

  // قيد التجديد: لا يُسمح بتجديد الخطة قبل اكتمال الدورة أو مرور ٢١ يوم عمل (سبت–خميس)
  if (existing) {
    const cycleStartForCheck = existing.currentCycleStart ?? existing.startDate;
    const rawWDForCheck = workingDayNumber(cycleStartForCheck, today);
    const workingDaysPassed = workingDaysBetween(cycleStartForCheck, today);
    const cycleComplete = rawWDForCheck > existing.cycleLength;
    if (!cycleComplete && workingDaysPassed < 21) {
      const remaining = 21 - workingDaysPassed;
      res.status(400).json({
        error: `لا يمكن تجديد الخطة قبل اكتمال الدورة أو مرور ٢١ يوم عمل (باقي ${remaining} يوم)`,
      });
      return;
    }
  }

  // Helper: insert plan notification — fires for all roles so teacher/supervisor see it
  async function insertPlanNotification(
    type: "plan_created" | "plan_renewed",
    cycleCount: number,
    pages: number,
  ) {
    const [cir] = student.circleId
      ? await db.select().from(circlesTable).where(eq(circlesTable.id, student.circleId))
      : [null];
    if (!cir) return;
    // Delete any unread notification for the same student (replace with fresh one)
    await db.delete(planNotificationsTable)
      .where(eq(planNotificationsTable.studentId, studentId));
    await db.insert(planNotificationsTable).values({
      studentId,
      studentName: student.fullName,
      circleId: cir.id,
      circleName: cir.name,
      track: cir.track ?? "",
      type,
      cycleCount,
      totalPages: pages,
      isRead: false,
    });
  }

  if (existing) {
    const snapshot: PlanSnapshot = {
      cycleCount: existing.cycleCount,
      startDate: existing.currentCycleStart ?? existing.startDate,
      endDate: today,
      totalPages: existing.totalPages,
      memorizedUpToSurah: existing.memorizedUpToSurah ?? undefined,
      memorizedUpToAyah: existing.memorizedUpToAyah ?? undefined,
      planType: existing.planType,
    };
    const prevHistory = (existing.previousPlans ?? []) as PlanSnapshot[];
    const [updated] = await db.update(reviewPlansTable).set({
      planType, cycleCount: existing.cycleCount + 1,
      totalPages, cycleLength, currentCycleStart: planStartDate,
      memorizedUpToSurah: endSurah, memorizedUpToAyah: endAyah,
      planEntries, theme: theme ?? existing.theme, status: "active",
      previousPlans: [...prevHistory, snapshot],
    }).where(eq(reviewPlansTable.studentId, studentId)).returning();
    await insertPlanNotification("plan_renewed", updated.cycleCount, updated.totalPages);
    res.json(fmtPlan(updated, { renewed: true }));
  } else {
    const [plan] = await db.insert(reviewPlansTable).values({
      studentId, trackType, planType, cycleCount: 1,
      totalPages, cycleLength, startDate: planStartDate,
      currentCycleStart: planStartDate,
      memorizedUpToSurah: endSurah, memorizedUpToAyah: endAyah,
      planEntries, theme: theme ?? defaultTheme, status: "active",
      previousPlans: [],
    }).returning();
    await insertPlanNotification("plan_created", 1, plan.totalPages);
    res.status(201).json(fmtPlan(plan));
  }
});

// ── PATCH /api/students/:id/review-plan — update entries or theme ──────────
router.patch("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  // Only teacher and student can edit plans
  if (!["teacher", "student"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const studentId = parseInt(req.params.id as string);

  // Student can only edit their own plan
  if (req.userRole === "student") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const conditions: Parameters<typeof and>[0][] = [eq(studentsTable.fullName, me?.name ?? "")];
    if (me?.circleId) conditions.push(eq(studentsTable.circleId, me.circleId));
    const [myStudent] = await db.select().from(studentsTable).where(and(...conditions));
    if (!myStudent || myStudent.id !== studentId) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  // Teacher can only edit plans for students in their circle
  if (req.userRole === "teacher") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
    if (!me?.circleId || me.circleId !== student?.circleId) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const [plan] = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.studentId, studentId));
  if (!plan) { res.status(404).json({ error: "لا توجد خطة" }); return; }

  // Check 48-hour edit window
  const planTime = plan.updatedAt ? new Date(plan.updatedAt).getTime() : new Date(plan.createdAt).getTime();
  const LOCK_MS = 48 * 60 * 60 * 1000;
  if (Date.now() - planTime > LOCK_MS) {
    res.status(403).json({ error: "انتهت فترة التعديل المسموحة (٤٨ ساعة من إنشاء الخطة)" }); return;
  }

  const { planEntries, planType, theme } = req.body as {
    planEntries?: PlanDayEntry[]; planType?: "manual"|"auto"; theme?: PlanTheme;
  };

  const updates: Partial<typeof reviewPlansTable.$inferInsert> = {};
  if (planEntries) updates.planEntries = planEntries;
  if (planType) updates.planType = planType;
  if (theme) updates.theme = theme;

  const [updated] = await db.update(reviewPlansTable).set(updates)
    .where(eq(reviewPlansTable.studentId, studentId)).returning();
  res.json(fmtPlan(updated));
});

// ── GET /api/review-plans/students-plans-list — overview for teacher/supervisor/leader ──
router.get("/review-plans/students-plans-list", authenticate, async (req, res): Promise<void> => {
  const role = req.userRole!;
  if (!["leader", "track_supervisor", "teacher", "supervisor"].includes(role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const allCircles = await db.select().from(circlesTable);
  const allStudents = await db.select().from(studentsTable);
  const allTracks = await db.select().from(tracksTable);

  // Helper: effective track type (uses tracksTable.dataEntryType if trackId is set)
  function effectiveTrackType(c: typeof allCircles[0]): string {
    if (c.trackId) {
      const t = allTracks.find(t => t.id === c.trackId);
      if (t) return t.dataEntryType;
    }
    return c.trackType ?? "girls";
  }

  // خطط المراجعة خاصة بمسار الفتيات والتثبيت
  const targetCircles = allCircles.filter(c => {
    const t = effectiveTrackType(c);
    return !c.isArchived && (t === "girls" || t === "fixation");
  });

  let allowedCircleIds: number[];
  if (role === "teacher" || role === "supervisor") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    allowedCircleIds = targetCircles.filter(c => c.id === me?.circleId).map(c => c.id);
  } else if (role === "track_supervisor") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const myTrack = allTracks.find(t => t.name === me?.track);
    allowedCircleIds = myTrack
      ? targetCircles.filter(c => c.trackId === myTrack.id).map(c => c.id)
      : [];
  } else {
    allowedCircleIds = targetCircles.map(c => c.id);
  }

  if (!allowedCircleIds.length) {
    res.json({ withPlan: [], withoutPlan: [] }); return;
  }

  const students = allStudents.filter(s =>
    s.circleId && allowedCircleIds.includes(s.circleId) && !s.isArchived
  );
  if (!students.length) {
    res.json({ withPlan: [], withoutPlan: [] }); return;
  }

  const activePlans = await db.select().from(reviewPlansTable)
    .where(eq(reviewPlansTable.status, "active"));

  const planByStudent: Record<number, typeof activePlans[0]> = {};
  for (const p of activePlans) planByStudent[p.studentId] = p;

  const today = getMeccaTodayServer();
  const thirtyDaysAgo = addDays(today, -30);

  // Batch fetch recent records for all students
  const studentIds = students.map(s => s.id);
  const recentRecords = await db.select().from(recordsTable)
    .where(and(gte(recordsTable.date, thirtyDaysAgo), lte(recordsTable.date, today)));
  const recordsByStudent: Record<number, typeof recentRecords> = {};
  for (const r of recentRecords) {
    if (!studentIds.includes(r.studentId)) continue;
    if (!recordsByStudent[r.studentId]) recordsByStudent[r.studentId] = [];
    recordsByStudent[r.studentId].push(r);
  }

  const weekDates = getLastNWorkingDays(today, 6);

  const withPlan: unknown[] = [];
  const withoutPlan: unknown[] = [];

  for (const student of students) {
    const circle = allCircles.find(c => c.id === student.circleId);
    const plan = planByStudent[student.id];

    const circleEffectiveType = circle ? effectiveTrackType(circle) : "girls";

    if (!plan) {
      withoutPlan.push({
        id: student.id,
        name: student.fullName,
        circleId: student.circleId,
        circleName: circle?.name ?? "",
        trackType: circleEffectiveType,
        track: circle?.track ?? "",
      });
    } else {
      const cycleStart = plan.currentCycleStart ?? plan.startDate;
      const rawDay = workingDayNumber(cycleStart, today);
      const dayInCycle = Math.min(rawDay, plan.cycleLength);
      const isCompleted = rawDay > plan.cycleLength;
      const studentRecords = recordsByStudent[student.id] ?? [];
      const missedDaysLast30 = calcMissedDays(plan, studentRecords);

      // حساب isCompletedEarly: أتمّت نصابها قبل انتهاء الدورة
      const cycleRecordsForStudent = studentRecords.filter(r => r.date >= cycleStart && !r.isAbsent);
      const cycleFarPages = cycleRecordsForStudent.reduce((s, r) =>
        s + ((circleEffectiveType === "simple_review" || circleEffectiveType === "fixation") ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)), 0);
      const isCompletedEarly = cycleFarPages >= plan.totalPages && rawDay <= plan.cycleLength;

      // التقرير الأسبوعي: آخر 6 أيام عمل
      const weeklyProgress = weekDates.map(date => {
        const dayRecs = studentRecords.filter(r => r.date === date);
        const hasRecord = dayRecs.length > 0;
        const isAbsent = dayRecs.some(r => r.isAbsent);
        const actual = dayRecs.reduce((s, r) =>
          s + ((circleEffectiveType === "simple_review" || circleEffectiveType === "fixation") ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)), 0);
        const cycleWD = workingDayNumber(cycleStart, date);
        const entry = plan.planEntries[cycleWD - 1];
        const planned = Math.round((entry?.pages ?? (plan.totalPages / plan.cycleLength)) * 10) / 10;
        return { date, planned, actual: Math.round(actual * 10) / 10, absent: isAbsent, hasRecord };
      });

      // Check if plan was recently renewed (within last 14 days) = just completed a cycle
      const prevPlans = (plan.previousPlans ?? []) as PlanSnapshot[];
      const lastSnap = prevPlans.length > 0 ? prevPlans[prevPlans.length - 1] : null;
      const justRenewed = !!lastSnap && daysBetween(lastSnap.endDate, today) <= 14;

      withPlan.push({
        id: student.id,
        name: student.fullName,
        circleId: student.circleId,
        circleName: circle?.name ?? "",
        trackType: circleEffectiveType,
        track: circle?.track ?? "",
        planId: plan.id,
        planType: plan.planType,
        cycleCount: plan.cycleCount,
        cycleLength: plan.cycleLength,
        totalPages: plan.totalPages,
        dayInCycle,
        isCompleted,
        isCompletedEarly,
        justRenewed,
        missedDaysLast30,
        isStumbling: missedDaysLast30 >= 3,
        memorizedUpToSurah: plan.memorizedUpToSurah,
        currentCycleStart: cycleStart,
        theme: plan.theme,
        weeklyProgress,
        weekDates,
      });
    }
  }

  // تجميع البيانات حسب الحلقة لعرض التفاصيل لمسؤولة المسار
  const byCircleMap: Record<number, {
    circleId: number; circleName: string;
    students: {
      id: number; name: string; hasPlan: boolean;
      dayInCycle?: number; cycleLength?: number; pct?: number;
      isCompleted?: boolean; isCompletedEarly?: boolean;
      isStumbling?: boolean; memorizedUpToSurah?: string;
    }[];
  }> = {};

  for (const student of students) {
    const circle = allCircles.find(c => c.id === student.circleId);
    const cid = student.circleId ?? 0;
    const cname = circle?.name ?? "";
    if (!byCircleMap[cid]) byCircleMap[cid] = { circleId: cid, circleName: cname, students: [] };

    const plan = planByStudent[student.id];
    if (!plan) {
      byCircleMap[cid].students.push({ id: student.id, name: student.fullName, hasPlan: false });
    } else {
      const cycleStart = plan.currentCycleStart ?? plan.startDate;
      const rawDay = workingDayNumber(cycleStart, today);
      const dayInCycle = Math.min(rawDay, plan.cycleLength);
      const isCompleted = rawDay > plan.cycleLength;
      const pct = Math.min(100, Math.round((dayInCycle / plan.cycleLength) * 100));
      const studentRecords = recordsByStudent[student.id] ?? [];
      const missedDaysLast30 = calcMissedDays(plan, studentRecords);
      const circleEffType = circle ? effectiveTrackType(circle) : "girls";
      const cycleRecs = studentRecords.filter(r => r.date >= cycleStart && !r.isAbsent);
      const cycleFarPgs = cycleRecs.reduce((s, r) => s + (r.reviewFarPages ?? 0), 0);
      const isCompletedEarly = cycleFarPgs >= plan.totalPages && rawDay <= plan.cycleLength;
      byCircleMap[cid].students.push({
        id: student.id,
        name: student.fullName,
        hasPlan: true,
        dayInCycle,
        cycleLength: plan.cycleLength,
        pct,
        isCompleted,
        isCompletedEarly,
        isStumbling: missedDaysLast30 >= 3,
        memorizedUpToSurah: plan.memorizedUpToSurah ?? undefined,
      });
    }
  }

  const byCircle = Object.values(byCircleMap).sort((a, b) => a.circleName.localeCompare(b.circleName, "ar"));

  res.json({ withPlan, withoutPlan, byCircle });
});

// ── GET /api/review-plans/teacher-notifications — unread plan notifs ───────
router.get("/review-plans/teacher-notifications", authenticate, async (req, res): Promise<void> => {
  if (!["teacher", "supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  // Find the teacher's circle
  const teacherUser = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!teacherUser.length) { res.json([]); return; }
  const teacherCircle = await db.select().from(circlesTable)
    .where(eq(circlesTable.teacherId, req.userId!)).limit(1);
  if (!teacherCircle.length) { res.json([]); return; }
  const circleId = teacherCircle[0].id;
  const notifs = await db.select().from(planNotificationsTable)
    .where(and(
      eq(planNotificationsTable.circleId, circleId),
      eq(planNotificationsTable.isRead, false),
    ))
    .orderBy(desc(planNotificationsTable.createdAt));
  res.json(notifs);
});

// ── PATCH /api/review-plans/teacher-notifications/:id/read ─────────────────
router.patch("/review-plans/teacher-notifications/:id/read", authenticate, async (req, res): Promise<void> => {
  if (!["teacher", "supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const id = parseInt(req.params.id as string);
  await db.update(planNotificationsTable).set({ isRead: true })
    .where(eq(planNotificationsTable.id, id));
  res.json({ ok: true });
});

// ── GET /api/circles/:id/review-plans — teacher/supervisor view ───────────
router.get("/circles/:id/review-plans", authenticate, async (req, res): Promise<void> => {
  if (!["leader","track_supervisor","teacher","supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const circleId = parseInt(req.params.id as string);
  const students = await db.select().from(studentsTable)
    .where(and(eq(studentsTable.circleId, circleId), eq(studentsTable.isArchived, false)));
  if (!students.length) { res.json([]); return; }

  const studentIds = students.map(s => s.id);
  const plans = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.status, "active"));
  const circlePlans = plans.filter(p => studentIds.includes(p.studentId));
  if (!circlePlans.length) { res.json([]); return; }

  const today = getMeccaTodayServer();
  const thirtyDaysAgo = addDays(today, -30);
  const allRecords = await db.select().from(recordsTable)
    .where(and(eq(recordsTable.circleId, circleId), gte(recordsTable.date, thirtyDaysAgo), lte(recordsTable.date, today)));

  res.json(circlePlans.map(plan => {
    const student = students.find(s => s.id === plan.studentId);
    const cycleStart = plan.currentCycleStart ?? plan.startDate;
    const daysIn = Math.max(0, daysBetween(cycleStart, today));
    const dayInCycle = (daysIn % plan.cycleLength) + 1;
    const studentRecords = allRecords.filter(r => r.studentId === plan.studentId);
    const missedDaysLast30 = calcMissedDays(plan, studentRecords);
    return {
      studentId: plan.studentId,
      studentName: student?.fullName ?? "غير معروف",
      planType: plan.planType, cycleCount: plan.cycleCount,
      dayInCycle, totalPages: plan.totalPages,
      missedDaysLast30, isStumbling: missedDaysLast30 >= 3,
      theme: plan.theme, planEntries: plan.planEntries,
      memorizedUpToSurah: plan.memorizedUpToSurah,
      memorizedUpToAyah: plan.memorizedUpToAyah,
      currentCycleStart: cycleStart,
    };
  }));
});

export default router;
