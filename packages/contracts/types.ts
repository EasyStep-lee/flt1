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
    "/v1/company/suppliers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List supplier onboarding records for company supplier ops */
        get: operations["companySupplierOnboarding.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/suppliers/{supplierId}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request correction or approve a pending supplier */
        post: operations["companySupplierOnboarding.review"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/public/merchant-profile": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the fixed customer-facing merchant identity */
        get: operations["publicMerchant.getProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get the supplier profile bound to the fixed functional session */
        get: operations["supplierOnboarding.getOwnProfile"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Correct the authenticated supplier onboarding draft */
        patch: operations["supplierOnboarding.patchOwnProfile"];
        trace?: never;
    };
    "/v1/supplier/me/submit-review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit or resubmit the authenticated supplier for review */
        post: operations["supplierOnboarding.submitOwnProfile"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/suppliers/registrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create an editable supplier onboarding draft */
        post: operations["supplierRegistration.create"];
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
            code: "ACCESS_DENIED" | "AUTHENTICATION_REQUIRED" | "INTERNAL_ERROR" | "REQUEST_INVALID" | "RESOURCE_NOT_FOUND" | "SERVICE_UNAVAILABLE" | "PAYEE_FORBIDDEN" | "SELLER_IDENTITY_FORBIDDEN" | "SINGLE_MERCHANT_VIOLATION" | "APPROVAL_VERSION_CONFLICT" | "DATA_SCOPE_FORBIDDEN" | "FIELD_FORBIDDEN" | "SECOND_VERIFICATION_REQUIRED" | "STATE_TRANSITION_INVALID" | "SUPPLIER_DUPLICATE" | "SUPPLIER_SCOPE_FORBIDDEN" | "VALIDATION_FAILED" | "VERSION_CONFLICT";
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
        ApprovalTaskResponseDto: {
            /** @enum {string} */
            approvalType: "SUPPLIER_ONBOARDING";
            /** @enum {string} */
            assignedAccountTypeCode: "COMPANY_SUPPLIER_OPS";
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            objectId: string;
            /** @enum {string} */
            objectType: "SUPPLIER";
            reviewOpinion?: string;
            /** @enum {string} */
            status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";
            version: number;
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
        PublicMerchantProfileQuery: {
            /**
             * @example ALL
             * @enum {string}
             */
            context?: "ALL" | "PAYMENT" | "REFUND" | "SALE";
        };
        PublicMerchantProfileResponse: {
            /** @example 江苏福礼团供应链科技有限公司 */
            legalName: string;
            /** @example 福礼社 */
            platformName: string;
            subjects: components["schemas"]["PublicMerchantSubjectsDto"];
        };
        PublicMerchantSubjectsDto: {
            /** @example 江苏福礼团供应链科技有限公司 */
            paymentPayee: string;
            /** @example 江苏福礼团供应链科技有限公司 */
            refundOperator: string;
            /** @example 江苏福礼团供应链科技有限公司 */
            seller: string;
        };
        SubmitReviewRequestDto: {
            /** Format: uuid */
            requestId: string;
            version: number;
        };
        SupplierPageResponseDto: {
            items: components["schemas"]["SupplierResponseDto"][];
            page: number;
            pageSize: number;
            total: number;
        };
        SupplierProfilePatchRequestDto: {
            pickupAddress?: string | null;
            pickupLat?: number | null;
            pickupLng?: number | null;
            qualificationSnapshot?: components["schemas"]["SupplierQualificationSnapshotDto"];
            /** @description Reserved for a separately verified high-risk workflow */
            settlementAccountChangeRequest?: Record<string, never>;
            version: number;
        };
        SupplierProfileResponseDto: {
            /** @example 9132**********2D3X */
            creditCodeMasked: string;
            /** Format: uuid */
            id: string;
            legalName: string;
            pickupAddress: string | null;
            pickupLat: number | null;
            pickupLng: number | null;
            qualificationSummary: components["schemas"]["SupplierQualificationSummaryDto"];
            settlementAccountMasked: string | null;
            /** @enum {string} */
            status: "DRAFT" | "PENDING_REVIEW" | "CORRECTION_REQUIRED" | "ACTIVE" | "SUSPENDED" | "EXITING" | "EXITED";
            version: number;
        };
        SupplierQualificationSnapshotDto: {
            files: string[];
            /**
             * @example 1.0
             * @enum {string}
             */
            schemaVersion: "1.0";
        };
        SupplierQualificationSummaryDto: {
            complete: boolean;
            fileCount: number;
        };
        SupplierQueryDto: {
            keyword?: string;
            /** @default 1 */
            page: number;
            /** @default 20 */
            pageSize: number;
            /** @enum {string} */
            status?: "DRAFT" | "PENDING_REVIEW" | "CORRECTION_REQUIRED" | "ACTIVE" | "SUSPENDED" | "EXITING" | "EXITED";
        };
        SupplierRegistrationRequestDto: {
            /** @example supplier-agreement-v1.1 */
            agreementVersion: string;
            /** @example 张经理 */
            contactName: string;
            /** @example 91320100MA1ABC2D3X */
            creditCode: string;
            /** @example supplier@example.test */
            email?: string;
            /** @example 南京示例供应链有限公司 */
            legalName: string;
            /** @example 13800138000 */
            mobile: string;
            /** @example 南京市建邺区江东中路 100 号 */
            pickupAddress: string | null;
            /** @example 32.0415447 */
            pickupLat: number | null;
            /** @example 118.7699941 */
            pickupLng: number | null;
            /**
             * @example [
             *       "object://supplier-qualification/business-license-001"
             *     ]
             */
            qualificationFiles: string[];
            /** @example 123456 */
            verificationCode: string;
        };
        SupplierRegistrationResponseDto: {
            /** @enum {string} */
            nextAction: "COMPLETE_PROFILE" | "CORRECT_AND_RESUBMIT" | "LOGIN_AFTER_ACTIVATION" | "REVIEW_IN_PROGRESS";
            /** Format: uuid */
            registrationId: string;
            /** @enum {string} */
            status: "DRAFT" | "PENDING_REVIEW" | "CORRECTION_REQUIRED" | "ACTIVE" | "SUSPENDED" | "EXITING" | "EXITED";
            /** Format: date-time */
            submittedAt?: string;
        };
        SupplierResponseDto: {
            /** @example 9132**********2D3X */
            creditCodeMasked: string;
            /** Format: uuid */
            id: string;
            legalName: string;
            qualificationSummary: components["schemas"]["SupplierQualificationSummaryDto"];
            /** @enum {string} */
            status: "DRAFT" | "PENDING_REVIEW" | "CORRECTION_REQUIRED" | "ACTIVE" | "SUSPENDED" | "EXITING" | "EXITED";
            version: number;
        };
        SupplierReviewRequestDto: {
            /** @enum {string} */
            decision: "REQUEST_CORRECTION" | "APPROVE";
            opinion: string;
            secondVerificationCode?: string;
            version: number;
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
    "companySupplierOnboarding.list": {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                keyword?: string;
                status?: "DRAFT" | "PENDING_REVIEW" | "CORRECTION_REQUIRED" | "ACTIVE" | "SUSPENDED" | "EXITING" | "EXITED";
            };
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
                    "application/json": components["schemas"]["SupplierPageResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
        };
    };
    "companySupplierOnboarding.review": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                supplierId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupplierReviewRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierResponseDto"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
        };
    };
    "publicMerchant.getProfile": {
        parameters: {
            query?: {
                context?: "ALL" | "PAYMENT" | "REFUND" | "SALE";
            };
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
                    "application/json": components["schemas"]["PublicMerchantProfileResponse"];
                };
            };
            400: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
        };
    };
    "supplierOnboarding.getOwnProfile": {
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
                    "application/json": components["schemas"]["SupplierProfileResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
        };
    };
    "supplierOnboarding.patchOwnProfile": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupplierProfilePatchRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierProfileResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
        };
    };
    "supplierOnboarding.submitOwnProfile": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitReviewRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApprovalTaskResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
        };
    };
    "supplierRegistration.create": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupplierRegistrationRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierRegistrationResponseDto"];
                };
            };
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            503: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
        };
    };
}
