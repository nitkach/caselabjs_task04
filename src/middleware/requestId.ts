import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

declare global {
    namespace Express {
        interface Request {
            requestId: string;
        }
    }
}

export const requestId = (
    req: Request,
    res: Response,
    next: NextFunction,
): void => {
    const value = req.header("x-request-id");
    const candidate = value?.trim();
    const id = candidate && /^[a-zA-Z0-9._-]{1,128}$/.test(candidate)
        ? candidate
        : randomUUID();

    req.requestId = id;
    res.setHeader("X-Request-Id", id);
    next();
};
