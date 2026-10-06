import { Router } from "express";

import {
    createEquipment,
    getEquipment,
    listEquipment,
    patchEquipment,
    deleteEquipment,
    getMaintenanceRequestsByEquipmentId,
    getWeatherForecast,
} from "../controllers/equipment.controller.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";
import {
    createEquipmentSchema,
    updateEquipmentSchema,
} from "../schemas/equipment.schema.js";

export const equipmentRouter = Router();

equipmentRouter.use("/equipment", authenticate);
equipmentRouter.get("/equipment", listEquipment);

equipmentRouter.post(
    "/equipment",
    requireRole("admin"),
    validateRequest(createEquipmentSchema),
    createEquipment,
);

equipmentRouter.get("/equipment/:id", getEquipment);

equipmentRouter.patch(
    "/equipment/:id",
    requireRole("admin"),
    validateRequest(updateEquipmentSchema),
    patchEquipment,
);

equipmentRouter.delete(
    "/equipment/:id",
    requireRole("admin"),
    deleteEquipment
);

equipmentRouter.get(
    "/equipment/:id/requests",
    getMaintenanceRequestsByEquipmentId
);

equipmentRouter.get(
    "/equipment/:id/weather",
    asyncHandler(getWeatherForecast)
);
//    req: Request<{ id: string; }, any, any, ParsedQs, Record<string, any>>
// RequestHandler<ParamsDictionary, any, any, ParsedQs, Record<string, any>>
