import type { RequestHandler } from "express";

import { UnauthorizedError } from "../errors/appError.js";
import { authService } from "../services/auth.service.js";

declare global {
    namespace Express {
        interface Request {
            authUser?: import("../services/auth.service.js").AuthenticatedUser;
        }
    }
}

export const authenticate: RequestHandler = (req, _res, next) => {
    const authorization = req.get("authorization");
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    if (!match) {
        next(new UnauthorizedError());
        return;
    }

    void authService.verifyAccessToken(match[1])
        .then((user) => {
            req.authUser = user;
            next();
        })
        .catch(next);
};
