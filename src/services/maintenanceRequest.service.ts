import { ForeignKeyConstraintError } from "sequelize";

import { sequelize } from "../config/database.js";
import type {
    MaintenanceRequest,
} from "../models/maintenanceRequest.model.js";
import {
    EquipmentRepository,
    equipmentRepository,
} from "../repositories/equipment.repository.js";
import {
    MaintenanceRequestRepository,
    maintenanceRequestRepository,
} from "../repositories/maintenanceRequest.repository.js";
import type {
    CreateMaintenanceRequestInput,
    UpdateMaintenanceRequestInput,
    UpdateMaintenanceRequestStatusInput,
    ReplaceRequestAssigneesInput,
} from "../schemas/maintenanceRequest.schema.js";
import type { MaintenanceRequestListQuery } from "../schemas/list.schema.js";
import {
    ConflictError,
    ForbiddenError,
    NotFoundError,
    UnprocessableEntityError,
} from "../errors/appError.js";

export class MaintenanceRequestService {
    constructor(
        private readonly equipmentRepo: EquipmentRepository = equipmentRepository,
        private readonly maintenanceRequestRepo: MaintenanceRequestRepository = maintenanceRequestRepository,
    ) { }

    async findAll(query: MaintenanceRequestListQuery = {
        page: 1,
        limit: 20,
        sortBy: "createdAt",
        sortOrder: "asc",
    }): Promise<{
        data: MaintenanceRequest[];
        meta: { total: number; page: number; limit: number };
    }> {
        const result = await this.maintenanceRequestRepo.findAll(query);
        return {
            data: result.rows,
            meta: { total: result.count, page: query.page, limit: query.limit },
        };
    }

    async findById(id: string): Promise<MaintenanceRequest> {
        const request = await this.maintenanceRequestRepo.findById(id);
        if (!request) {
            throw new NotFoundError("Maintenance request not found");
        }
        return request;
    }

    async create(
        input: CreateMaintenanceRequestInput,
        author = "system",
    ): Promise<MaintenanceRequest> {
        const equipment = await this.equipmentRepo.findById(input.equipmentId);
        if (!equipment) {
            throw new NotFoundError("Equipment not found");
        }

        return sequelize.transaction(async (transaction) => {
            const created = await this.maintenanceRequestRepo.create({
                equipmentId: equipment.id,
                title: input.title,
                ...(input.description === undefined
                    ? {}
                    : { description: input.description }),
                priority: input.priority,
                author,
                ...(input.plannedAt === undefined
                    ? {}
                    : { plannedAt: new Date(input.plannedAt) }),
            }, transaction);
            return this.maintenanceRequestRepo.reloadInTransaction(
                created.id,
                transaction,
            );
        });
    }

    async findByEquipmentId(
        equipmentId: string,
        query: MaintenanceRequestListQuery,
    ): Promise<{
        data: MaintenanceRequest[];
        meta: { total: number; page: number; limit: number };
    }> {
        const equipment = await this.equipmentRepo.findById(equipmentId);
        if (!equipment) {
            throw new NotFoundError("Equipment not found");
        }

        const result = await this.maintenanceRequestRepo.findAll({
            ...query,
            equipmentId,
        });
        return {
            data: result.rows,
            meta: { total: result.count, page: query.page, limit: query.limit },
        };
    }

    async update(
        id: string,
        input: UpdateMaintenanceRequestInput,
    ): Promise<MaintenanceRequest> {
        await this.findById(id);
        const { plannedAt, ...changes } = input;
        const updated = await this.maintenanceRequestRepo.update(id, {
            ...changes,
            ...(plannedAt === undefined
                ? {}
                : { plannedAt: new Date(plannedAt) }),
        });

        if (!updated) {
            throw new NotFoundError("Maintenance request not found");
        }
        return updated;
    }

    async updateStatus(
        id: string,
        input: UpdateMaintenanceRequestStatusInput,
        actor = input.changedBy ?? "system",
        technicianId?: string | null,
    ): Promise<MaintenanceRequest> {
        return sequelize.transaction(async (transaction) => {
            const current = await this.maintenanceRequestRepo.findByIdForUpdate(
                id,
                transaction,
            );
            if (!current) {
                throw new NotFoundError("Maintenance request not found");
            }
            if (
                technicianId !== undefined
                && (!technicianId || !await this.maintenanceRequestRepo.isAssignedTechnician(
                    id,
                    technicianId,
                    transaction,
                ))
            ) {
                throw new ForbiddenError(
                    "Technicians can only change the status of assigned requests",
                );
            }

            const allowedTransitions: Record<
                MaintenanceRequest["status"],
                MaintenanceRequest["status"][]
            > = {
                new: ["in_progress", "rejected"],
                in_progress: ["done", "rejected"],
                done: [],
                rejected: [],
            };
            if (!allowedTransitions[current.status].includes(input.status)) {
                throw new ConflictError("Invalid maintenance request status transition");
            }

            if (input.status === "in_progress") {
                const assigneeCount = await this.maintenanceRequestRepo.countAssignees(
                    id,
                    transaction,
                );
                if (assigneeCount === 0) {
                    throw new ConflictError(
                        "Maintenance request cannot start without assigned technicians",
                    );
                }
            }

            await this.maintenanceRequestRepo.updateStatus(
                current,
                input.status,
                transaction,
            );
            await this.maintenanceRequestRepo.createHistoryEntry({
                requestId: id,
                previousStatus: current.status,
                newStatus: input.status,
                changedBy: actor,
                comment: input.comment ?? null,
            }, transaction);

            return this.maintenanceRequestRepo.reloadInTransaction(id, transaction);
        });
    }

    async replaceAssignees(
        id: string,
        input: ReplaceRequestAssigneesInput,
    ): Promise<MaintenanceRequest> {
        const ids = input.assignees.map(({ technicianId }) => technicianId);
        if (new Set(ids).size !== ids.length) {
            throw new ConflictError("A technician can only be assigned once per request");
        }

        const leadCount = input.assignees.filter(({ role }) => role === "lead").length;
        if (leadCount !== 1) {
            throw new UnprocessableEntityError(
                "Exactly one technician must have the lead role",
            );
        }

        return sequelize.transaction(async (transaction) => {
            const request = await this.maintenanceRequestRepo.findByIdForUpdate(
                id,
                transaction,
            );
            if (!request) {
                throw new NotFoundError("Maintenance request not found");
            }

            const technicians = await this.maintenanceRequestRepo.findTechnicians(
                ids,
                transaction,
            );
            if (technicians.length !== ids.length) {
                throw new NotFoundError("Technician not found");
            }

            await this.maintenanceRequestRepo.replaceAssignees(
                id,
                input.assignees,
                transaction,
            );
            return this.maintenanceRequestRepo.reloadInTransaction(id, transaction);
        });
    }

    async removeAssignee(
        requestId: string,
        technicianId: string,
    ): Promise<void> {
        await sequelize.transaction(async (transaction) => {
            const request = await this.maintenanceRequestRepo.findByIdForUpdate(
                requestId,
                transaction,
            );
            if (!request) {
                throw new NotFoundError("Maintenance request not found");
            }

            const assignment = await this.maintenanceRequestRepo.findAssignee(
                requestId,
                technicianId,
                transaction,
            );
            if (!assignment) {
                throw new NotFoundError("Technician is not assigned to this request");
            }

            if (assignment.role === "lead") {
                const assignmentCount = await this.maintenanceRequestRepo.countAssignees(
                    requestId,
                    transaction,
                );
                if (request.status === "in_progress" && assignmentCount === 1) {
                    throw new ConflictError(
                        "An in-progress request must retain at least one assigned technician",
                    );
                }
                if (assignmentCount > 1) {
                    throw new UnprocessableEntityError(
                        "The lead cannot be removed while other technicians remain assigned",
                    );
                }
            }

            const deleted = await this.maintenanceRequestRepo.removeAssignee(
                requestId,
                technicianId,
                transaction,
            );
            if (deleted === 0) {
                throw new NotFoundError("Technician is not assigned to this request");
            }
        });
    }

    async getHistory(id: string) {
        await this.findById(id);
        return this.maintenanceRequestRepo.findHistory(id);
    }

    async delete(id: string): Promise<MaintenanceRequest> {
        await this.findById(id);
        try {
            const deletedRequest = await this.maintenanceRequestRepo.delete(id);
            if (!deletedRequest) {
                throw new NotFoundError("Maintenance request not found");
            }
            return deletedRequest;
        } catch (error) {
            if (error instanceof ForeignKeyConstraintError) {
                throw new ConflictError("Maintenance request has immutable status history");
            }
            throw error;
        }
    }
}

export const maintenanceRequestService = new MaintenanceRequestService();
