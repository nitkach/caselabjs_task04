"use strict";

require("dotenv").config();

const { Client } = require("pg");

async function main() {
    const grafanaPassword = process.env.GRAFANA_DB_PASSWORD;
    if (!grafanaPassword) {
        throw new Error("GRAFANA_DB_PASSWORD is required");
    }

    const client = new Client({
        host: process.env.PGHOST ?? "localhost",
        port: Number(process.env.PGPORT ?? 5432),
        database: process.env.PGDATABASE,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
    });

    await client.connect();
    try {
        await client.query("BEGIN");
        const existingRole = await client.query(
            "SELECT 1 FROM pg_roles WHERE rolname = 'grafana_reader'",
        );
        const roleStatement = existingRole.rowCount
            ? "ALTER ROLE grafana_reader WITH LOGIN PASSWORD %L"
            : "CREATE ROLE grafana_reader LOGIN PASSWORD %L";
        const formattedStatement = await client.query(
            "SELECT format($1, $2) AS statement",
            [roleStatement, grafanaPassword],
        );
        await client.query(formattedStatement.rows[0].statement);
        await client.query(
            "REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM grafana_reader",
        );
        await client.query(`
            DO $grant$
            BEGIN
                EXECUTE format(
                    'ALTER DEFAULT PRIVILEGES FOR ROLE %I IN SCHEMA public REVOKE SELECT ON TABLES FROM grafana_reader',
                    current_user
                );
            END
            $grant$;
        `);
        await client.query(`
            GRANT SELECT ON
                public.sites,
                public.equipment,
                public.equipment_passports,
                public.maintenance_requests,
                public.request_status_history,
                public.technicians,
                public.request_assignees
            TO grafana_reader
        `);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        await client.end();
    }
}

main().catch((error) => {
    console.error(JSON.stringify({
        event: "grafana_database_permissions_failed",
        errorType: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
        errorCode: error && typeof error === "object" && "code" in error
            ? error.code
            : undefined,
    }));
    process.exitCode = 1;
});
