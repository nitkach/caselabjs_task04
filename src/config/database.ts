import "reflect-metadata";
import { Sequelize } from "sequelize-typescript";
import { env } from "./env.js";
import {
    EquipmentEntity,
    EquipmentPassportEntity,
    AuthSessionEntity,
    AuthUserEntity,
    MaintenanceRequestEntity,
    RequestAssigneeEntity,
    RequestStatusHistoryEntity,
    SiteEntity,
    TechnicianEntity,
} from "../models/entities/index.js";

export const sequelize = new Sequelize({
    dialect: "postgres",
    host: env.database.host,
    port: env.database.port,
    database: env.database.name,
    username: env.database.user,
    password: env.database.password,
    pool: env.database.pool,
    logging: false,
    models: [
        SiteEntity,
        EquipmentEntity,
        EquipmentPassportEntity,
        MaintenanceRequestEntity,
        RequestStatusHistoryEntity,
        TechnicianEntity,
        RequestAssigneeEntity,
        AuthUserEntity,
        AuthSessionEntity,
    ],
});

export async function waitForDatabase({ attempts = 10, baseDelayMs = 500 } = {}) {
    for (let attempt = 1; attempt <= attempts; attempt++) {
        try {
            await sequelize.authenticate();
            return;
        } catch (err) {
            if (attempt === attempts) throw err;
            const delay = baseDelayMs * attempt;
            console.warn(`База недоступна (попытка ${attempt}/${attempts}), повтор через ${delay} мс`);
            await new Promise((resolve) => setTimeout(resolve, delay));
        }
    }
}
