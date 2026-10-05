import type { Request, RequestHandler } from "express";
import {
    collectDefaultMetrics,
    Counter,
    Histogram,
    Registry,
} from "@prometheus-io/client";

export const metricsRegistry = new Registry();

collectDefaultMetrics({
    register: metricsRegistry,
    prefix: "maintenance_api_",
});

const httpRequestsTotal = new Counter({
    name: "maintenance_api_http_requests_total",
    help: "Total number of completed HTTP requests.",
    labelNames: ["method", "route", "status_code"],
    registers: [metricsRegistry],
});

const httpRequestDurationSeconds = new Histogram({
    name: "maintenance_api_http_request_duration_seconds",
    help: "Duration of completed HTTP requests in seconds.",
    labelNames: ["method", "route"],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    registers: [metricsRegistry],
});

const httpErrorsTotal = new Counter({
    name: "maintenance_api_http_errors_total",
    help: "Total number of HTTP requests completed with 4xx or 5xx responses.",
    labelNames: ["method", "route", "status_code"],
    registers: [metricsRegistry],
});

const knownRouteTemplates = [
    "/api/auth/register",
    "/api/auth/login",
    "/api/auth/refresh",
    "/api/auth/logout",
    "/api/auth/me",
    "/api/health",
    "/api/health/live",
    "/api/health/ready",
    "/api/equipment",
    "/api/equipment/:id",
    "/api/equipment/:id/requests",
    "/api/equipment/:id/weather",
    "/api/requests",
    "/api/requests/:id",
    "/api/requests/:id/status",
    "/api/requests/:id/assignees",
    "/api/requests/:id/assignees/:userId",
    "/api/requests/:id/history",
    "/api/sites/:id/summary",
    "/api/reports/equipment-load",
];

function matchesRouteTemplate(path: string, template: string): boolean {
    const pathSegments = path.split("/");
    const templateSegments = template.split("/");
    return pathSegments.length === templateSegments.length
        && templateSegments.every((segment, index) =>
            segment.startsWith(":") || segment === pathSegments[index]
        );
}

function getRouteLabel(req: Request): string {
    const route = req.route?.path;
    if (typeof route === "string") return `${req.baseUrl}${route}`;
    return knownRouteTemplates.find((template) =>
        matchesRouteTemplate(req.path, template)
    ) ?? "__unmatched__";
}

export const httpMetrics: RequestHandler = (req, res, next) => {
    const start = process.hrtime.bigint();

    res.once("finish", () => {
        if (req.path === "/metrics") return;

        const route = getRouteLabel(req);
        const method = req.method;
        const statusCode = String(res.statusCode);
        const durationSeconds =
            Number(process.hrtime.bigint() - start) / 1_000_000_000;

        httpRequestsTotal.inc({ method, route, status_code: statusCode });
        httpRequestDurationSeconds.observe({ method, route }, durationSeconds);
        if (res.statusCode >= 400) {
            httpErrorsTotal.inc({ method, route, status_code: statusCode });
        }
    });

    next();
};
