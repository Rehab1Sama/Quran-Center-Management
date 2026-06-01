import { Router, type IRouter } from "express";
import { db, whitelabelConfigsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { authenticate, requireRole } from "../middlewares/authenticate";

const router: IRouter = Router();

const RENDER_API = "https://api.render.com/v1";

async function renderFetch(path: string, method = "GET", body?: unknown) {
  const key = process.env.RENDER_API_KEY;
  if (!key) throw new Error("RENDER_API_KEY غير مضبوط في إعدادات البيئة");
  const r = await fetch(`${RENDER_API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await r.json() as unknown;
  if (!r.ok) throw new Error((data as any)?.message ?? `Render API error ${r.status}`);
  return data;
}

router.get("/white-label/configs", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  const configs = await db.select().from(whitelabelConfigsTable).orderBy(whitelabelConfigsTable.createdAt);
  res.json(configs);
});

router.post("/white-label/configs", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const { schoolName, logoUrl, primaryHsl, secondaryHsl, sidebarHsl, enabledFeatures } = req.body as Record<string, string>;
  if (!schoolName?.trim()) {
    res.status(400).json({ error: "اسم المقرأة مطلوب" }); return;
  }
  const [config] = await db.insert(whitelabelConfigsTable).values({
    schoolName: schoolName.trim(),
    logoUrl: logoUrl ?? null,
    primaryHsl: primaryHsl ?? "210 51% 21%",
    secondaryHsl: secondaryHsl ?? "177 35% 57%",
    sidebarHsl: sidebarHsl ?? "210 51% 21%",
    enabledFeatures: enabledFeatures ?? "[]",
  }).returning();
  res.json(config);
});

router.patch("/white-label/configs/:id", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const { schoolName, logoUrl, primaryHsl, secondaryHsl, sidebarHsl, enabledFeatures } = req.body as Record<string, string | undefined>;
  const [updated] = await db.update(whitelabelConfigsTable).set({
    ...(schoolName !== undefined && { schoolName }),
    ...(logoUrl !== undefined && { logoUrl }),
    ...(primaryHsl !== undefined && { primaryHsl }),
    ...(secondaryHsl !== undefined && { secondaryHsl }),
    ...(sidebarHsl !== undefined && { sidebarHsl }),
    ...(enabledFeatures !== undefined && { enabledFeatures }),
  }).where(eq(whitelabelConfigsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/white-label/configs/:id", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  await db.delete(whitelabelConfigsTable).where(eq(whitelabelConfigsTable.id, id));
  res.json({ ok: true });
});

router.post("/white-label/configs/:id/deploy", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [config] = await db.select().from(whitelabelConfigsTable).where(eq(whitelabelConfigsTable.id, id));
  if (!config) { res.status(404).json({ error: "Not found" }); return; }

  const repoUrl = process.env.RENDER_GITHUB_REPO_URL;
  if (!repoUrl) {
    res.status(400).json({ error: "RENDER_GITHUB_REPO_URL غير مضبوط — أضف رابط مستودع GitHub في الإعدادات" }); return;
  }

  await db.update(whitelabelConfigsTable).set({ deployStatus: "deploying", deployError: null }).where(eq(whitelabelConfigsTable.id, id));

  try {
    const owners = await renderFetch("/owners?limit=1") as any[];
    const ownerId = (Array.isArray(owners) ? owners[0]?.owner?.id : null) as string | null;
    if (!ownerId) throw new Error("تعذّر الحصول على معرّف الحساب من Render");

    const dbName = `sana-db-${config.schoolName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase()}-${id}`;
    const dbResp = await renderFetch("/postgres", "POST", {
      name: dbName,
      ownerId,
      plan: "starter",
      region: "oregon",
      databaseName: "sana_quran",
      databaseUser: "sana_user",
    }) as any;
    const dbId = dbResp?.id as string;
    const dbConnStr = dbResp?.databaseUrl ?? dbResp?.connectionString ?? null;

    await db.update(whitelabelConfigsTable).set({ renderDbId: dbId }).where(eq(whitelabelConfigsTable.id, id));

    const serviceName = `sana-${config.schoolName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase()}-${id}`;
    const features = (() => { try { return JSON.parse(config.enabledFeatures); } catch { return []; } })();

    const serviceResp = await renderFetch("/services", "POST", {
      type: "web_service",
      name: serviceName,
      ownerId,
      repo: repoUrl,
      branch: "main",
      autoDeploy: "yes",
      serviceDetails: {
        env: "node",
        buildCommand: "npm install -g pnpm && pnpm install --frozen-lockfile && pnpm --filter @workspace/db exec tsc --build && pnpm --filter @workspace/api-zod exec tsc --build && pnpm --filter @workspace/api-client-react exec tsc --build && pnpm --filter @workspace/sana-quran run build && pnpm --filter @workspace/api-server run build",
        startCommand: "node artifacts/api-server/dist/index.mjs",
        plan: "starter",
        region: "oregon",
        numInstances: 1,
      },
      envVars: [
        { key: "NODE_ENV", value: "production" },
        { key: "PORT", value: "10000" },
        { key: "JWT_SECRET", generateValue: true },
        { key: "DATABASE_URL", value: dbConnStr ?? `postgres://pending` },
        { key: "VITE_SCHOOL_NAME", value: config.schoolName },
        { key: "VITE_PRIMARY_HSL", value: config.primaryHsl },
        { key: "VITE_SECONDARY_HSL", value: config.secondaryHsl },
        { key: "VITE_SIDEBAR_HSL", value: config.sidebarHsl },
        ...(config.logoUrl ? [{ key: "VITE_LOGO_URL", value: config.logoUrl }] : []),
        { key: "VITE_ENABLED_FEATURES", value: JSON.stringify(features) },
      ],
    }) as any;

    const serviceId = serviceResp?.id as string;
    const serviceUrl = serviceResp?.serviceDetails?.url ?? `https://${serviceName}.onrender.com`;

    await db.update(whitelabelConfigsTable).set({
      renderServiceId: serviceId,
      renderServiceUrl: serviceUrl,
      deployStatus: "deploying",
    }).where(eq(whitelabelConfigsTable.id, id));

    res.json({ ok: true, serviceUrl, serviceId, dbId });
  } catch (err: any) {
    await db.update(whitelabelConfigsTable).set({
      deployStatus: "failed",
      deployError: err?.message ?? "خطأ غير معروف",
    }).where(eq(whitelabelConfigsTable.id, id));
    res.status(500).json({ error: err?.message ?? "خطأ غير معروف" });
  }
});

router.get("/white-label/render-settings", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  res.json({
    hasApiKey: !!process.env.RENDER_API_KEY,
    hasRepoUrl: !!process.env.RENDER_GITHUB_REPO_URL,
    repoUrl: process.env.RENDER_GITHUB_REPO_URL ?? null,
  });
});

export default router;
