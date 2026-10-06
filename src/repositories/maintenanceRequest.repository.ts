import { Op, type Transaction, type WhereOptions } from "sequelize";

import type { MaintenanceRequest } from "../models/maintenanceRequest.model.js";
import type { MaintenanceRequestListQuery } from "../schemas/list.schema.js";
import {
    MaintenanceRequestEntity,
    RequestAssigneeEntity,
    RequestStatusHistoryEntity,
    TechnicianEntity,
} from "../models/entities/index.js";

const requestAttributes = [
    "id",
    "equipmentId",
    "title",
    "description",
    "priority",
    "status",
    "plannedAt",
    "author",
    "createdAt",
    "updatedAt",
] as const;

const technicianAttributes = [
    "id",
    "fullName",
    "specialization",
    "employeeNumber",
] as const;

const sortColumns = {
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    plannedAt: "plannedAt",
    priority: "priority",
} as const;

function toMaintenanceRequest(entity: MaintenanceRequestEntity): MaintenanceRequest {
    return {
        id: entity.id,
        equipmentId: entity.equipmentId,
        title: entity.title,
        ...(entity.description === null ? {} : { description: entity.description }),
        priority: entity.priority,
        status: entity.status,
        ...(entity.plannedAt === null
            ? {}
            : { plannedAt: entity.plannedAt.toISOString() }),
        createdAt: entity.createdAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        author: entity.author,
        assignees: (entity.assignees ?? []).flatMap((technician) => {
            const assignment = technician.RequestAssigneeEntity;
            if (!assignment) return [];
            return [{
                id: technician.id,
                fullName: technician.fullName,
                specialization: technician.specialization,
                employeeNumber: technician.employeeNumber,
                role: assignment.role,
                hours: Number(assignment.hours),
            }];
        }),
    };
}

const requestIncludes = [
    {
        model: TechnicianEntity,
        as: "assignees",
        attributes: [...technicianAttributes],
        through: {
            model: RequestAssigneeEntity,
            attributes: ["role", "hours"],
        },
        required: false,
    },
];

export class MaintenanceRequestRepository {
    async findAll(query: MaintenanceRequestListQuery): Promise<{
        rows: MaintenanceRequest[];
        count: number;
    }> {
        const where: WhereOptions<MaintenanceRequestEntity> = {};
        if (query.status) where.status = query.status;
        if (query.priority) where.priority = query.priority;
        if (query.equipmentId) where.equipmentId = query.equipmentId;
        if (query.createdFrom || query.createdTo) {
            const createdAt: { [Op.gte]?: Date;[Op.lte]?: Date } = {};
            if (query.createdFrom) createdAt[Op.gte] = new Date(query.createdFrom);
            if (query.createdTo) createdAt[Op.lte] = new Date(query.createdTo);
            where.createdAt = createdAt;
        }
        if (query.plannedFrom || query.plannedTo) {
            const plannedAt: { [Op.gte]?: Date;[Op.lte]?: Date } = {};
            if (query.plannedFrom) plannedAt[Op.gte] = new Date(query.plannedFrom);
            if (query.plannedTo) plannedAt[Op.lte] = new Date(query.plannedTo);
            where.plannedAt = plannedAt;
        }

        const result = await MaintenanceRequestEntity.findAndCountAll({
            attributes: [...requestAttributes],
            include: requestIncludes,
            where,
            order: [[sortColumns[query.sortBy], query.sortOrder === "asc" ? "ASC" : "DESC"]],
            limit: query.limit,
            offset: (query.page - 1) * query.limit,
            distinct: true,
        });

        return {
            rows: result.rows.map(toMaintenanceRequest),
            count: result.count,
        };
    }

    async findById(
        id: string,
        transaction?: Transaction,
    ): Promise<MaintenanceRequest | undefined> {
        const entity = await MaintenanceRequestEntity.findByPk(id, {
            attributes: [...requestAttributes],
            include: requestIncludes,
            transaction,
        });
        return entity ? toMaintenanceRequest(entity) : undefined;
    }

    async findByIdForUpdate(
        id: string,
        transaction: Transaction,
    ): Promise<MaintenanceRequestEntity | null> {
        return MaintenanceRequestEntity.findByPk(id, {
            transaction,
            lock: transaction.LOCK.UPDATE,
        });
    }

    async create(input: {
        equipmentId: string;
        title: string;
        description?: string;
        priority: MaintenanceRequest["priority"];
        plannedAt?: Date;
        author: string;
    }, transaction: Transaction): Promise<MaintenanceRequestEntity> {
        const entity = await MaintenanceRequestEntity.create({
            ...input,
            status: "new",
        }, { transaction });
        await RequestStatusHistoryEntity.create({
            requestId: entity.id,
            previousStatus: null,
            newStatus: "new",
            changedBy: input.author,
            comment: "Request created",
            changedAt: new Date(),
        }, { transaction });
        return entity;
    }

    async createHistoryEntry(
        values: {
            requestId: string;
            previousStatus: MaintenanceRequest["status"] | null;
            newStatus: MaintenanceRequest["status"];
            changedBy: string;
            comment: string | null;
        },
        transaction: Transaction,
    ): Promise<void> {
        await RequestStatusHistoryEntity.create({
            ...values,
            changedAt: new Date(),
        }, { transaction });
    }

    async updateStatus(
        request: MaintenanceRequestEntity,
        status: MaintenanceRequest["status"],
        transaction: Transaction,
    ): Promise<void> {
        await request.update({ status }, { transaction });
    }

    async countAssignees(
        requestId: string,
        transaction: Transaction,
    ): Promise<number> {
        return RequestAssigneeEntity.count({
            where: { requestId },
            transaction,
        });
    }

    async isAssignedTechnician(
        requestId: string,
        technicianId: string,
        transaction: Transaction,
    ): Promise<boolean> {
        return (await RequestAssigneeEntity.count({
            where: { requestId, technicianId },
            transaction,
        })) > 0;
    }

    async findAssignee(
        requestId: string,
        technicianId: string,
        transaction: Transaction,
    ): Promise<RequestAssigneeEntity | null> {
        return RequestAssigneeEntity.findOne({
            where: { requestId, technicianId },
            transaction,
        });
    }

    async countLeadAssignees(
        requestId: string,
        transaction: Transaction,
    ): Promise<number> {
        return RequestAssigneeEntity.count({
            where: { requestId, role: "lead" },
            transaction,
        });
    }

    async findTechnicians(
        ids: string[],
        transaction: Transaction,
    ): Promise<TechnicianEntity[]> {
        return TechnicianEntity.findAll({
            attributes: ["id"],
            where: { id: { [Op.in]: ids } },
            transaction,
        });
    }

    async replaceAssignees(
        requestId: string,
        assignees: Array<{
            technicianId: string;
            role: "lead" | "member";
            hours: number;
        }>,
        transaction: Transaction,
    ): Promise<void> {
        await RequestAssigneeEntity.destroy({
            where: { requestId },
            transaction,
        });
        await RequestAssigneeEntity.bulkCreate(
            assignees.map((assignee) => ({ requestId, ...assignee })),
            { transaction },
        );
    }

    async removeAssignee(
        requestId: string,
        technicianId: string,
        transaction: Transaction,
    ): Promise<number> {
        return RequestAssigneeEntity.destroy({
            where: { requestId, technicianId },
            transaction,
        });
    }

    async findHistory(requestId: string): Promise<Array<{
        id: string;
        previousStatus: MaintenanceRequest["status"] | null;
        newStatus: MaintenanceRequest["status"];
        changedBy: string;
        comment: string | null;
        changedAt: string;
    }>> {
        const rows = await RequestStatusHistoryEntity.findAll({
            attributes: ["id", "previousStatus", "newStatus", "changedBy", "comment", "changedAt"],
            where: { requestId },
            order: [["changedAt", "ASC"], ["id", "ASC"]],
        });
        return rows.map((row) => ({
            id: row.id,
            previousStatus: row.previousStatus,
            newStatus: row.newStatus,
            changedBy: row.changedBy,
            comment: row.comment,
            changedAt: row.changedAt.toISOString(),
        }));
    }

    async reloadInTransaction(
        id: string,
        transaction: Transaction,
    ): Promise<MaintenanceRequest> {
        const request = await this.findById(id, transaction);
        if (!request) {
            throw new Error(`Request ${id} could not be reloaded`);
        }
        return request;
    }

    async update(
        id: string,
        changes: Partial<Pick<
            MaintenanceRequest,
            "title" | "description" | "priority" | "status"
        >> & { plannedAt?: Date | null },
    ): Promise<MaintenanceRequest | undefined> {
        const entity = await MaintenanceRequestEntity.findByPk(id);
        if (!entity) return undefined;

        await entity.update(changes);
        return this.findById(id);
    }

    async hasOpenByEquipmentId(equipmentId: string): Promise<boolean> {
        const count = await MaintenanceRequestEntity.count({
            where: {
                equipmentId,
                status: { [Op.in]: ["new", "in_progress"] },
            },
        });
        return count > 0;
    }

    async delete(id: string): Promise<MaintenanceRequest | undefined> {
        const entity = await MaintenanceRequestEntity.findByPk(id, {
            attributes: [...requestAttributes],
            include: requestIncludes,
        });
        if (!entity) return undefined;

        const request = toMaintenanceRequest(entity);
        await entity.destroy();
        return request;
    }
}

export const maintenanceRequestRepository = new MaintenanceRequestRepository();
