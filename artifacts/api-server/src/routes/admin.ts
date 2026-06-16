import { Router, type IRouter } from "express";
import { spawn } from "child_process";
import path from "path";
import { authenticate, requireRole } from "../middlewares/authenticate";

const router: IRouter = Router();

router.post("/admin/schema-push", authenticate, requireRole("leader"), async (req, res): Promise<void> => {
  const dbDir = path.resolve(process.cwd(), "../../lib/db");
  const connectionString = process.env.SUPABASE_DATABASE_URL || process.env.DATABASE_URL || "";

  const env = {
    ...process.env,
    SUPABASE_DATABASE_URL: connectionString,
    DATABASE_URL: connectionString,
  };

  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.setHeader("Transfer-Encoding", "chunked");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const child = spawn(
    "pnpm",
    ["run", "push-force"],
    { cwd: dbDir, env, shell: true }
  );

  child.stdout.on("data", (chunk: Buffer) => {
    res.write(chunk.toString());
  });

  child.stderr.on("data", (chunk: Buffer) => {
    res.write(chunk.toString());
  });

  child.on("close", (code) => {
    if (code === 0) {
      res.write("\n✅ تمت المزامنة بنجاح");
    } else {
      res.write(`\n❌ فشلت المزامنة (exit code ${code})`);
    }
    res.end();
  });

  child.on("error", (err) => {
    res.write(`\n❌ خطأ: ${err.message}`);
    res.end();
  });
});

export default router;
