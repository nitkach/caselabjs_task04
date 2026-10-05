import type { Request, Response } from "express";

import { maintenanceRequestService } from "../services/maintenanceRequest.service.js";
import type {
    CreateMaintenanceRequestInput,
    ReplaceRequestAssigneesInput,
    UpdateMaintenanceRequestInput,
    UpdateMaintenanceRequestStatusInput,
} from "../schemas/maintenanceRequest.schema.js";
import {
    maintenanceRequestListQuerySchema,
} from "../schemas/list.schema.js";
import { ValidationError } from "../errors/appError.js";

export async function listMaintenanceRequest(req: Request, res: Response): Promise<void> {
    const parsed = maintenanceRequestListQuerySchema.safeParse(req.query);
    if (!parsed.success) {
        throw new ValidationError("Invalid request list query");
    }

    res.json({
        success: true,
        ...await maintenanceRequestService.findAll(parsed.data),
    });
};


export async function createMaintenanceRequest(
    req: Request<Record<string, never>, unknown, CreateMaintenanceRequestInput>,
    res: Response<unknown>
): Promise<void> {
    const maintenanceRequest = await maintenanceRequestService.create(
        req.body,
        req.authUser?.email ?? "system",
    );

    res.status(201).json({
        success: true,
        data: maintenanceRequest,
    });
}

export async function getMaintenanceRequest(req: Request<{ id: string }>, res: Response<unknown>): Promise<void> {
    res.json({
        success: true,
        data: await maintenanceRequestService.findById(req.params.id),
    });
}


export async function patchMaintenanceRequest(
    req: Request<{ id: string }, unknown, UpdateMaintenanceRequestInput>,
    res: Response<unknown>
): Promise<void> {
    const maintenanceRequest = await maintenanceRequestService.update(req.params.id, req.body);

    res.status(200).json({
        success: true,
        data: maintenanceRequest,
    });
}

export async function patchMaintenanceRequestStatus(
    req: Request<{ id: string }, unknown, UpdateMaintenanceRequestStatusInput>,
    res: Response<unknown>,
): Promise<void> {
    const maintenanceRequest = await maintenanceRequestService.updateStatus(
        req.params.id,
        { ...req.body, changedBy: req.authUser?.email },
        req.authUser?.email,
        req.authUser?.role === "technician"
            ? req.authUser.technicianId
            : undefined,
    );

    res.status(200).json({
        success: true,
        data: maintenanceRequest,
    });
}

export async function replaceRequestAssignees(
    req: Request<{ id: string }, unknown, ReplaceRequestAssigneesInput>,
    res: Response<unknown>,
): Promise<void> {
    const maintenanceRequest = await maintenanceRequestService.replaceAssignees(
        req.params.id,
        req.body,
    );

    res.status(200).json({
        success: true,
        data: maintenanceRequest,
    });
}

export async function removeRequestAssignee(
    req: Request<{ id: string; userId: string }>,
    res: Response<unknown>,
): Promise<void> {
    await maintenanceRequestService.removeAssignee(
        req.params.id,
        req.params.userId,
    );
    res.sendStatus(204);
}

export async function getMaintenanceRequestHistory(
    req: Request<{ id: string }>,
    res: Response<unknown>,
): Promise<void> {
    res.status(200).json({
        success: true,
        data: await maintenanceRequestService.getHistory(req.params.id),
    });
}


export async function deleteMaintenanceRequest(req: Request<{ id: string }>, res: Response<unknown>): Promise<void> {
    await maintenanceRequestService.delete(req.params.id);

    res.sendStatus(204);
}
