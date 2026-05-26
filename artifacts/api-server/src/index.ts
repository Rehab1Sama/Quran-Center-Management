import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "./lib/auth";

async function seedLeader() {
  try {
    const hash = hashPassword("mnbvcxzrr");
    const existing = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(and(eq(usersTable.email, "sana.qur3n@gmail.com"), eq(usersTable.role, "leader")));

    if (existing.length === 0) {
      await db.insert(usersTable).values({
        email: "sana.qur3n@gmail.com",
        name: "سنا",
        passwordHash: hash,
        role: "leader",
      });
      logger.info("Leader account created automatically");
    } else {
      // Always sync password hash to match the one defined here
      await db
        .update(usersTable)
        .set({ passwordHash: hash })
        .where(and(eq(usersTable.email, "sana.qur3n@gmail.com"), eq(usersTable.role, "leader")));
      logger.info("Leader account password hash synced");
    }
  } catch (err) {
    logger.error({ err }, "Failed to seed leader account");
  }
}

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

app.listen(port, (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info({ port }, "Server listening");
  void seedLeader();
});
