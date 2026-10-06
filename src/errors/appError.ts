export interface ErrorDetail {
    field?: string;
    message: string;
}

export type AppErrorCode =
    | "VALIDATION_ERROR"
    | "NOT_FOUND"
    | "CONFLICT"
    | "UNPROCESSABLE_ENTITY"
    | "EXTERNAL_SERVICE_ERROR"
    | "UNAUTHORIZED"
    | "FORBIDDEN"
    | "INTERNAL_SERVER_ERROR";

export abstract class AppError extends Error {
    public readonly statusCode: number;
    public readonly code: AppErrorCode = "INTERNAL_SERVER_ERROR";
    public readonly details: ErrorDetail[];

    constructor(
        statusCode: number,
        message: string,
        code: AppErrorCode,
        details: ErrorDetail[] = [],
    ) {
        super(message);
        this.name = "AppError";
        this.statusCode = statusCode;
        this.code = code;
        this.details = [...details];
        Object.setPrototypeOf(this, new.target.prototype);
        Error.captureStackTrace(this, new.target);
    }
}

export class NotFoundError extends AppError {
    constructor(message = "Resource not found") {
        super(404, message, "NOT_FOUND");
        this.name = "NotFoundError";
    }
}

export class ValidationError extends AppError {
    constructor(
        message = "Некорректные данные запроса",
        details: ErrorDetail[] = [],
    ) {
        super(400, message, "VALIDATION_ERROR", details);
        this.name = "ValidationError";
    }
}

export class ConflictError extends AppError {
    constructor(message = "Conflict") {
        super(409, message, "CONFLICT");
        this.name = "ConflictError";
    }
}

export class UnprocessableEntityError extends AppError {
    constructor(message = "The request cannot be processed") {
        super(422, message, "UNPROCESSABLE_ENTITY");
        this.name = "UnprocessableEntityError";
    }
}

export class ExternalServiceError extends AppError {
    constructor(message = "External service is unavailable") {
        super(502, message, "EXTERNAL_SERVICE_ERROR");
        this.name = "ExternalServiceError";
    }
}

export class UnauthorizedError extends AppError {
    constructor(message = "Authentication required") {
        super(401, message, "UNAUTHORIZED");
        this.name = "UnauthorizedError";
    }
}

export class ForbiddenError extends AppError {
    constructor(message = "You do not have permission to perform this action") {
        super(403, message, "FORBIDDEN");
        this.name = "ForbiddenError";
    }
}
