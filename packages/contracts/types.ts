export interface paths {
    "/health/live": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liveness probe */
        get: operations["health.getLiveness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/health/ready": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Readiness probe */
        get: operations["health.getReadiness"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ApiErrorResponseDto: {
            /**
             * @example RESOURCE_NOT_FOUND
             * @enum {string}
             */
            code: "ACCESS_DENIED" | "AUTHENTICATION_REQUIRED" | "INTERNAL_ERROR" | "REQUEST_INVALID" | "RESOURCE_NOT_FOUND" | "SERVICE_UNAVAILABLE";
            /** @example Resource was not found */
            message: string;
            /** @example /missing */
            path: string;
            /** @example contract-request-0001 */
            requestId: string;
            /** @example 404 */
            statusCode: number;
            /**
             * Format: date-time
             * @example 2026-08-02T00:00:00.000Z
             */
            timestamp: string;
        };
        FoundationDependencyCheckDto: {
            /** @example OK */
            code: string;
            /** @example 1 */
            latencyMs: number;
            /**
             * @example UP
             * @enum {string}
             */
            status: "UP" | "DOWN";
        };
        HealthLivenessDto: {
            /**
             * @example fulishe-api
             * @enum {string}
             */
            service: "fulishe-api";
            /**
             * @example UP
             * @enum {string}
             */
            status: "UP";
        };
        HealthReadinessChecksDto: {
            database?: components["schemas"]["FoundationDependencyCheckDto"];
            queue?: components["schemas"]["FoundationDependencyCheckDto"];
            redis?: components["schemas"]["FoundationDependencyCheckDto"];
        };
        HealthReadinessDto: {
            /**
             * Format: date-time
             * @example 2026-08-02T00:00:00.000Z
             */
            checkedAt: string;
            checks: components["schemas"]["HealthReadinessChecksDto"];
            /**
             * @example fulishe-api
             * @enum {string}
             */
            service: "fulishe-api";
            /**
             * @example UP
             * @enum {string}
             */
            status: "UP" | "DOWN";
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export interface operations {
    "health.getLiveness": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthLivenessDto"];
                };
            };
        };
    };
    "health.getReadiness": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthReadinessDto"];
                };
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["HealthReadinessDto"];
                };
            };
        };
    };
}
