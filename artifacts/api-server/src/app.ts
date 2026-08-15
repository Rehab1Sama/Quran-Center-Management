import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import path from "path";
import { existsSync } from "node:fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/api", router);

// Serve frontend static files in production (Render deployment)
if (process.env.NODE_ENV === "production") {
  const frontendDistCandidates = [
    path.resolve(process.cwd(), "artifacts/sana-quran/dist/public"),
    path.resolve(process.cwd(), "sana-quran/dist/public"),
    path.resolve(process.cwd(), "../sana-quran/dist/public"),
    path.resolve(process.cwd(), "../../artifacts/sana-quran/dist/public"),
  ];
  const frontendDist =
    frontendDistCandidates.find((candidate) =>
      existsSync(path.join(candidate, "index.html")),
    ) ?? frontendDistCandidates[0];
  logger.info({ frontendDist }, "Serving static files from");
  app.use(express.static(frontendDist));
  app.use((_req, res) => {
    res.sendFile(path.join(frontendDist, "index.html"), (err) => {
      if (err) {
        logger.error({ err, frontendDist }, "Failed to send index.html");
        res.status(500).send("Frontend not found. Build may have failed.");
      }
    });
  });
}

export default app;
