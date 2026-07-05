import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";
import { db, usersTable, studentsTable, studentEnrollmentsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";

declare global {
  namespace Express {
    interface Request {
      userId?: number;
      userRole?: string;
      userTrack?: string | null;
      userCircleId?: number | null;
      userStudentId?: number | null;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const token = authHeader.slice(7);
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid token" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, payload.userId));
  if (!user || user.isArchived) {
    res.status(401).json({ error: "User not found" });
    return;
  }

  req.userId = user.id;
  req.userRole = user.role;
  req.userTrack = user.track;
  req.userCircleId = user.circleId;

  // حل studentId للطالبات
  if (user.role === "student") {
    let studentId: number | null = null;

    // أولاً: الرابط المباشر في جدول المستخدمين (الأولوية القصوى)
    if (user.studentId) {
      studentId = user.studentId;
    }
    // ثانياً: بالاسم + circleId المباشر على جدول الطالبات
    if (!studentId && user.circleId) {
      const [byCircle] = await db.select({ id: studentsTable.id }).from(studentsTable)
        .where(and(eq(studentsTable.fullName, user.name), eq(studentsTable.circleId, user.circleId))).limit(1);
      studentId = byCircle?.id ?? null;
    }
    // ثالثاً: عبر student_enrollments (الطالبات المضافات بالنظام الجديد)
    if (!studentId && user.circleId) {
      const [byEnrollment] = await db.select({ id: studentsTable.id }).from(studentsTable)
        .innerJoin(
          studentEnrollmentsTable,
          and(
            eq(studentEnrollmentsTable.studentId, studentsTable.id),
            eq(studentEnrollmentsTable.circleId, user.circleId),
            eq(studentEnrollmentsTable.isArchived, false),
          ),
        )
        .where(eq(studentsTable.fullName, user.name)).limit(1);
      studentId = byEnrollment?.id ?? null;
    }
    // رابعاً: بالاسم فقط كحل أخير
    if (!studentId) {
      const [byName] = await db.select({ id: studentsTable.id }).from(studentsTable)
        .where(eq(studentsTable.fullName, user.name)).limit(1);
      studentId = byName?.id ?? null;
    }
    req.userStudentId = studentId;
  }

  next();
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.userRole || !roles.includes(req.userRole)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    next();
  };
}
