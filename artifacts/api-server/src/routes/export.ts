import { Router, type IRouter } from "express";
import ExcelJS from "exceljs";
import path from "path";
import fs from "fs";
import {
  db, studentsTable, usersTable, circlesTable, recordsTable,
  studentTransfersTable, studentArchiveEventsTable,
  teacherAbsencesTable, dailyCircleTasksTable, trackSupervisorNamesTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/authenticate";
import { runWeeklyBackup, listBackups, getBackupPath } from "../lib/backup";

const router: IRouter = Router();

const ROLE_LABELS: Record<string, string> = {
  leader: "قائدة",
  teacher: "معلمة",
  supervisor: "مشرفة",
  track_supervisor: "مسؤولة مسار",
  deputy: "نائبة",
  data_entry: "مدخلة بيانات",
  student: "طالبة",
};

function styleHeader(ws: ExcelJS.Worksheet) {
  const headerRow = ws.getRow(1);
  headerRow.eachCell(cell => {
    cell.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF3B4A8A" } };
    cell.alignment = { horizontal: "center", vertical: "middle", readingOrder: "rtl" };
    cell.border = { bottom: { style: "thin", color: { argb: "FFB0B8D8" } } };
  });
  headerRow.height = 24;
}

function addSheet(
  wb: ExcelJS.Workbook,
  sheetName: string,
  headers: string[],
  colWidths: number[],
  rows: Record<string, unknown>[],
) {
  const ws = wb.addWorksheet(sheetName, { views: [{ rightToLeft: true }] });
  ws.columns = headers.map((h, i) => ({ header: h, key: h, width: colWidths[i] ?? 16 }));
  for (const row of rows) ws.addRow(row);
  styleHeader(ws);
  ws.eachRow((row, rn) => {
    if (rn === 1) return;
    row.eachCell(cell => {
      cell.alignment = { horizontal: "right", vertical: "middle", readingOrder: "rtl" };
      cell.border = { bottom: { style: "hair", color: { argb: "FFE0E0E0" } } };
    });
    row.height = 18;
    if (rn % 2 === 0) {
      row.eachCell(cell => {
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF0F2F9" } };
      });
    }
  });
}

async function sendWorkbook(res: any, wb: ExcelJS.Workbook, filename: string) {
  const buffer = await wb.xlsx.writeBuffer();
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}.xlsx`);
  res.send(Buffer.from(buffer));
}

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return "";
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleDateString("ar-SA", { year: "numeric", month: "short", day: "numeric" });
}

// ─── Export: students (multi-sheet) ───────────────────────────────────────────
router.get("/export/students", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  const [students, circles, transfers, archiveEvents, users] = await Promise.all([
    db.select().from(studentsTable).orderBy(studentsTable.createdAt),
    db.select().from(circlesTable),
    db.select().from(studentTransfersTable).orderBy(studentTransfersTable.transferredAt),
    db.select().from(studentArchiveEventsTable).orderBy(studentArchiveEventsTable.eventDate),
    db.select({ id: usersTable.id, name: usersTable.name }).from(usersTable),
  ]);

  const circleMap = new Map(circles.map(c => [c.id, c]));
  const userMap = new Map(users.map(u => [u.id, u.name]));
  const studentMap = new Map(students.map(s => [s.id, s.fullName]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "مقرأة سنا الآي";
  wb.created = new Date();

  // ── Sheet 1: Students list ──
  const allStudents = students;
  addSheet(wb, "الطالبات", [
    "الاسم الكامل", "رقم الجوال", "الدولة", "الفئة العمرية",
    "المستوى التعليمي", "المسار", "اسم الحلقة", "بداية الحفظ",
    "الحالة", "تاريخ التسجيل", "تاريخ الأرشفة",
  ], [30, 18, 14, 14, 18, 14, 22, 18, 12, 16, 16],
  allStudents.map(s => {
    const circle = s.circleId ? circleMap.get(s.circleId) : null;
    let extra: Record<string, string> = {};
    try { if (s.extraData) extra = JSON.parse(s.extraData); } catch { /**/ }
    return {
      "الاسم الكامل": s.fullName,
      "رقم الجوال": s.phone ?? "",
      "الدولة": s.country ?? "",
      "الفئة العمرية": s.ageRange ?? "",
      "المستوى التعليمي": s.educationLevel ?? "",
      "المسار": circle?.track ?? "",
      "اسم الحلقة": circle?.name ?? "",
      "بداية الحفظ": s.memorizeFrom ?? "",
      "الحالة": s.isArchived ? "مؤرشفة" : "نشطة",
      "تاريخ التسجيل": formatDate(s.createdAt),
      "تاريخ الأرشفة": s.archivedAt ? formatDate(s.archivedAt) : "",
    };
  }));

  // ── Sheet 2: Transfers history ──
  addSheet(wb, "تاريخ التنقلات", [
    "اسم الطالبة", "من حلقة", "المسار القديم", "إلى حلقة", "المسار الجديد", "بواسطة", "تاريخ التنقل",
  ], [28, 22, 14, 22, 14, 22, 16],
  transfers.map(t => ({
    "اسم الطالبة": studentMap.get(t.studentId) ?? `#${t.studentId}`,
    "من حلقة": t.fromCircleId ? (circleMap.get(t.fromCircleId)?.name ?? `#${t.fromCircleId}`) : "—",
    "المسار القديم": t.fromCircleId ? (circleMap.get(t.fromCircleId)?.track ?? "") : "",
    "إلى حلقة": circleMap.get(t.toCircleId)?.name ?? `#${t.toCircleId}`,
    "المسار الجديد": circleMap.get(t.toCircleId)?.track ?? "",
    "بواسطة": userMap.get(t.transferredById) ?? `#${t.transferredById}`,
    "تاريخ التنقل": formatDate(t.transferredAt),
  })));

  // ── Sheet 3: Archive / Restore events ──
  addSheet(wb, "أحداث الأرشفة والاسترجاع", [
    "اسم الطالبة", "الحدث", "الحلقة وقت الحدث", "المسار", "بواسطة", "تاريخ الحدث",
  ], [28, 14, 22, 14, 22, 18],
  archiveEvents.map(e => ({
    "اسم الطالبة": studentMap.get(e.studentId) ?? `#${e.studentId}`,
    "الحدث": e.eventType === "archived" ? "أرشفة" : "استرجاع",
    "الحلقة وقت الحدث": e.circleIdAtTime ? (circleMap.get(e.circleIdAtTime)?.name ?? `#${e.circleIdAtTime}`) : "—",
    "المسار": e.circleIdAtTime ? (circleMap.get(e.circleIdAtTime)?.track ?? "") : "",
    "بواسطة": e.performedById ? (userMap.get(e.performedById) ?? `#${e.performedById}`) : "—",
    "تاريخ الحدث": formatDate(e.eventDate),
  })));

  await sendWorkbook(res, wb, `سجل_الطالبات_${new Date().toISOString().slice(0, 10)}`);
});

// ─── Export: staff (multi-sheet with attendance) ───────────────────────────────
router.get("/export/staff", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  const [staff, circles, absences, dailyTasks, supervisorNames] = await Promise.all([
    db.select().from(usersTable).where(eq(usersTable.isArchived, false)),
    db.select().from(circlesTable),
    db.select().from(teacherAbsencesTable).orderBy(teacherAbsencesTable.date),
    db.select().from(dailyCircleTasksTable).orderBy(dailyCircleTasksTable.date),
    db.select().from(trackSupervisorNamesTable),
  ]);

  const circleMap = new Map(circles.map(c => [c.id, c]));
  const supervisorNameMap = new Map(supervisorNames.map(s => [s.id, s.name]));
  const nonStudents = staff.filter(u => u.role !== "student");

  const ATTEND_LABELS: Record<string, string> = {
    present: "حاضرة", absent: "غائبة", late: "متأخرة", excused: "معذورة",
  };

  const wb = new ExcelJS.Workbook();
  wb.creator = "مقرأة سنا الآي";
  wb.created = new Date();

  // ── Sheet 1: Staff list ──
  addSheet(wb, "الموظفات والمتطوعات", [
    "الاسم الكامل", "البريد الإلكتروني", "الدور", "المسار",
    "اسم الحلقة", "رقم الجوال", "الدولة", "الفئة العمرية",
    "آخر دخول", "تاريخ الانضمام",
  ], [28, 28, 16, 14, 22, 16, 14, 14, 16, 16],
  nonStudents.map(u => {
    const circle = u.circleId ? circleMap.get(u.circleId) : null;
    return {
      "الاسم الكامل": u.name,
      "البريد الإلكتروني": u.email,
      "الدور": ROLE_LABELS[u.role] ?? u.role,
      "المسار": u.track ?? circle?.track ?? "",
      "اسم الحلقة": circle?.name ?? "",
      "رقم الجوال": u.phone ?? "",
      "الدولة": u.country ?? "",
      "الفئة العمرية": u.ageRange ?? "",
      "آخر دخول": u.lastLoginAt ? formatDate(u.lastLoginAt) : "لم تدخل بعد",
      "تاريخ الانضمام": formatDate(u.createdAt),
    };
  }));

  // ── Sheet 2: Teacher absences ──
  addSheet(wb, "غيابات المعلمات", [
    "اسم الحلقة", "المسار", "تاريخ الغياب", "أُبلغ بواسطة",
  ], [26, 14, 16, 24],
  absences.map(a => {
    const reportedByUser = staff.find(u => u.id === a.reportedById);
    return {
      "اسم الحلقة": circleMap.get(a.circleId)?.name ?? `#${a.circleId}`,
      "المسار": circleMap.get(a.circleId)?.track ?? "",
      "تاريخ الغياب": a.date,
      "أُبلغ بواسطة": reportedByUser?.name ?? `#${a.reportedById}`,
    };
  }));

  // ── Sheet 3: Daily supervisor tasks (teacher attendance per day) ──
  addSheet(wb, "الحضور اليومي للمعلمات", [
    "التاريخ", "اسم الحلقة", "المسار", "اسم المشرفة", "حضور المعلمة",
    "التحضير", "التحفيز", "التقرير", "عدد الغائبات", "ملاحظات",
  ], [12, 22, 14, 22, 16, 14, 14, 14, 14, 30],
  dailyTasks.map(t => ({
    "التاريخ": t.date,
    "اسم الحلقة": circleMap.get(t.circleId)?.name ?? `#${t.circleId}`,
    "المسار": circleMap.get(t.circleId)?.track ?? "",
    "اسم المشرفة": supervisorNameMap.get(t.supervisorNameId) ?? `#${t.supervisorNameId}`,
    "حضور المعلمة": ATTEND_LABELS[t.teacherAttendance] ?? t.teacherAttendance,
    "التحضير": t.prepStatus,
    "التحفيز": t.motivationStatus,
    "التقرير": t.reportStatus,
    "عدد الغائبات": t.circleAbsenceCount,
    "ملاحظات": t.notes ?? "",
  })));

  await sendWorkbook(res, wb, `سجل_المتطوعات_${new Date().toISOString().slice(0, 10)}`);
});

// ─── Export: data entry records ───────────────────────────────────────────────
router.get("/export/records", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const { from, to } = req.query as { from?: string; to?: string };

  const [students, circles] = await Promise.all([
    db.select().from(studentsTable),
    db.select().from(circlesTable),
  ]);
  const studentMap = new Map(students.map(s => [s.id, s]));
  const circleMap = new Map(circles.map(c => [c.id, c]));

  let records = await db.select().from(recordsTable).orderBy(recordsTable.date);
  if (from) records = records.filter(r => r.date >= from);
  if (to) records = records.filter(r => r.date <= to);

  const wb = new ExcelJS.Workbook();
  wb.creator = "مقرأة سنا الآي";
  wb.created = new Date();

  addSheet(wb, "سجلات الحفظ", [
    "التاريخ", "اسم الطالبة", "المسار", "اسم الحلقة", "الحضور",
    "صفحات الحفظ", "حفظ من", "حفظ إلى",
    "صفحات المراجعة القريبة", "مراجعة قريبة من", "مراجعة قريبة إلى",
    "صفحات المراجعة البعيدة", "مراجعة بعيدة من", "مراجعة بعيدة إلى",
    "صفحات التلاوة", "تلاوة من", "تلاوة إلى",
  ], [12, 24, 14, 20, 10, 14, 22, 22, 18, 22, 22, 18, 22, 22, 14, 22, 22],
  records.map(r => {
    const student = studentMap.get(r.studentId);
    const circle = circleMap.get(r.circleId);
    return {
      "التاريخ": r.date,
      "اسم الطالبة": student?.fullName ?? `#${r.studentId}`,
      "المسار": circle?.track ?? "",
      "اسم الحلقة": circle?.name ?? "",
      "الحضور": r.isAbsent ? "غائبة" : "حاضرة",
      "صفحات الحفظ": r.memorizePages ?? "",
      "حفظ من": r.memorizeSurahStart ? `${r.memorizeSurahStart} آية ${r.memorizeAyahStart ?? ""}` : "",
      "حفظ إلى": r.memorizeSurahEnd ? `${r.memorizeSurahEnd} آية ${r.memorizeAyahEnd ?? ""}` : "",
      "صفحات المراجعة القريبة": r.reviewNearPages ?? "",
      "مراجعة قريبة من": r.reviewNearSurahStart ? `${r.reviewNearSurahStart} آية ${r.reviewNearAyahStart ?? ""}` : "",
      "مراجعة قريبة إلى": r.reviewNearSurahEnd ? `${r.reviewNearSurahEnd} آية ${r.reviewNearAyahEnd ?? ""}` : "",
      "صفحات المراجعة البعيدة": r.reviewFarPages ?? "",
      "مراجعة بعيدة من": r.reviewFarSurahStart ? `${r.reviewFarSurahStart} آية ${r.reviewFarAyahStart ?? ""}` : "",
      "مراجعة بعيدة إلى": r.reviewFarSurahEnd ? `${r.reviewFarSurahEnd} آية ${r.reviewFarAyahEnd ?? ""}` : "",
      "صفحات التلاوة": r.recitationPages ?? "",
      "تلاوة من": r.recitationSurahStart ? `${r.recitationSurahStart} آية ${r.recitationAyahStart ?? ""}` : "",
      "تلاوة إلى": r.recitationSurahEnd ? `${r.recitationSurahEnd} آية ${r.recitationAyahEnd ?? ""}` : "",
    };
  }));

  await sendWorkbook(res, wb, `سجلات_مقرأة_سنا_الآي_${new Date().toISOString().slice(0, 10)}`);
});

// ─── Export: registration submissions (students sheet + volunteers sheet) ────
router.get("/export/registrations", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  const [students, circles, users] = await Promise.all([
    db.select().from(studentsTable).orderBy(desc(studentsTable.createdAt)),
    db.select().from(circlesTable),
    db.select().from(usersTable).orderBy(desc(usersTable.createdAt)),
  ]);

  const circleMap = new Map(circles.map(c => [c.id, c]));

  const wb = new ExcelJS.Workbook();
  wb.creator = "مقرأة سنا الآي";
  wb.created = new Date();

  // ── Sheet 1: Registered students ──
  addSheet(wb, "طلبات تسجيل الطالبات", [
    "الاسم الكامل", "رقم الجوال", "الدولة", "الفئة العمرية",
    "المستوى التعليمي", "المسار", "اسم الحلقة", "بداية الحفظ",
    "الحالة", "تاريخ التسجيل",
  ], [30, 18, 14, 14, 18, 14, 22, 18, 12, 18],
  students.map(s => {
    const circle = s.circleId ? circleMap.get(s.circleId) : null;
    return {
      "الاسم الكامل": s.fullName,
      "رقم الجوال": s.phone ?? "",
      "الدولة": s.country ?? "",
      "الفئة العمرية": s.ageRange ?? "",
      "المستوى التعليمي": s.educationLevel ?? "",
      "المسار": circle?.track ?? "",
      "اسم الحلقة": circle?.name ?? "",
      "بداية الحفظ": s.memorizeFrom ?? "",
      "الحالة": s.isArchived ? "مؤرشفة" : "نشطة",
      "تاريخ التسجيل": formatDate(s.createdAt),
    };
  }));

  // ── Sheet 2: Registered volunteers/staff ──
  const volunteers = users.filter(u => u.role !== "student");
  addSheet(wb, "طلبات تسجيل المتطوعات", [
    "الاسم الكامل", "البريد الإلكتروني", "الدور", "المسار",
    "اسم الحلقة", "رقم الجوال", "الدولة", "الفئة العمرية",
    "المستوى التعليمي", "تاريخ التسجيل",
  ], [28, 28, 16, 14, 22, 16, 14, 14, 18, 18],
  volunteers.map(u => {
    const circle = u.circleId ? circleMap.get(u.circleId) : null;
    return {
      "الاسم الكامل": u.name,
      "البريد الإلكتروني": u.email,
      "الدور": ROLE_LABELS[u.role] ?? u.role,
      "المسار": u.track ?? circle?.track ?? "",
      "اسم الحلقة": circle?.name ?? "",
      "رقم الجوال": u.phone ?? "",
      "الدولة": u.country ?? "",
      "الفئة العمرية": u.ageRange ?? "",
      "المستوى التعليمي": u.educationLevel ?? "",
      "تاريخ التسجيل": formatDate(u.createdAt),
    };
  }));

  await sendWorkbook(res, wb, `بيانات_التسجيل_${new Date().toISOString().slice(0, 10)}`);
});

// ─── Backup: list + download + generate now ───────────────────────────────────
router.get("/export/backups", authenticate, requireRole("leader", "deputy"), async (_req, res): Promise<void> => {
  res.json(listBackups());
});

router.post("/export/backups/generate", authenticate, requireRole("leader", "deputy"), async (_req, res): Promise<void> => {
  try {
    const filepath = await runWeeklyBackup();
    res.json({ success: true, filepath });
  } catch (err) {
    res.status(500).json({ error: "فشل إنشاء النسخة الاحتياطية" });
  }
});

router.get("/export/backups/:filename", authenticate, requireRole("leader", "deputy"), async (req, res): Promise<void> => {
  const rawFilename = String(req.params.filename);
  const filepath = getBackupPath(rawFilename);
  if (!filepath) { res.status(404).json({ error: "الملف غير موجود" }); return; }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(rawFilename)}`);
  res.sendFile(filepath);
});

export default router;
