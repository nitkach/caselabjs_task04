export const openApiDocument = {
    openapi: "3.0.3",
    info: {
        title: "CaseLab Maintenance API",
        version: "1.0.0",
        description: "API for equipment maintenance planning, requests, reports, and authentication.",
    },
    servers: [
        { url: "http://localhost:3000", description: "Local development" },
        { url: "http://<VM>", description: "Linux VM deployment" },
    ],
    components: {
        securitySchemes: {
            bearerAuth: {
                type: "http",
                scheme: "bearer",
                bearerFormat: "JWT",
                description: "Access token issued by /api/auth/login or /api/auth/refresh.",
            },
            cookieAuth: {
                type: "apiKey",
                in: "cookie",
                name: "refresh_token",
                description: "Refresh cookie used to renew access tokens.",
            },
        },
        schemas: {
            ErrorResponse: {
                type: "object",
                required: ["error"],
                properties: {
                    error: {
                        type: "object",
                        required: ["code", "message", "details", "requestId"],
                        properties: {
                            code: { type: "string" },
                            message: { type: "string" },
                            details: { type: "array", items: { type: "object" } },
                            requestId: { type: "string" },
                        },
                    },
                },
            },
            User: {
                type: "object",
                required: ["id", "email", "role"],
                properties: {
                    id: { type: "string", format: "uuid" },
                    email: { type: "string", format: "email" },
                    role: { type: "string", enum: ["viewer", "technician", "admin"] },
                    technicianId: { type: "string", nullable: true },
                },
            },
            AuthTokens: {
                type: "object",
                required: ["accessToken", "tokenType", "expiresIn", "user"],
                properties: {
                    accessToken: { type: "string" },
                    tokenType: { type: "string", enum: ["Bearer"] },
                    expiresIn: { type: "integer", example: 900 },
                    user: { $ref: "#/components/schemas/User" },
                },
            },
        },
    },
    paths: {
        "/api/auth/register": {
            post: {
                tags: ["Authentication"],
                summary: "Register a new viewer account",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["email", "password"],
                                properties: {
                                    email: { type: "string", format: "email" },
                                    password: {
                                        type: "string",
                                        minLength: 8,
                                        maxLength: 72,
                                        format: "password",
                                    },
                                },
                            },
                        },
                    },
                },
                responses: {
                    201: {
                        description: "User registered successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean", example: true },
                                        data: {
                                            type: "object",
                                            properties: {
                                                user: { $ref: "#/components/schemas/User" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    400: { $ref: "#/components/responses/ValidationError" },
                    409: { $ref: "#/components/responses/ConflictError" },
                },
            },
        },
        "/api/auth/login": {
            post: {
                tags: ["Authentication"],
                summary: "Log in and create a session",
                security: [],
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["email", "password"],
                                properties: {
                                    email: { type: "string", format: "email" },
                                    password: { type: "string", format: "password" },
                                },
                            },
                        },
                    },
                },
                responses: {
                    200: {
                        description: "Authenticated successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean", example: true },
                                        data: { $ref: "#/components/schemas/AuthTokens" },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: "#/components/responses/Unauthorized" },
                    429: { $ref: "#/components/responses/RateLimit" },
                },
            },
        },
        "/api/auth/refresh": {
            post: {
                tags: ["Authentication"],
                summary: "Refresh access token using the refresh cookie",
                security: [{ cookieAuth: [] }],
                responses: {
                    200: {
                        description: "Tokens rotated successfully",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean", example: true },
                                        data: { $ref: "#/components/schemas/AuthTokens" },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: "#/components/responses/Unauthorized" },
                },
            },
        },
        "/api/auth/logout": {
            post: {
                tags: ["Authentication"],
                summary: "Revoke the current refresh session",
                security: [{ cookieAuth: [] }],
                responses: {
                    204: { description: "Logged out" },
                    401: { $ref: "#/components/responses/Unauthorized" },
                },
            },
        },
        "/api/auth/me": {
            get: {
                tags: ["Authentication"],
                summary: "Get current user profile",
                security: [{ bearerAuth: [] }],
                responses: {
                    200: {
                        description: "Current authenticated user",
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        success: { type: "boolean", example: true },
                                        data: {
                                            type: "object",
                                            properties: {
                                                user: { $ref: "#/components/schemas/User" },
                                            },
                                        },
                                    },
                                },
                            },
                        },
                    },
                    401: { $ref: "#/components/responses/Unauthorized" },
                },
            },
        },
        "/api/health/live": {
            get: {
                tags: ["Health"],
                summary: "Process liveness check",
                responses: {
                    200: {
                        description: "Application is alive",
                        content: { "application/json": { schema: { type: "object", properties: { status: { type: "string", example: "ok" } } } } },
                    },
                },
            },
        },
        "/api/health/ready": {
            get: {
                tags: ["Health"],
                summary: "Readiness check including database connectivity",
                responses: {
                    200: { description: "Service is ready" },
                    503: { description: "Database or dependency is unavailable" },
                },
            },
        },
        "/metrics": {
            get: {
                tags: ["Monitoring"],
                summary: "Prometheus metrics endpoint",
                responses: {
                    200: { description: "Metrics in Prometheus format" },
                },
            },
        },
        "/api/equipment": {
            get: {
                tags: ["Equipment"],
                summary: "List equipment records",
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: "Equipment list" },
                    401: { $ref: "#/components/responses/Unauthorized" },
                },
            },
            post: {
                tags: ["Equipment"],
                summary: "Create equipment item",
                security: [{ bearerAuth: [] }],
                responses: {
                    201: { description: "Equipment created" },
                    403: { $ref: "#/components/responses/Forbidden" },
                },
            },
        },
        "/api/requests": {
            get: {
                tags: ["Requests"],
                summary: "List maintenance requests",
                security: [{ bearerAuth: [] }],
                responses: {
                    200: { description: "Requests list" },
                    401: { $ref: "#/components/responses/Unauthorized" },
                },
            },
            post: {
                tags: ["Requests"],
                summary: "Create maintenance request",
                security: [{ bearerAuth: [] }],
                responses: {
                    201: { description: "Request created" },
                    403: { $ref: "#/components/responses/Forbidden" },
                },
            },
        },
    },
    responses: {
        ValidationError: {
            description: "Validation error",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        ConflictError: {
            description: "Conflict",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        Unauthorized: {
            description: "Authentication required",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        Forbidden: {
            description: "Forbidden",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
        RateLimit: {
            description: "Too many requests",
            content: { "application/json": { schema: { $ref: "#/components/schemas/ErrorResponse" } } },
        },
    },
} as const;
