import express from "express";
import helmet from "helmet";
import cors from "cors";
import rateLimit from "express-rate-limit";
import cookieParser from "cookie-parser";

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

export const app = express();
app.set("trust proxy", 1);

app.use(requestId);

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

app.use("/api", apiLimiter);
app.use(requestLogger);
app.use(express.json({ limit: env.jsonBodyLimit }));
app.use(express.urlencoded({ extended: false, limit: env.urlEncodedBodyLimit }));
app.use(cookieParser());

app.get("/api/health", async (_req, res) => {
    try {
        await sequelize.authenticate();
        res.json({ status: "ok", database: "up" });
    } catch (error) {
        console.error("Database health check failed", error);
        res.status(503).json({ status: "error", database: "down" });
    }
});

app.use("/api/auth", authRouter);
app.use("/api", equipmentRouter);
app.use("/api", maintenanceRequestRouter);
app.use("/api", reportRouter);

app.use(notFoundHandler);
app.use(errorHandler);
