import {
    AllowNull,
    BelongsTo,
    BelongsToMany,
    Column,
    DataType,
    Default,
    ForeignKey,
    HasMany,
    HasOne,
    Model,
    PrimaryKey,
    Table,
    Unique,
} from "sequelize-typescript";

export type EquipmentKind = "turbine" | "inverter" | "sensor" | "substation";
export type EquipmentState =
    | "operational"
    | "maintenance"
    | "fault"
    | "decommissioned";
export type RequestPriority = "low" | "medium" | "high" | "critical";
export type RequestState = "new" | "in_progress" | "done" | "rejected";
export type AssigneeRole = "lead" | "member";
export type UserRole = "viewer" | "technician" | "admin";

@Table({ tableName: "sites", timestamps: true, underscored: true })
export class SiteEntity extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare name: string;

    @Unique
    @AllowNull(false)
    @Column(DataType.STRING(30))
    declare code: string;

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare region: string;

    @AllowNull(false)
    @Column({ type: DataType.DECIMAL(9, 6), field: "latitude" })
    declare latitude: string;

    @AllowNull(false)
    @Column({ type: DataType.DECIMAL(9, 6), field: "longitude" })
    declare longitude: string;

    declare createdAt: Date;
    declare updatedAt: Date;

    @HasMany(() => EquipmentEntity, "siteId")
    declare equipment?: EquipmentEntity[];
}

@Table({
    tableName: "equipment",
    timestamps: true,
    underscored: true,
    indexes: [{ fields: ["site_id"] }],
})
export class EquipmentEntity extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @ForeignKey(() => SiteEntity)
    @AllowNull(false)
    @Column({ type: DataType.UUID, field: "site_id" })
    declare siteId: string;

    @AllowNull(false)
    @Column(DataType.STRING(100))
    declare name: string;

    @AllowNull(false)
    @Column(DataType.STRING(20))
    declare type: EquipmentKind;

    @Unique
    @AllowNull(false)
    @Column({ type: DataType.STRING(80), field: "serial_number" })
    declare serialNumber: string;

    @AllowNull(false)
    @Column(DataType.STRING(20))
    declare status: EquipmentState;

    @AllowNull(false)
    @Column({ type: DataType.DATE, field: "installed_at" })
    declare installedAt: Date;

    declare createdAt: Date;
    declare updatedAt: Date;

    @BelongsTo(() => SiteEntity, "siteId")
    declare site?: SiteEntity;

    @HasOne(() => EquipmentPassportEntity, "equipmentId")
    declare passport?: EquipmentPassportEntity | null;

    @HasMany(() => MaintenanceRequestEntity, "equipmentId")
    declare requests?: MaintenanceRequestEntity[];
}

@Table({ tableName: "equipment_passports", timestamps: true, underscored: true })
export class EquipmentPassportEntity extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @ForeignKey(() => EquipmentEntity)
    @Unique
    @AllowNull(false)
    @Column({ type: DataType.UUID, field: "equipment_id" })
    declare equipmentId: string;

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare manufacturer: string;

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare model: string;

    @AllowNull(false)
    @Column({ type: DataType.DECIMAL(12, 3), field: "rated_power_kw" })
    declare ratedPowerKw: string;

    @AllowNull(true)
    @Column({ type: DataType.DATEONLY, field: "last_calibration_at" })
    declare lastCalibrationAt: string | null;

    declare createdAt: Date;
    declare updatedAt: Date;

    @BelongsTo(() => EquipmentEntity, "equipmentId")
    declare equipment?: EquipmentEntity;
}

@Table({
    tableName: "maintenance_requests",
    timestamps: true,
    underscored: true,
    indexes: [
        { fields: ["equipment_id"] },
        { fields: ["status", "priority"] },
        { fields: ["created_at"] },
        { fields: ["planned_at"] },
    ],
})
export class MaintenanceRequestEntity extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @ForeignKey(() => EquipmentEntity)
    @AllowNull(false)
    @Column({ type: DataType.UUID, field: "equipment_id" })
    declare equipmentId: string;

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare title: string;

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare description: string | null;

    @AllowNull(false)
    @Column(DataType.STRING(20))
    declare priority: RequestPriority;

    @AllowNull(false)
    @Default("new")
    @Column(DataType.STRING(20))
    declare status: RequestState;

    @AllowNull(true)
    @Column({ type: DataType.DATE, field: "planned_at" })
    declare plannedAt: Date | null;

    @AllowNull(false)
    @Default("system")
    @Column(DataType.STRING(120))
    declare author: string;

    declare createdAt: Date;
    declare updatedAt: Date;

    @BelongsTo(() => EquipmentEntity, "equipmentId")
    declare equipment?: EquipmentEntity;

    @HasMany(() => RequestStatusHistoryEntity, "requestId")
    declare statusHistory?: RequestStatusHistoryEntity[];

    @HasMany(() => RequestAssigneeEntity, "requestId")
    declare assignments?: RequestAssigneeEntity[];

    @BelongsToMany(
        () => TechnicianEntity,
        () => RequestAssigneeEntity,
        "requestId",
        "technicianId",
    )
    declare assignees?: TechnicianEntity[];
}

@Table({
    tableName: "request_status_history",
    timestamps: false,
    underscored: true,
    indexes: [{ fields: ["request_id", "changed_at"] }],
})
export class RequestStatusHistoryEntity extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @ForeignKey(() => MaintenanceRequestEntity)
    @AllowNull(false)
    @Column({ type: DataType.UUID, field: "request_id" })
    declare requestId: string;

    @AllowNull(true)
    @Column({ type: DataType.STRING(20), field: "previous_status" })
    declare previousStatus: RequestState | null;

    @AllowNull(false)
    @Column({ type: DataType.STRING(20), field: "new_status" })
    declare newStatus: RequestState;

    @AllowNull(false)
    @Column({ type: DataType.STRING(120), field: "changed_by" })
    declare changedBy: string;

    @AllowNull(true)
    @Column(DataType.TEXT)
    declare comment: string | null;

    @AllowNull(false)
    @Column({ type: DataType.DATE, field: "changed_at" })
    declare changedAt: Date;

    @BelongsTo(() => MaintenanceRequestEntity, "requestId")
    declare request?: MaintenanceRequestEntity;
}

@Table({
    tableName: "technicians",
    timestamps: true,
    underscored: true,
})
export class TechnicianEntity extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @AllowNull(false)
    @Column({ type: DataType.STRING(160), field: "full_name" })
    declare fullName: string;

    @AllowNull(false)
    @Column(DataType.STRING(120))
    declare specialization: string;

    @Unique
    @AllowNull(false)
    @Column({ type: DataType.STRING(40), field: "employee_number" })
    declare employeeNumber: string;

    declare createdAt: Date;
    declare updatedAt: Date;

    @HasMany(() => RequestAssigneeEntity, "technicianId")
    declare assignments?: RequestAssigneeEntity[];

    @BelongsToMany(
        () => MaintenanceRequestEntity,
        () => RequestAssigneeEntity,
        "technicianId",
        "requestId",
    )
    declare requests?: MaintenanceRequestEntity[];

    declare RequestAssigneeEntity?: RequestAssigneeEntity;
}

@Table({
    tableName: "request_assignees",
    timestamps: false,
    underscored: true,
    indexes: [{ fields: ["technician_id"] }],
})
export class RequestAssigneeEntity extends Model {
    @ForeignKey(() => MaintenanceRequestEntity)
    @PrimaryKey
    @AllowNull(false)
    @Column({ type: DataType.UUID, field: "request_id" })
    declare requestId: string;

    @ForeignKey(() => TechnicianEntity)
    @PrimaryKey
    @AllowNull(false)
    @Column({ type: DataType.UUID, field: "technician_id" })
    declare technicianId: string;

    @AllowNull(false)
    @Column(DataType.STRING(10))
    declare role: AssigneeRole;

    @AllowNull(false)
    @Column(DataType.DECIMAL(6, 2))
    declare hours: string;

    @BelongsTo(() => MaintenanceRequestEntity, "requestId")
    declare request?: MaintenanceRequestEntity;

    @BelongsTo(() => TechnicianEntity, "technicianId")
    declare technician?: TechnicianEntity;
}

@Table({
    tableName: "auth_users",
    timestamps: true,
    underscored: true,
    indexes: [{ unique: true, fields: ["email"] }],
})
export class AuthUserEntity extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @Unique
    @AllowNull(false)
    @Column(DataType.STRING(254))
    declare email: string;

    @AllowNull(false)
    @Column({ type: DataType.STRING(255), field: "password_hash" })
    declare passwordHash: string;

    @AllowNull(false)
    @Default("viewer")
    @Column(DataType.STRING(20))
    declare role: UserRole;

    @ForeignKey(() => TechnicianEntity)
    @Unique
    @AllowNull(true)
    @Column({ type: DataType.UUID, field: "technician_id" })
    declare technicianId: string | null;

    declare createdAt: Date;
    declare updatedAt: Date;

    @BelongsTo(() => TechnicianEntity, "technicianId")
    declare technician?: TechnicianEntity | null;

    @HasMany(() => AuthSessionEntity, "userId")
    declare sessions?: AuthSessionEntity[];
}

@Table({
    tableName: "auth_sessions",
    timestamps: true,
    underscored: true,
    indexes: [
        { unique: true, fields: ["token_hash"] },
        { fields: ["user_id"] },
        { fields: ["expires_at"] },
    ],
})
export class AuthSessionEntity extends Model {
    @PrimaryKey
    @Default(DataType.UUIDV4)
    @Column(DataType.UUID)
    declare id: string;

    @ForeignKey(() => AuthUserEntity)
    @AllowNull(false)
    @Column({ type: DataType.UUID, field: "user_id" })
    declare userId: string;

    @AllowNull(false)
    @Column({ type: DataType.STRING(64), field: "token_hash" })
    declare tokenHash: string;

    @AllowNull(false)
    @Column({ type: DataType.DATE, field: "expires_at" })
    declare expiresAt: Date;

    @AllowNull(true)
    @Column({ type: DataType.DATE, field: "revoked_at" })
    declare revokedAt: Date | null;

    declare createdAt: Date;
    declare updatedAt: Date;

    @BelongsTo(() => AuthUserEntity, "userId")
    declare user?: AuthUserEntity;
}
