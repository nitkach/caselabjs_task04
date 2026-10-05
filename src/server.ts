import { app } from "./app.js";
import { env } from "./config/env.js";
import { sequelize, waitForDatabase } from "./config/database.js";
import { authService } from "./services/auth.service.js";

const port = env.port;

const startServer = async (): Promise<void> => {
    await waitForDatabase();
    await authService.bootstrapAccounts();

    const server = app.listen(port, () => {
        console.log(`Server started on http://localhost:${port}`);
    });

    for (const signal of ["SIGINT", "SIGTERM"] as const) {
        process.on(signal, () => {
            console.log(`Получен ${signal}, завершаю работу`);
            server.close((error) => {
                void sequelize.close().then(() => {
                    if (error) {
                        console.error("Ошибка при остановке HTTP-сервера", error);
                        process.exitCode = 1;
                        return;
                    }
                    process.exitCode = 0;
                }).catch((closeError: unknown) => {
                    console.error("Ошибка при закрытии соединения с БД", closeError);
                    process.exitCode = 1;
                });
            });
        });
    }
};

void startServer().catch(async (error: unknown) => {
    console.error("Не удалось подключиться к базе данных или запустить сервер", error);
    await sequelize.close();
    process.exitCode = 1;
});
