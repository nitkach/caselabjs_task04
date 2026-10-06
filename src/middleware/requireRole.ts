import type { RequestHandler } from "express";

import { ForbiddenError, UnauthorizedError } from "../errors/appError.js";
import type { UserRole } from "../models/entities/index.js";

export function requireRole(...roles: UserRole[]): RequestHandler {
    return (req, _res, next) => {
        if (!req.authUser) {
            next(new UnauthorizedError());
            return;
        }
        if (!roles.includes(req.authUser.role)) {
            next(new ForbiddenError());
            return;
        }
        next();
    };
}
