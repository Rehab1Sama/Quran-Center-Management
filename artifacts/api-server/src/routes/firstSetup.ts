import { Router, type IRouter } from "express";
import { db, usersTable, tracksTable, circlesTable, registrationSettingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/authenticate";
import { hashPassword } from "../lib/auth";

const router: IRouter = Router();

const parse = <T>(val: string | undefined, fallback: T): T => {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
};

// GET /api/setup/status — is first-time setup needed?
router.get("/setup/status", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  const tracks = await db.select({ id: tracksTable.id }).from(tracksTable).limit(1);
  const isNeeded = tracks.length === 0;

  const envTracks = parse<{ name: string; dataEntryType: string }[]>(
    process.env.DEFAULT_TRACK_TYPES, []
  );

  res.json({
    isNeeded,
    schoolName: process.env.VITE_SCHOOL_NAME ?? null,
    schoolTagline: process.env.VITE_SCHOOL_TAGLINE ?? null,
    logoUrl: process.env.VITE_LOGO_URL ?? null,
    suggestedTracks: envTracks,
  });
});

// POST /api/setup/complete — create tracks + circles + registration settings
router.post("/setup/complete", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const {
    tracks,
    registrationOpen,
    registrationDeadline,
    adminName,
  } = req.body as {
    tracks: { name: string; dataEntryType: string; circleNames?: string[] }[];
    registrationOpen?: boolean;
    registrationDeadline?: string;
    adminName?: string;
  };

  const results: string[] = [];

  try {
    // 1. Upsert tracks + circles
    const existingTracks = await db.select({ name: tracksTable.name }).from(tracksTable);
    const existingNames = new Set(existingTracks.map(t => t.name));
    const existingCircles = await db.select({ name: circlesTable.name }).from(circlesTable);
    const existingCircleNames = new Set(existingCircles.map(c => c.name));

    let tracksAdded = 0, circlesAdded = 0;

    for (const t of (tracks ?? [])) {
      let trackId: number;
      if (!existingNames.has(t.name)) {
        const [row] = await db.insert(tracksTable).values({
          name: t.name,
          dataEntryType: t.dataEntryType,
        }).returning({ id: tracksTable.id });
        trackId = row!.id;
        tracksAdded++;
      } else {
        const [row] = await db.select({ id: tracksTable.id })
          .from(tracksTable).where(eq(tracksTable.name, t.name));
        trackId = row!.id;
      }

      for (const cn of (t.circleNames ?? [])) {
        if (!existingCircleNames.has(cn)) {
          await db.insert(circlesTable).values({
            name: cn, track: t.name, trackType: t.dataEntryType, trackId,
          });
          existingCircleNames.add(cn);
          circlesAdded++;
        }
      }
    }

    // Always ensure أرشيف + التسجيل circles exist
    if (!existingCircleNames.has("أرشيف")) {
      await db.insert(circlesTable).values({ name: "أرشيف", track: "أرشيف", trackType: "archive" });
      circlesAdded++;
    }
    if (!existingCircleNames.has("التسجيل")) {
      await db.insert(circlesTable).values({ name: "التسجيل", track: "التسجيل", trackType: "registration" });
      circlesAdded++;
    }

    results.push(`تم إضافة ${tracksAdded} مسار و${circlesAdded} حلقة`);

    // 2. Registration settings
    if (registrationOpen !== undefined) {
      const existing = await db.select().from(registrationSettingsTable);
      const vals: any = { isOpen: registrationOpen };
      if (registrationDeadline) vals.deadline = registrationDeadline;
      if (existing.length === 0) {
        await db.insert(registrationSettingsTable).values(vals);
      } else {
        await db.update(registrationSettingsTable).set(vals);
      }
      results.push(`التسجيل: ${registrationOpen ? "مفتوح" : "مغلق"}`);
    }

    // 3. Update leader display name if provided
    if (adminName?.trim()) {
      await db.update(usersTable)
        .set({ name: adminName.trim() })
        .where(eq(usersTable.id, (req as any).userId));
      results.push(`تم تحديث اسم المشرفة`);
    }

    res.json({ ok: true, results });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message ?? "خطأ غير معروف" });
  }
});

// POST /api/setup/init — create leader from INITIAL_ADMIN_EMAIL (called on cold start)
router.get("/setup/init", async (_req, res): Promise<void> => {
  const email = process.env.INITIAL_ADMIN_EMAIL;
  const name = process.env.VITE_SCHOOL_NAME ?? "المشرفة العامة";
  if (!email) {
    res.json({ ok: false, message: "INITIAL_ADMIN_EMAIL not set" });
    return;
  }
  try {
    const tempPassword = Math.random().toString(36).slice(2, 10) + "A1!";
    const hash = hashPassword(tempPassword);
    const existing = await db.select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.email, email), eq(usersTable.role, "leader")));

    if (existing.length === 0) {
      await db.insert(usersTable).values({
        email, name, passwordHash: hash, role: "leader",
      });
      res.json({ ok: true, created: true, email, tempPassword });
    } else {
      res.json({ ok: true, created: false, message: "Leader already exists" });
    }
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message });
  }
});

export default router;
