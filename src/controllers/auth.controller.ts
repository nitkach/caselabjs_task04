import type { Request, Response } from "express";

import { env } from "../config/env.js";
import { UnauthorizedError } from "../errors/appError.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema.js";
import { authService } from "../services/auth.service.js";

const refreshCookieName = "refresh_token";
const refreshCookieMaxAge = 30 * 24 * 60 * 60 * 1000;

function setRefreshCookie(res: Response, token: string): void {
    res.cookie(refreshCookieName, token, {
        httpOnly: true,
        secure: env.authCookieSecure,
        sameSite: env.authCookieSameSite,
        path: "/api/auth",
        maxAge: refreshCookieMaxAge,
    });
}

export async function register(
    req: Request<Record<string, never>, unknown, RegisterInput>,
    res: Response,
): Promise<void> {
    const user = await authService.register(req.body);
    res.status(201).json({ success: true, data: { user } });
}

export async function login(
    req: Request<Record<string, never>, unknown, LoginInput>,
    res: Response,
): Promise<void> {
    const tokens = await authService.login(req.body);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({
        success: true,
        data: {
            accessToken: tokens.accessToken,
            tokenType: "Bearer",
            expiresIn: 900,
            user: tokens.user,
        },
    });
}

export async function refresh(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[refreshCookieName] as string | undefined;
    const tokens = await authService.refresh(token);
    setRefreshCookie(res, tokens.refreshToken);
    res.json({
        success: true,
        data: {
            accessToken: tokens.accessToken,
            tokenType: "Bearer",
            expiresIn: 900,
            user: tokens.user,
        },
    });
}

export async function logout(req: Request, res: Response): Promise<void> {
    const token = req.cookies?.[refreshCookieName] as string | undefined;
    await authService.logout(token);
    res.clearCookie(refreshCookieName, {
        httpOnly: true,
        secure: env.authCookieSecure,
        sameSite: env.authCookieSameSite,
        path: "/api/auth",
    });
    res.sendStatus(204);
}

export async function me(req: Request, res: Response): Promise<void> {
    if (!req.authUser) throw new UnauthorizedError();
    const user = await authService.getUser(req.authUser.id);
    res.json({ success: true, data: { user } });
}
