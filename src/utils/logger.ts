import { env } from "../config/env.js";

export type LogLevel = "fatal" | "error" | "warn" | "info" | "debug";

const levelWeights: Record<LogLevel, number> = {
    fatal: 0,
    error: 1,
    warn: 2,
    info: 3,
    debug: 4,
};

export function log(
    level: LogLevel,
    event: string,
    fields: Record<string, string | number | boolean | null | undefined> = {},
): void {
    if (levelWeights[level] > levelWeights[env.logLevel]) return;

    const record = Object.fromEntries(
        Object.entries({
            timestamp: new Date().toISOString(),
            level,
            event,
            ...fields,
        }).filter(([, value]) => value !== undefined),
    );
    console.log(JSON.stringify(record));
}
