import { jest } from "@jest/globals";

process.env.NODE_ENV = "test";
process.env.PORT = "4100";
process.env.PGHOST = "localhost";
process.env.PGPORT = "5432";
process.env.PGDATABASE = "appdb";
process.env.PGUSER = "app";
process.env.PGPASSWORD = "very-strong-password";
process.env.ACCESS_TOKEN_SECRET = "test-access-token-secret-at-least-32-chars";
process.env.AUTH_COOKIE_SECURE = "false";
process.env.AUTH_COOKIE_SAME_SITE = "lax";

const mockAuthService = {
    register: jest.fn(async (payload: { email: string; password: string }) => ({
        id: "user-1",
        email: payload.email,
        role: "viewer",
        technicianId: null,
    })),
    login: jest.fn(async (payload: { email: string; password: string }) => ({
        accessToken: "access-token",
        refreshToken: "refresh-token",
        user: {
            id: "user-1",
            email: payload.email,
            role: "viewer",
            technicianId: null,
        },
    })),
    refresh: jest.fn(async () => ({
        accessToken: "refreshed-access-token",
        refreshToken: "refreshed-refresh-token",
        user: {
            id: "user-1",
            email: "viewer@example.com",
            role: "viewer",
            technicianId: null,
        },
    })),
    logout: jest.fn(async () => undefined),
    getUser: jest.fn(async () => ({
        id: "user-1",
        email: "viewer@example.com",
        role: "viewer",
        technicianId: null,
    })),
    verifyAccessToken: jest.fn(async (token) => {
        if (token === "valid-token") {
            return {
                id: "user-1",
                email: "viewer@example.com",
                role: "viewer",
                technicianId: null,
            };
        }
        throw new Error("Invalid access token");
    }),
    bootstrapAccounts: jest.fn(async () => undefined),
};

jest.unstable_mockModule("../services/auth.service.js", () => ({
    authService: mockAuthService,
}));

jest.unstable_mockModule("../config/database.js", () => ({
    sequelize: {
        authenticate: jest.fn(async () => true),
        close: jest.fn(async () => undefined),
    },
    waitForDatabase: jest.fn(async () => undefined),
}));

const request = (await import("supertest")).default;
const { app } = await import("../app.js");

describe("CaseLab API auth flows", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("registers a new viewer account", async () => {
        const response = await request(app)
            .post("/api/auth/register")
            .send({
                email: "viewer@example.com",
                password: "Password123",
            });

        expect(response.status).toBe(201);
        expect(response.body.success).toBe(true);
        expect(response.body.data.user.email).toBe("viewer@example.com");
        expect(response.body.data.user.role).toBe("viewer");
        expect(mockAuthService.register).toHaveBeenCalledWith({
            email: "viewer@example.com",
            password: "Password123",
        });
    });

    it("logs in and sets a refresh cookie", async () => {
        const response = await request(app)
            .post("/api/auth/login")
            .send({
                email: "viewer@example.com",
                password: "Password123",
            });

        expect(response.status).toBe(200);
        expect(response.body.data.accessToken).toBe("access-token");
        expect(response.headers["set-cookie"]).toEqual(
            expect.arrayContaining([expect.stringContaining("refresh_token=")]),
        );
        expect(mockAuthService.login).toHaveBeenCalledWith({
            email: "viewer@example.com",
            password: "Password123",
        });
    });

    it("requires authentication for the current-user endpoint", async () => {
        const response = await request(app).get("/api/auth/me");

        expect(response.status).toBe(401);
        expect(response.body.error.code).toBe("UNAUTHORIZED");
    });

    it("returns a valid Swagger UI page and OpenAPI document", async () => {
        const docsResponse = await request(app).get("/api/docs/");
        expect(docsResponse.status).toBe(200);
        expect(docsResponse.headers["content-type"]).toContain("text/html");

        const specResponse = await request(app).get("/api/openapi.json");
        expect(specResponse.status).toBe(200);
        expect(specResponse.body.openapi).toBe("3.0.3");
        expect(specResponse.body.info.title).toBe("CaseLab Maintenance API");
    });

    it("refreshes a token when a valid refresh cookie is present", async () => {
        const response = await request(app)
            .post("/api/auth/refresh")
            .set("Cookie", ["refresh_token=refresh-token"]);

        expect(response.status).toBe(200);
        expect(response.body.data.accessToken).toBe("refreshed-access-token");
        expect(mockAuthService.refresh).toHaveBeenCalledWith("refresh-token");
    });
});
