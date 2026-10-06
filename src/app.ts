import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";
import swaggerUi from "swagger-ui-express";

import { env } from "./config/env.js";
import { sequelize } from "./config/database.js";
import { requestLogger } from "./middleware/requestLogger.js";
import { requestId } from "./middleware/requestId.js";
import { errorHandler } from "./middleware/errorHandler.js";
import { notFoundHandler } from "./middleware/notFoundHandler.js";
import { authRouter } from "./routes/auth.routes.js";
import { equipmentRouter } from "./routes/equipment.routes.js";
import { maintenanceRequestRouter } from "./routes/maintenanceRequest.routes.js";
import { reportRouter } from "./routes/report.routes.js";
import { httpMetrics, metricsRegistry } from "./middleware/httpMetrics.js";
import { log } from "./utils/logger.js";
import { openApiDocument } from "./docs/openapi.js";

export const app = express();
app.set("trust proxy", env.trustProxyHops);

app.use(requestId);
app.use(httpMetrics);
app.use(requestLogger);

app.use(
    helmet({
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                scriptSrc: ["'self'"],
                styleSrc: ["'self'",],
                fontSrc: ["'self'"],
                imgSrc: ["'self'"],
                connectSrc: ["'self'"],
                frameAncestors: ["'none'"],
            },
        },
        hsts: {
            maxAge: 31536000, // 1 год
            includeSubDomains: true,
            preload: true,
        },
        frameguard: {
            action: "deny",
        },
        referrerPolicy: {
            policy: "strict-origin-when-cross-origin",
        },
    })
);

app.use(
    cors({
        origin: env.corsOrigins,
        credentials: true,
        methods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
        allowedHeaders: ["Content-Type", "Authorization", "X-Request-Id"],
    })
);

const apiLimiter = rateLimit({
    windowMs: env.rateLimitWindowMs,
    limit: env.rateLimitMax,
    message: {
        error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many requests, please try again later.",
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.get("/metrics", async (_req, res, next) => {
    try {
        res.setHeader("Content-Type", metricsRegistry.contentType);
        res.send(await metricsRegistry.metrics());
    } catch (error) {
        next(error);
    }
});

app.get("/api/openapi.json", (_req, res) => {
    res.json(openApiDocument);
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(openApiDocument, {
    customSiteTitle: "CaseLab Maintenance API Docs",
    customCss: ".swagger-ui .topbar { display: none; }",
}));

app.use("/api", apiLimiter);
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: env.urlEncodedBodyLimit }));
app.use(cookieParser());

const liveHandler = (_req: express.Request, res: express.Response): void => {
    res.json({ status: "ok" });
};

const readyHandler = async (req: express.Request, res: express.Response): Promise<void> => {
    try {
        await sequelize.authenticate();
        res.json({ status: "ok", database: "up" });
    } catch {
        log("warn", "readiness_check_failed", {
            requestId: req.requestId,
            dependency: "postgres",
        });
        res.status(503).json({ status: "error", database: "down" });
    }
};

app.get("/api/health/live", liveHandler);
app.get("/api/health/ready", readyHandler);
app.get("/api/health", readyHandler);

app.use("/api/auth", authRouter);
app.use("/api", equipmentRouter);
app.use("/api", maintenanceRequestRouter);
app.use("/api", reportRouter);

app.use(notFoundHandler);
app.use(errorHandler);
