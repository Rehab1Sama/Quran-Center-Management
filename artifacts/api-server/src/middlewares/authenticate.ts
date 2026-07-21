import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../lib/auth";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

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

    // أولاً: الرابط المحفوظ في users.student_id — لكن فقط إذا كانت الطالبة في نفس حلقة المستخدمة
    // (الشخص في حلقتين = حسابان منفصلان، كل حساب يجب أن يرتبط بطالبة حلقته لا الأخرى)
    if (user.studentId && user.circleId) {
      const res1 = await db.execute(
        sql`SELECT id FROM students
            WHERE id=${user.studentId} AND circle_id=${user.circleId} AND is_archived=false LIMIT 1`
      );
      if ((res1 as any).rows?.[0]?.id) {
        studentId = user.studentId;
      }
    } else if (user.studentId && !user.circleId) {
      // لا حلقة محددة → نقبل الرابط المباشر كما هو
      studentId = user.studentId;
    }

    // ثانياً: بالاسم (TRIM) + circleId في جدول students
    if (!studentId && user.circleId) {
      const res2 = await db.execute(
        sql`SELECT id FROM students
            WHERE TRIM(full_name)=TRIM(${user.name}) AND circle_id=${user.circleId} AND is_archived=false LIMIT 1`
      );
      studentId = (res2 as any).rows?.[0]?.id ?? null;
    }

    // ثالثاً: عبر student_enrollments (الطالبات المضافات بالنظام الجديد)
    if (!studentId && user.circleId) {
      const res3 = await db.execute(
        sql`SELECT s.id FROM students s
            JOIN student_enrollments se ON se.student_id=s.id AND se.circle_id=${user.circleId} AND se.is_archived=false
            WHERE TRIM(s.full_name)=TRIM(${user.name}) AND s.is_archived=false LIMIT 1`
      );
      studentId = (res3 as any).rows?.[0]?.id ?? null;
    }

    // رابعاً: users.student_id بغض النظر عن الحلقة — كشبكة أمان أخيرة (حلقة واحدة فقط)
    if (!studentId && user.studentId) {
      studentId = user.studentId;
    }

    // خامساً: بالاسم (TRIM) فقط — فقط إذا كان الاسم فريداً عبر كل الحلقات
    if (!studentId) {
      const res5 = await db.execute(
        sql`SELECT id FROM students
            WHERE TRIM(full_name)=TRIM(${user.name}) AND is_archived=false
              AND (SELECT COUNT(*) FROM students WHERE TRIM(full_name)=TRIM(${user.name}) AND is_archived=false)=1
            LIMIT 1`
      );
      studentId = (res5 as any).rows?.[0]?.id ?? null;
    }

    // إذا لم يكن circleId محفوظاً في حساب المستخدمة، نجلبه من سجل الطالبة
    let resolvedCircleId: number | null = user.circleId ?? null;
    if (studentId && !resolvedCircleId) {
      const res6 = await db.execute(
        sql`SELECT circle_id FROM students WHERE id=${studentId} AND is_archived=false LIMIT 1`
      );
      resolvedCircleId = (res6 as any).rows?.[0]?.circle_id ?? null;

      if (!resolvedCircleId) {
        const res7 = await db.execute(
          sql`SELECT circle_id FROM student_enrollments
              WHERE student_id=${studentId} AND is_archived=false
              ORDER BY id DESC LIMIT 1`
        );
        resolvedCircleId = (res7 as any).rows?.[0]?.circle_id ?? null;
      }
    }

    // احفظ الربط في قاعدة البيانات فقط إذا كان يطابق حلقة المستخدمة
    if (studentId && !user.studentId) {
      db.execute(sql`UPDATE users SET student_id=${studentId} WHERE id=${user.id}`).catch(() => {});
    }
    if (resolvedCircleId && !user.circleId) {
      db.execute(sql`UPDATE users SET circle_id=${resolvedCircleId} WHERE id=${user.id}`).catch(() => {});
    }

    req.userStudentId = studentId;
    req.userCircleId = resolvedCircleId;
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
