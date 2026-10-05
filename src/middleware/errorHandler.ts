import type { ErrorRequestHandler } from "express";
import {
    DatabaseError,
    ForeignKeyConstraintError,
    UniqueConstraintError,
} from "sequelize";

import {
    AppError,
    ConflictError,
    NotFoundError,
    ValidationError,
    type ErrorDetail,
} from "../errors/appError.js";
import { log } from "../utils/logger.js";

const defaultMessage = "Внутренняя ошибка сервера";

function mapDatabaseError(error: unknown): AppError | undefined {
    if (error instanceof UniqueConstraintError) {
        return new ConflictError("A resource with these unique fields already exists");
    }
    if (error instanceof ForeignKeyConstraintError) {
        return new NotFoundError("Related resource not found");
    }
    if (error instanceof DatabaseError) {
        const code = (error.parent as NodeJS.ErrnoException).code;
        if (code === "23001") {
            return new ConflictError("Resource is still referenced by related records");
        }
        if (code === "23514") {
            return new ValidationError("Database constraint validation failed");
        }
        if (code === "23503" || code === "22P02") {
            return new NotFoundError("Related resource not found");
        }
    }
    return undefined;
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (res.headersSent) {
        next(err);
        return;
    }

    const appError = err instanceof AppError ? err : mapDatabaseError(err);
    const statusCode = appError?.statusCode ?? 500;
    const isProduction = process.env.NODE_ENV === "production";
    const isSafeAppError = appError !== undefined && statusCode < 500;
    const message = isSafeAppError
        ? appError.message
        : !isProduction && err instanceof Error
            ? err.message
            : defaultMessage;

    if (statusCode >= 500) {
        log("error", "http_error", {
            requestId: req.requestId,
            method: req.method,
            path: req.path,
            statusCode,
            errorType: err instanceof Error ? err.name : "UnknownError",
            errorCode: appError?.code,
        });
    }

    const response: {
        error: {
            code: string;
            message: string;
            details: ErrorDetail[];
            requestId: string;
            stack?: string;
        };
    } = {
        error: {
            code: appError?.code ?? "INTERNAL_SERVER_ERROR",
            message,
            details: isProduction && statusCode >= 500 ? [] : appError?.details ?? [],
            requestId: req.requestId,
        },
    };

    if (!isProduction && err instanceof Error) {
        response.error.stack = err.stack;
    }

    res.status(statusCode).json(response);
};
