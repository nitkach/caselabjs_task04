import dotenv from "dotenv";

dotenv.config();

const corsOrigins = (process.env.CORS_ORIGINS ?? "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

const requiredDatabaseValue = (name: string): string => {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Environment variable ${name} is required`);
    }
    return value;
};

const databasePort = Number(process.env.PGPORT ?? 5432);
const poolMax = Number(process.env.PG_POOL_MAX ?? 10);
const poolMin = Number(process.env.PG_POOL_MIN ?? 0);
const poolAcquire = Number(process.env.PG_POOL_ACQUIRE_MS ?? 30_000);
const poolIdle = Number(process.env.PG_POOL_IDLE_MS ?? 10_000);
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET?.trim();
const authCookieSameSite = process.env.AUTH_COOKIE_SAME_SITE ?? "lax";
const authCookieSecureValue = process.env.AUTH_COOKIE_SECURE
    ?? (process.env.NODE_ENV === "production" ? "true" : "false");
const bootstrapAdminEmail = process.env.AUTH_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const bootstrapAdminPassword = process.env.AUTH_BOOTSTRAP_ADMIN_PASSWORD;
const bootstrapTechnicianEmail = process.env.AUTH_BOOTSTRAP_TECHNICIAN_EMAIL?.trim().toLowerCase();
const bootstrapTechnicianPassword = process.env.AUTH_BOOTSTRAP_TECHNICIAN_PASSWORD;
const bootstrapTechnicianId = process.env.AUTH_BOOTSTRAP_TECHNICIAN_ID?.trim();
const logLevel = process.env.LOG_LEVEL ?? "info";
const trustProxyHops = Number(process.env.TRUST_PROXY_HOPS ?? 1);

for (const [name, value] of Object.entries({
    PGPORT: databasePort,
    PG_POOL_MAX: poolMax,
    PG_POOL_MIN: poolMin,
    PG_POOL_ACQUIRE_MS: poolAcquire,
    PG_POOL_IDLE_MS: poolIdle,
    TRUST_PROXY_HOPS: trustProxyHops,
})) {
    if (!Number.isSafeInteger(value) || value < 0) {
        throw new Error(`Environment variable ${name} must be a non-negative integer`);
    }
}

if (trustProxyHops > 10) {
    throw new Error("TRUST_PROXY_HOPS must not exceed 10");
}
if (!["fatal", "error", "warn", "info", "debug"].includes(logLevel)) {
    throw new Error("LOG_LEVEL must be fatal, error, warn, info, or debug");
}

if (databasePort === 0 || poolMax === 0 || poolMin > poolMax || poolAcquire === 0) {
    throw new Error("Invalid PostgreSQL connection or pool configuration");
}

if (!accessTokenSecret || accessTokenSecret.length < 32) {
    throw new Error("ACCESS_TOKEN_SECRET must contain at least 32 characters");
}
if (!["strict", "lax", "none"].includes(authCookieSameSite)) {
    throw new Error("AUTH_COOKIE_SAME_SITE must be strict, lax, or none");
}
if (!["true", "false"].includes(authCookieSecureValue)) {
    throw new Error("AUTH_COOKIE_SECURE must be true or false");
}
if (authCookieSameSite === "none" && authCookieSecureValue !== "true") {
    throw new Error("AUTH_COOKIE_SECURE must be true when AUTH_COOKIE_SAME_SITE=none");
}
if (Boolean(bootstrapAdminEmail) !== Boolean(bootstrapAdminPassword)) {
    throw new Error("Set both AUTH_BOOTSTRAP_ADMIN_EMAIL and AUTH_BOOTSTRAP_ADMIN_PASSWORD");
}
if (
    bootstrapAdminPassword
    && (bootstrapAdminPassword.length < 8 || Buffer.byteLength(bootstrapAdminPassword, "utf8") > 72)
) {
    throw new Error("AUTH_BOOTSTRAP_ADMIN_PASSWORD must be 8-72 bytes");
}
if (
    Boolean(bootstrapTechnicianEmail) !== Boolean(bootstrapTechnicianPassword)
    || Boolean(bootstrapTechnicianEmail) !== Boolean(bootstrapTechnicianId)
) {
    throw new Error(
        "Set AUTH_BOOTSTRAP_TECHNICIAN_EMAIL, AUTH_BOOTSTRAP_TECHNICIAN_PASSWORD, and AUTH_BOOTSTRAP_TECHNICIAN_ID together",
    );
}
if (
    bootstrapTechnicianPassword
    && (bootstrapTechnicianPassword.length < 8 || Buffer.byteLength(bootstrapTechnicianPassword, "utf8") > 72)
) {
    throw new Error("AUTH_BOOTSTRAP_TECHNICIAN_PASSWORD must be 8-72 bytes");
}

export const env = {
    port: Number(process.env.PORT ?? 3000),
    corsOrigins,
    rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 900000),
    rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 100),
    jsonBodyLimit: process.env.JSON_BODY_LIMIT ?? "2mb",
    urlEncodedBodyLimit: process.env.URL_ENCODED_BODY_LIMIT ?? "10kb",
    logLevel: logLevel as "fatal" | "error" | "warn" | "info" | "debug",
    trustProxyHops,
    accessTokenSecret,
    authCookieSecure: authCookieSecureValue === "true",
    authCookieSameSite: authCookieSameSite as "strict" | "lax" | "none",
    bootstrapAdmin: bootstrapAdminEmail && bootstrapAdminPassword
        ? { email: bootstrapAdminEmail, password: bootstrapAdminPassword }
        : undefined,
    bootstrapTechnician: bootstrapTechnicianEmail && bootstrapTechnicianPassword && bootstrapTechnicianId
        ? {
            email: bootstrapTechnicianEmail,
            password: bootstrapTechnicianPassword,
            technicianId: bootstrapTechnicianId,
        }
        : undefined,
    weatherApiUrl: process.env.WEATHER_API_URL ??
        "https://api.open-meteo.com/v1/forecast",
    requestTimeoutMs: Number(process.env.REQUEST_TIMEOUT_MS ?? 5000),
    weatherForecastDays: Number(process.env.WEATHER_FORECAST_DAYS ?? 3),
    weatherMaxPrecipitation: Number(process.env.WEATHER_MAX_PRECIPITATION ?? 1),
    weatherMaxWindSpeedKmh: Number(
        process.env.WEATHER_MAX_WIND_SPEED_KMH ?? 30,
    ),
    database: {
        host: process.env.PGHOST ?? "localhost",
        port: databasePort,
        name: requiredDatabaseValue("PGDATABASE"),
        user: requiredDatabaseValue("PGUSER"),
        password: requiredDatabaseValue("PGPASSWORD"),
        pool: {
            max: poolMax,
            min: poolMin,
            acquire: poolAcquire,
            idle: poolIdle,
        },
    },
};
