import { app } from "./app.js";
import { env } from "./config/env.js";
import { sequelize, waitForDatabase } from "./config/database.js";
import { authService } from "./services/auth.service.js";
import { log } from "./utils/logger.js";

const port = env.port;

const startServer = async (): Promise<void> => {
    await waitForDatabase();
    await authService.bootstrapAccounts();

    const server = app.listen(port, () => {
        log("info", "server_started", { port });
    });

    let isShuttingDown = false;
    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.once(signal, () => {
            if (isShuttingDown) return;
            isShuttingDown = true;
            log("info", "server_shutdown_started", { signal });

            server.close((error) => {
                if (error) {
                    log("error", "http_server_close_failed", {
                        signal,
                        errorType: error.name,
                    });
                    process.exitCode = 1;
                }
                void sequelize.close().then(() => {
                    log("info", "server_shutdown_complete", { signal });
                }).catch((closeError: unknown) => {
                    log("error", "database_close_failed", {
                        signal,
                        errorType: closeError instanceof Error
                            ? closeError.name
                            : "UnknownError",
                    });
                    process.exitCode = 1;
                });
            });
        });
    }
};

void startServer().catch(async (error: unknown) => {
    log("fatal", "server_start_failed", {
        errorType: error instanceof Error ? error.name : "UnknownError",
        errorMessage: error instanceof Error ? error.message : String(error),
    });
    try {
        await sequelize.close();
    } catch (closeError: unknown) {
        log("error", "database_close_failed", {
            errorType: closeError instanceof Error ? closeError.name : "UnknownError",
        });
    }
    process.exitCode = 1;
});
