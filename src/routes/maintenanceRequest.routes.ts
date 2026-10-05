import { Router } from "express";
import {
    listMaintenanceRequest,
    createMaintenanceRequest,
    getMaintenanceRequest,
    patchMaintenanceRequest,
    patchMaintenanceRequestStatus,
    deleteMaintenanceRequest,
    replaceRequestAssignees,
    removeRequestAssignee,
    getMaintenanceRequestHistory,
} from "../controllers/maintenanceRequest.controller.js";
import { validateRequest } from "../middleware/validateRequest.js";
import { authenticate } from "../middleware/authenticate.js";
import { requireRole } from "../middleware/requireRole.js";
import {
    createMaintenanceRequestSchema,
    updateMaintenanceRequestSchema,
    updateMaintenanceRequestStatusSchema,
    replaceRequestAssigneesSchema,
} from "../schemas/maintenanceRequest.schema.js";
export const maintenanceRequestRouter = Router();

maintenanceRequestRouter.use("/requests", authenticate);
maintenanceRequestRouter.get("/requests", listMaintenanceRequest);

maintenanceRequestRouter.post(
    "/requests",
    requireRole("technician", "admin"),
    validateRequest(createMaintenanceRequestSchema),
    createMaintenanceRequest,
);

maintenanceRequestRouter.get("/requests/:id", getMaintenanceRequest);

maintenanceRequestRouter.patch(
    "/requests/:id",
    requireRole("technician", "admin"),
    validateRequest(updateMaintenanceRequestSchema),
    patchMaintenanceRequest,
);

maintenanceRequestRouter.patch(
    "/requests/:id/status",
    requireRole("technician", "admin"),
    validateRequest(updateMaintenanceRequestStatusSchema),
    patchMaintenanceRequestStatus,
);

maintenanceRequestRouter.post(
    "/requests/:id/assignees",
    requireRole("admin"),
    validateRequest(replaceRequestAssigneesSchema),
    replaceRequestAssignees,
);

maintenanceRequestRouter.delete(
    "/requests/:id/assignees/:userId",
    requireRole("admin"),
    removeRequestAssignee,
);

maintenanceRequestRouter.get(
    "/requests/:id/history",
    getMaintenanceRequestHistory,
);

maintenanceRequestRouter.delete(
    "/requests/:id",
    requireRole("admin"),
    deleteMaintenanceRequest
);
