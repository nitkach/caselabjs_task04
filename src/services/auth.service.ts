import { randomBytes, createHash } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { Op, type Transaction } from "sequelize";

import { env } from "../config/env.js";
import { sequelize } from "../config/database.js";
import {
    AuthSessionEntity,
    AuthUserEntity,
    TechnicianEntity,
    type UserRole,
} from "../models/entities/index.js";
import {
    ConflictError,
    NotFoundError,
    UnauthorizedError,
    ValidationError,
} from "../errors/appError.js";
import type { LoginInput, RegisterInput } from "../schemas/auth.schema.js";

const accessTokenLifetimeSeconds = 15 * 60;
const refreshTokenLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const dummyPasswordHash = bcrypt.hashSync(randomBytes(32).toString("hex"), 12);

export interface AuthenticatedUser {
    id: string;
    email: string;
    role: UserRole;
    technicianId: string | null;
}

export interface AuthTokens {
    accessToken: string;
    refreshToken: string;
    user: AuthenticatedUser;
}

function toPublicUser(user: AuthUserEntity): AuthenticatedUser {
    return {
        id: user.id,
        email: user.email,
        role: user.role,
        technicianId: user.technicianId,
    };
}

function hashRefreshToken(token: string): string {
    return createHash("sha256").update(token).digest("hex");
}

function createAccessToken(user: AuthenticatedUser): string {
    return jwt.sign(
        {
            email: user.email,
            role: user.role,
            technicianId: user.technicianId,
        },
        env.accessTokenSecret,
        {
            algorithm: "HS256",
            subject: user.id,
            expiresIn: accessTokenLifetimeSeconds,
        },
    );
}

function createRefreshToken(): string {
    return randomBytes(32).toString("base64url");
}

async function createSession(
    user: AuthUserEntity,
    transaction?: Transaction,
): Promise<string> {
    const token = createRefreshToken();
    await AuthSessionEntity.create({
        userId: user.id,
        tokenHash: hashRefreshToken(token),
        expiresAt: new Date(Date.now() + refreshTokenLifetimeMs),
        revokedAt: null,
    }, transaction ? { transaction } : undefined);
    return token;
}

async function issueTokens(user: AuthUserEntity): Promise<AuthTokens> {
    const refreshToken = await createSession(user);
    const publicUser = toPublicUser(user);
    return {
        accessToken: createAccessToken(publicUser),
        refreshToken,
        user: publicUser,
    };
}

export class AuthService {
    async register(input: RegisterInput): Promise<AuthenticatedUser> {
        if (Buffer.byteLength(input.password, "utf8") > 72) {
            throw new ValidationError("Password must not exceed 72 bytes");
        }
        const existing = await AuthUserEntity.findOne({
            where: { email: input.email },
            attributes: ["id"],
        });
        if (existing) {
            throw new ConflictError("An account with this email already exists");
        }

        const user = await AuthUserEntity.create({
            email: input.email,
            passwordHash: await bcrypt.hash(input.password, 12),
            role: "viewer",
            technicianId: null,
        });
        return toPublicUser(user);
    }

    async login(input: LoginInput): Promise<AuthTokens> {
        const user = await AuthUserEntity.findOne({
            where: { email: input.email },
        });
        const matches = await bcrypt.compare(
            input.password,
            user?.passwordHash ?? dummyPasswordHash,
        );
        if (!user || !matches) {
            throw new UnauthorizedError("Invalid email or password");
        }
        return issueTokens(user);
    }

    async refresh(refreshToken: string | undefined): Promise<AuthTokens> {
        if (!refreshToken) {
            throw new UnauthorizedError("Invalid or expired refresh token");
        }
        const tokenHash = hashRefreshToken(refreshToken);

        return sequelize.transaction(async (transaction) => {
            const session = await AuthSessionEntity.findOne({
                where: {
                    tokenHash,
                    revokedAt: null,
                    expiresAt: { [Op.gt]: new Date() },
                },
                include: [{ model: AuthUserEntity, required: true }],
                transaction,
                lock: transaction.LOCK.UPDATE,
            });
            if (!session?.user) {
                throw new UnauthorizedError("Invalid or expired refresh token");
            }

            await session.update({ revokedAt: new Date() }, { transaction });
            const nextRefreshToken = await createSession(session.user, transaction);
            const publicUser = toPublicUser(session.user);
            return {
                accessToken: createAccessToken(publicUser),
                refreshToken: nextRefreshToken,
                user: publicUser,
            };
        });
    }

    async logout(refreshToken: string | undefined): Promise<void> {
        if (!refreshToken) return;
        await AuthSessionEntity.update(
            { revokedAt: new Date() },
            {
                where: {
                    tokenHash: hashRefreshToken(refreshToken),
                    revokedAt: null,
                },
            },
        );
    }

    async getUser(id: string): Promise<AuthenticatedUser> {
        const user = await AuthUserEntity.findByPk(id);
        if (!user) throw new UnauthorizedError();
        return toPublicUser(user);
    }

    async verifyAccessToken(token: string): Promise<AuthenticatedUser> {
        try {
            const payload = jwt.verify(token, env.accessTokenSecret, {
                algorithms: ["HS256"],
            });
            if (
                typeof payload === "string"
                || typeof payload.sub !== "string"
                || typeof payload.email !== "string"
                || !["viewer", "technician", "admin"].includes(payload.role as string)
                || (payload.technicianId !== null && typeof payload.technicianId !== "string")
            ) {
                throw new UnauthorizedError("Invalid access token");
            }
            return {
                id: payload.sub,
                email: payload.email,
                role: payload.role as UserRole,
                technicianId: payload.technicianId as string | null,
            };
        } catch (error) {
            if (error instanceof UnauthorizedError) throw error;
            throw new UnauthorizedError("Invalid or expired access token");
        }
    }

    async bootstrapAccounts(): Promise<void> {
        if (env.bootstrapAdmin) {
            await this.ensureBootstrapAccount(
                env.bootstrapAdmin.email,
                env.bootstrapAdmin.password,
                "admin",
            );
        }
        if (env.bootstrapTechnician) {
            const technician = await TechnicianEntity.findByPk(
                env.bootstrapTechnician.technicianId,
            );
            if (!technician) {
                throw new NotFoundError(
                    "AUTH_BOOTSTRAP_TECHNICIAN_ID does not match an existing technician",
                );
            }
            await this.ensureBootstrapAccount(
                env.bootstrapTechnician.email,
                env.bootstrapTechnician.password,
                "technician",
                technician.id,
            );
        }
    }

    private async ensureBootstrapAccount(
        email: string,
        password: string,
        role: "admin" | "technician",
        technicianId: string | null = null,
    ): Promise<void> {
        if (Buffer.byteLength(password, "utf8") > 72) {
            throw new Error(`Bootstrap password for ${email} must not exceed 72 bytes`);
        }
        const existing = await AuthUserEntity.findOne({ where: { email } });
        if (existing) {
            if (existing.role !== role || existing.technicianId !== technicianId) {
                throw new ConflictError(
                    `Bootstrap account ${email} already exists with a different role or technician`,
                );
            }
            return;
        }
        await AuthUserEntity.create({
            email,
            passwordHash: await bcrypt.hash(password, 12),
            role,
            technicianId,
        });
    }
}

export const authService = new AuthService();
