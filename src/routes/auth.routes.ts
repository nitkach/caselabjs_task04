import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
    login,
    logout,
    me,
    refresh,
    register,
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/authenticate.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { loginSchema, registerSchema } from "../schemas/auth.schema.js";

export const authRouter = Router();

const loginRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 10,
    message: {
        error: {
            code: "RATE_LIMIT_EXCEEDED",
            message: "Too many login attempts, please try again later.",
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

authRouter.post(
    "/register",
    validateRequest(registerSchema),
    asyncHandler(register),
);
authRouter.post(
    "/login",
    loginRateLimit,
    validateRequest(loginSchema),
    asyncHandler(login),
);
authRouter.post("/refresh", asyncHandler(refresh));
authRouter.post("/logout", asyncHandler(logout));
authRouter.get("/me", authenticate, asyncHandler(me));
