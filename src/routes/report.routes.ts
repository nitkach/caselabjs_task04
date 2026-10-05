import { Router } from "express";
import { authenticate } from "../middleware/authenticate.js";

import {
    getEquipmentLoadReport,
    getSiteSummary,
} from "../controllers/report.controller.js";

export const reportRouter = Router();

reportRouter.use("/sites", authenticate);
reportRouter.use("/reports", authenticate);
reportRouter.get("/sites/:id/summary", getSiteSummary);
reportRouter.get("/reports/equipment-load", getEquipmentLoadReport);
