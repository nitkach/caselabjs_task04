import type { NextFunction, Request, Response } from "express";
import { log } from "../utils/logger.js";

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
    const startTime = process.hrtime.bigint();

    res.on("finish", () => {
        if (req.path === "/metrics") return;

        const durationMs = Number(process.hrtime.bigint() - startTime) / 1_000_000;
        const level = res.statusCode >= 500
            ? "error"
            : res.statusCode >= 400
                ? "warn"
                : "info";

        log(level, "http_request", {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode: res.statusCode,
            durationMs: Math.round(durationMs * 100) / 100,
            clientIp: req.ip,
        });
    });

    next();
};
