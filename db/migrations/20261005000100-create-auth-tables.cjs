"use strict";

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.createTable(
                "auth_users",
                {
                    id: {
                        type: Sequelize.UUID,
                        allowNull: false,
                        primaryKey: true,
                    },
                    email: {
                        type: Sequelize.STRING(254),
                        allowNull: false,
                        unique: true,
                    },
                    password_hash: {
                        type: Sequelize.STRING(255),
                        allowNull: false,
                    },
                    role: {
                        type: Sequelize.STRING(20),
                        allowNull: false,
                        defaultValue: "viewer",
                    },
                    technician_id: {
                        type: Sequelize.UUID,
                        allowNull: true,
                        unique: true,
                        references: { model: "technicians", key: "id" },
                        onUpdate: "CASCADE",
                        onDelete: "RESTRICT",
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                },
                { transaction },
            );

            await queryInterface.addConstraint("auth_users", {
                fields: ["role"],
                type: "check",
                name: "auth_users_role_check",
                where: {
                    role: ["viewer", "technician", "admin"],
                },
                transaction,
            });

            await queryInterface.createTable(
                "auth_sessions",
                {
                    id: {
                        type: Sequelize.UUID,
                        allowNull: false,
                        primaryKey: true,
                    },
                    user_id: {
                        type: Sequelize.UUID,
                        allowNull: false,
                        references: { model: "auth_users", key: "id" },
                        onUpdate: "CASCADE",
                        onDelete: "CASCADE",
                    },
                    token_hash: {
                        type: Sequelize.STRING(64),
                        allowNull: false,
                        unique: true,
                    },
                    expires_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                    revoked_at: {
                        type: Sequelize.DATE,
                        allowNull: true,
                    },
                    created_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                    updated_at: {
                        type: Sequelize.DATE,
                        allowNull: false,
                    },
                },
                { transaction },
            );
            await queryInterface.addIndex("auth_sessions", ["user_id"], {
                transaction,
            });
            await queryInterface.addIndex("auth_sessions", ["expires_at"], {
                transaction,
            });
        });
    },

    async down(queryInterface) {
        await queryInterface.sequelize.transaction(async (transaction) => {
            await queryInterface.dropTable("auth_sessions", { transaction });
            await queryInterface.dropTable("auth_users", { transaction });
        });
    },
};
