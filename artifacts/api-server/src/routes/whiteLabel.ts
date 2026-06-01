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

// ─── CRUD ────────────────────────────────────────────────────────────────────

router.get("/white-label/configs", authenticate, requireRole("leader"), async (_req, res): Promise<void> => {
  const configs = await db.select().from(whitelabelConfigsTable).orderBy(whitelabelConfigsTable.createdAt);
  res.json(configs);
});

router.post("/white-label/configs", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const b = req.body as Record<string, string>;
  if (!b.schoolName?.trim()) { res.status(400).json({ error: "اسم المقرأة مطلوب" }); return; }
  const [config] = await db.insert(whitelabelConfigsTable).values({
    schoolName: b.schoolName.trim(),
    schoolTagline: b.schoolTagline ?? "نظام إدارة المقرأة",
    logoUrl: b.logoUrl ?? null,
    adminEmail: b.adminEmail ?? null,
    primaryHsl: b.primaryHsl ?? "210 51% 21%",
    secondaryHsl: b.secondaryHsl ?? "177 35% 57%",
    sidebarHsl: b.sidebarHsl ?? "210 51% 21%",
    enabledFeatures: b.enabledFeatures ?? "[]",
    dataEntryRoles: b.dataEntryRoles ?? '["teacher","supervisor","data_entry"]',
    roleNames: b.roleNames ?? "{}",
    trackTypes: b.trackTypes ?? "[]",
    circleGenders: b.circleGenders ?? '["girls"]',
  }).returning();
  res.json(config);
});

router.patch("/white-label/configs/:id", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const b = req.body as Record<string, string | undefined>;
  const [updated] = await db.update(whitelabelConfigsTable).set({
    ...(b.schoolName !== undefined && { schoolName: b.schoolName }),
    ...(b.schoolTagline !== undefined && { schoolTagline: b.schoolTagline }),
    ...(b.logoUrl !== undefined && { logoUrl: b.logoUrl }),
    ...(b.adminEmail !== undefined && { adminEmail: b.adminEmail }),
    ...(b.primaryHsl !== undefined && { primaryHsl: b.primaryHsl }),
    ...(b.secondaryHsl !== undefined && { secondaryHsl: b.secondaryHsl }),
    ...(b.sidebarHsl !== undefined && { sidebarHsl: b.sidebarHsl }),
    ...(b.enabledFeatures !== undefined && { enabledFeatures: b.enabledFeatures }),
    ...(b.dataEntryRoles !== undefined && { dataEntryRoles: b.dataEntryRoles }),
    ...(b.roleNames !== undefined && { roleNames: b.roleNames }),
    ...(b.trackTypes !== undefined && { trackTypes: b.trackTypes }),
    ...(b.circleGenders !== undefined && { circleGenders: b.circleGenders }),
  }).where(eq(whitelabelConfigsTable.id, id)).returning();
  if (!updated) { res.status(404).json({ error: "Not found" }); return; }
  res.json(updated);
});

router.delete("/white-label/configs/:id", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  await db.delete(whitelabelConfigsTable).where(eq(whitelabelConfigsTable.id, parseInt(req.params.id)));
  res.json({ ok: true });
});

// ─── Deploy Status ────────────────────────────────────────────────────────────

router.get("/white-label/configs/:id/deploy-status", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [config] = await db.select().from(whitelabelConfigsTable).where(eq(whitelabelConfigsTable.id, id));
  if (!config) { res.status(404).json({ error: "Not found" }); return; }

  if (!config.renderServiceId) {
    res.json({ deployStatus: config.deployStatus, renderStatus: null, deployUrl: config.renderServiceUrl }); return;
  }

  try {
    const svc = await renderFetch(`/services/${config.renderServiceId}`) as any;
    const renderStatus = svc?.serviceDetails?.lastDeployStatus ?? svc?.status ?? null;
    const deployUrl = svc?.serviceDetails?.url ?? config.renderServiceUrl;

    let newStatus = config.deployStatus;
    if (renderStatus === "live") newStatus = "deployed";
    else if (renderStatus === "build_failed" || renderStatus === "deactivated") newStatus = "failed";
    else if (renderStatus === "deploying" || renderStatus === "building") newStatus = "deploying";

    if (newStatus !== config.deployStatus || deployUrl !== config.renderServiceUrl) {
      await db.update(whitelabelConfigsTable).set({
        deployStatus: newStatus,
        renderServiceUrl: deployUrl ?? config.renderServiceUrl,
      }).where(eq(whitelabelConfigsTable.id, id));
    }

    res.json({ deployStatus: newStatus, renderStatus, deployUrl: deployUrl ?? config.renderServiceUrl });
  } catch (err: any) {
    res.json({ deployStatus: config.deployStatus, renderStatus: null, error: err?.message });
  }
});

// ─── Deploy ───────────────────────────────────────────────────────────────────

router.post("/white-label/configs/:id/deploy", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const id = parseInt(req.params.id);
  const [config] = await db.select().from(whitelabelConfigsTable).where(eq(whitelabelConfigsTable.id, id));
  if (!config) { res.status(404).json({ error: "Not found" }); return; }

  const repoUrl = process.env.RENDER_GITHUB_REPO_URL;
  if (!repoUrl) { res.status(400).json({ error: "RENDER_GITHUB_REPO_URL غير مضبوط — أضف رابط مستودع GitHub في Secrets" }); return; }

  await db.update(whitelabelConfigsTable).set({ deployStatus: "deploying", deployError: null }).where(eq(whitelabelConfigsTable.id, id));

  try {
    const owners = await renderFetch("/owners?limit=1") as any[];
    const ownerId = (Array.isArray(owners) ? owners[0]?.owner?.id : null) as string | null;
    if (!ownerId) throw new Error("تعذّر الحصول على معرّف الحساب من Render");

    const slug = config.schoolName.replace(/\s+/g, "-").replace(/[^\w-]/g, "").toLowerCase();
    const dbName = `sana-db-${slug}-${id}`;

    const dbResp = await renderFetch("/postgres", "POST", {
      name: dbName, ownerId, plan: "starter", region: "oregon",
      databaseName: "sana_quran", databaseUser: "sana_user",
    }) as any;
    const dbId = dbResp?.id as string;
    const dbConnStr = dbResp?.databaseUrl ?? dbResp?.connectionString ?? "postgres://pending";

    await db.update(whitelabelConfigsTable).set({ renderDbId: dbId }).where(eq(whitelabelConfigsTable.id, id));

    const features: string[] = (() => { try { return JSON.parse(config.enabledFeatures); } catch { return []; } })();
    const trackTypes: { name: string; dataEntryType: string }[] = (() => { try { return JSON.parse(config.trackTypes); } catch { return []; } })();
    const dataEntryRoles: string[] = (() => { try { return JSON.parse(config.dataEntryRoles); } catch { return ["teacher", "supervisor", "data_entry"]; } })();
    const roleNames: Record<string, string> = (() => { try { return JSON.parse(config.roleNames); } catch { return {}; } })();
    const circleGenders: string[] = (() => { try { return JSON.parse(config.circleGenders); } catch { return ["girls"]; } })();

    const serviceName = `sana-${slug}-${id}`;

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
        { key: "DATABASE_URL", value: dbConnStr },
        // Theming
        { key: "VITE_SCHOOL_NAME", value: config.schoolName },
        { key: "VITE_SCHOOL_TAGLINE", value: config.schoolTagline ?? "نظام إدارة المقرأة" },
        ...(config.logoUrl ? [{ key: "VITE_LOGO_URL", value: config.logoUrl }] : []),
        { key: "VITE_PRIMARY_HSL", value: config.primaryHsl },
        { key: "VITE_SECONDARY_HSL", value: config.secondaryHsl },
        { key: "VITE_SIDEBAR_HSL", value: config.sidebarHsl },
        // Features
        { key: "VITE_ENABLED_FEATURES", value: JSON.stringify(features) },
        // Data entry roles
        { key: "VITE_DATA_ENTRY_ROLES", value: JSON.stringify(dataEntryRoles) },
        { key: "ALLOWED_DATA_ENTRY_ROLES", value: JSON.stringify(dataEntryRoles) },
        // Role names
        { key: "VITE_ROLE_NAMES", value: JSON.stringify(roleNames) },
        { key: "CUSTOM_ROLE_NAMES", value: JSON.stringify(roleNames) },
        // Track types
        { key: "VITE_DEFAULT_TRACK_TYPES", value: JSON.stringify(trackTypes) },
        { key: "DEFAULT_TRACK_TYPES", value: JSON.stringify(trackTypes) },
        // Circle genders
        { key: "CIRCLE_GENDERS", value: JSON.stringify(circleGenders) },
        ...(config.adminEmail ? [{ key: "INITIAL_ADMIN_EMAIL", value: config.adminEmail }] : []),
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
