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
    "/v1/audit/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List immutable audit events */
        get: operations["auditEvents.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company-auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 公司后台独立登录并解析职能账号 */
        post: operations["companyauth.login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company-auth/workspace/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取当前固定公司职能工作区白名单 */
        get: operations["companyauth.currentWorkspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company-auth/workspace/page": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取当前公司职能页面的隔离模块目录 */
        get: operations["companyauth.workspacePage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company-auth/workspaces/{accountId}/select": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 选择一个公司职能账号并签发单工作区会话 */
        post: operations["companyauth.selectWorkspace"];
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
    "/v1/{ownerType}/functional-accounts": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List functional accounts in the authenticated owner scope */
        get: operations["functionalAccounts.list"];
        put?: never;
        /** Invite a supplier functional account after second verification */
        post: operations["functionalAccounts.create"];
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
            code: "ACCESS_DENIED" | "AUTHENTICATION_REQUIRED" | "INTERNAL_ERROR" | "REQUEST_INVALID" | "RESOURCE_NOT_FOUND" | "SERVICE_UNAVAILABLE" | "PAYEE_FORBIDDEN" | "SELLER_IDENTITY_FORBIDDEN" | "SINGLE_MERCHANT_VIOLATION" | "ACTOR_SPOOFED" | "ACCOUNT_TYPE_INVALID" | "APPROVAL_VERSION_CONFLICT" | "DATA_SCOPE_FORBIDDEN" | "FIELD_FORBIDDEN" | "IDEMPOTENCY_CONFLICT" | "SECOND_VERIFICATION_REQUIRED" | "STATE_TRANSITION_INVALID" | "SUPPLIER_DUPLICATE" | "SUPPLIER_SCOPE_FORBIDDEN" | "VALIDATION_FAILED" | "VERSION_CONFLICT" | "WORKSPACE_FORBIDDEN" | "ACCOUNT_SUSPENDED" | "AUTH_INVALID" | "AUTH_SESSION_REVOKED" | "RATE_LIMITED" | "WORKSPACE_MENU_VIOLATION" | "WORKSPACE_MODULE_NOT_FOUND" | "WORKSPACE_SELECTION_REQUIRED" | "WORKSPACE_SESSION_CONFLICT" | "AUDIT_IMMUTABLE" | "AUDIT_REQUIRED" | "EXPORT_APPROVAL_REQUIRED" | "REQUEST_ID_REQUIRED";
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
        AuditEventPageResponseDto: {
            items: components["schemas"]["AuditEventResponseDto"][];
            page: number;
            pageSize: number;
            total: number;
        };
        AuditEventResponseDto: {
            action: string;
            /** Format: uuid */
            actorId: string;
            /** @enum {string} */
            actorType: "COMPANY_USER" | "SUPPLIER_USER" | "SYSTEM";
            afterSnapshot: Record<string, never>;
            beforeSnapshot: Record<string, never>;
            /** Format: uuid */
            id: string;
            objectId: string;
            objectType: string;
            /** Format: date-time */
            occurredAt: string;
            /** Format: uuid */
            requestId: string;
        };
        AuditQueryDto: {
            action?: string;
            objectId?: string;
            objectType?: string;
            /** @default 1 */
            page: number;
            /** @default 20 */
            pageSize: number;
        };
        CompanyLoginRequestDto: {
            /** @example 13800138000 */
            loginAccount: string;
            password: string;
            /** Format: uuid */
            requestId: string;
            verificationCode?: string;
        };
        CompanyWorkspaceMenuItemDto: {
            /** @enum {string} */
            key: "workspace";
            label: string;
            route: string;
        };
        CompanyWorkspaceModuleDetailDto: {
            /** @enum {string} */
            availability: "AVAILABLE" | "DEFERRED";
            dataBoundary: string;
            /** @enum {string} */
            deliveryStage: "M1" | "M2" | "M3" | "M4" | "M5";
            description: string;
            label: string;
            moduleKey: string;
            sections: string[];
            timeline: components["schemas"]["CompanyWorkspaceModuleTimelineEventDto"][];
        };
        CompanyWorkspaceModuleItemDto: {
            /** @enum {string} */
            availability: "AVAILABLE" | "DEFERRED";
            dataBoundary: string;
            /** @enum {string} */
            deliveryStage: "M1" | "M2" | "M3" | "M4" | "M5";
            description: string;
            label: string;
            moduleKey: string;
        };
        CompanyWorkspaceModuleTimelineEventDto: {
            code: string;
            label: string;
            /** @enum {string} */
            stage: "M1" | "M2" | "M3" | "M4" | "M5";
            /** @enum {string} */
            status: "DONE" | "DEFERRED";
        };
        CompanyWorkspacePageFiltersDto: {
            /** @enum {string} */
            availability: "ALL" | "AVAILABLE" | "DEFERRED";
            keyword: string;
        };
        CompanyWorkspacePageResponseDto: {
            /** @enum {string} */
            accountTypeCode: "COMPANY_SUPER_ADMIN" | "COMPANY_SUPPLIER_OPS" | "COMPANY_PRODUCT_OPS" | "COMPANY_PRICE_REVIEW" | "COMPANY_ORDER_SERVICE" | "COMPANY_WELFARE_CARD" | "COMPANY_FINANCE" | "COMPANY_LOGISTICS" | "COMPANY_CONTENT" | "COMPANY_AUDIT";
            accountTypeName: string;
            filters: components["schemas"]["CompanyWorkspacePageFiltersDto"];
            items: components["schemas"]["CompanyWorkspaceModuleItemDto"][];
            /** @enum {string} */
            pageId: "PAGE-003" | "PAGE-004" | "PAGE-005" | "PAGE-006" | "PAGE-007" | "PAGE-008" | "PAGE-009" | "PAGE-010" | "PAGE-011" | "PAGE-012";
            selectedModule: components["schemas"]["CompanyWorkspaceModuleDetailDto"] | null;
            summary: components["schemas"]["CompanyWorkspacePageSummaryDto"];
            workspaceRoute: string;
        };
        CompanyWorkspacePageSummaryDto: {
            availableTotal: number;
            catalogTotal: number;
            deferredTotal: number;
            filteredTotal: number;
        };
        CompanyWorkspaceResponseDto: {
            /** @enum {string} */
            accountTypeCode: "COMPANY_SUPER_ADMIN" | "COMPANY_SUPPLIER_OPS" | "COMPANY_PRODUCT_OPS" | "COMPANY_PRICE_REVIEW" | "COMPANY_ORDER_SERVICE" | "COMPANY_WELFARE_CARD" | "COMPANY_FINANCE" | "COMPANY_LOGISTICS" | "COMPANY_CONTENT" | "COMPANY_AUDIT";
            accountTypeName: string;
            menuItems: components["schemas"]["CompanyWorkspaceMenuItemDto"][];
            /** @enum {string} */
            pageId: "PAGE-003" | "PAGE-004" | "PAGE-005" | "PAGE-006" | "PAGE-007" | "PAGE-008" | "PAGE-009" | "PAGE-010" | "PAGE-011" | "PAGE-012";
            workspaceRoute: string;
        };
        CreateFunctionalAccountRequestDto: {
            /** @enum {string} */
            accountTypeCode: "SUPPLIER_ACCOUNT_ADMIN" | "SUPPLIER_PRODUCT" | "SUPPLIER_PRICING" | "SUPPLIER_INVENTORY" | "SUPPLIER_FULFILLMENT" | "SUPPLIER_AFTERSALES" | "SUPPLIER_FINANCE" | "SUPPLIER_AUDIT" | "COMPANY_SUPER_ADMIN" | "COMPANY_SUPPLIER_OPS" | "COMPANY_PRODUCT_OPS" | "COMPANY_PRICE_REVIEW" | "COMPANY_ORDER_SERVICE" | "COMPANY_WELFARE_CARD" | "COMPANY_FINANCE" | "COMPANY_LOGISTICS" | "COMPANY_CONTENT" | "COMPANY_AUDIT";
            /** Format: date-time */
            expiresAt?: string;
            inviteeEmail?: string;
            /** @example 13900139000 */
            inviteeMobile: string;
            inviteeName: string;
            secondVerificationCode?: string;
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
        FunctionalAccountPageResponseDto: {
            items: components["schemas"]["FunctionalAccountResponseDto"][];
            page: number;
            pageSize: number;
            total: number;
        };
        FunctionalAccountQueryDto: {
            /** @enum {string} */
            accountTypeCode?: "SUPPLIER_ACCOUNT_ADMIN" | "SUPPLIER_PRODUCT" | "SUPPLIER_PRICING" | "SUPPLIER_INVENTORY" | "SUPPLIER_FULFILLMENT" | "SUPPLIER_AFTERSALES" | "SUPPLIER_FINANCE" | "SUPPLIER_AUDIT" | "COMPANY_SUPER_ADMIN" | "COMPANY_SUPPLIER_OPS" | "COMPANY_PRODUCT_OPS" | "COMPANY_PRICE_REVIEW" | "COMPANY_ORDER_SERVICE" | "COMPANY_WELFARE_CARD" | "COMPANY_FINANCE" | "COMPANY_LOGISTICS" | "COMPANY_CONTENT" | "COMPANY_AUDIT";
            keyword?: string;
            /** @default 1 */
            page: number;
            /** @default 20 */
            pageSize: number;
            /** @enum {string} */
            status?: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "REVOKED";
        };
        FunctionalAccountResponseDto: {
            /** @enum {string} */
            accountTypeCode: "SUPPLIER_ACCOUNT_ADMIN" | "SUPPLIER_PRODUCT" | "SUPPLIER_PRICING" | "SUPPLIER_INVENTORY" | "SUPPLIER_FULFILLMENT" | "SUPPLIER_AFTERSALES" | "SUPPLIER_FINANCE" | "SUPPLIER_AUDIT" | "COMPANY_SUPER_ADMIN" | "COMPANY_SUPPLIER_OPS" | "COMPANY_PRODUCT_OPS" | "COMPANY_PRICE_REVIEW" | "COMPANY_ORDER_SERVICE" | "COMPANY_WELFARE_CARD" | "COMPANY_FINANCE" | "COMPANY_LOGISTICS" | "COMPANY_CONTENT" | "COMPANY_AUDIT";
            accountTypeName: string;
            displayName: string;
            /** Format: date-time */
            expiresAt?: string;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            lastLoginAt?: string;
            /** @enum {string} */
            status: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "REVOKED";
            workspaceRoute: string;
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
        SelectWorkspaceRequestDto: {
            secondVerificationCode?: string;
            selectionNonce: string;
        };
        SessionResponseDto: {
            accountTypeCode: string;
            /** Format: uuid */
            companyId: string;
            /** Format: date-time */
            expiresAt: string;
            /** Format: uuid */
            functionalAccountId: string;
            /** @enum {string} */
            ownerType: "COMPANY";
            workspaceRoute: string;
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
        WorkspaceChoiceDto: {
            /** Format: uuid */
            accountId: string;
            accountTypeCode: string;
            accountTypeName: string;
            /** Format: date-time */
            lastUsedAt?: string | null;
            ownerDisplayName: string;
            /** @enum {string} */
            ownerType: "COMPANY";
            /** @enum {string} */
            status: "ACTIVE" | "PENDING_ACTIVATION" | "REVOKED" | "SUSPENDED";
            workspaceRoute: string;
        };
        WorkspaceChoiceResponseDto: {
            accounts: components["schemas"]["WorkspaceChoiceDto"][];
            selectionNonce: string;
            selectionRequired: boolean;
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
    "auditEvents.list": {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                objectId?: string;
                objectType?: string;
                action?: string;
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
                    "application/json": components["schemas"]["AuditEventPageResponseDto"];
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
    "companyauth.login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CompanyLoginRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WorkspaceChoiceResponseDto"];
                };
            };
        };
    };
    "companyauth.currentWorkspace": {
        parameters: {
            query: {
                route: string;
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
                    "application/json": components["schemas"]["CompanyWorkspaceResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    "companyauth.workspacePage": {
        parameters: {
            query: {
                moduleKey?: string;
                availability?: "ALL" | "AVAILABLE" | "DEFERRED";
                keyword?: string;
                route: string;
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
                    "application/json": components["schemas"]["CompanyWorkspacePageResponseDto"];
                };
            };
            401: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
            422: {
                headers: {
                    [name: string]: unknown;
                };
                content?: never;
            };
        };
    };
    "companyauth.selectWorkspace": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                accountId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SelectWorkspaceRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SessionResponseDto"];
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
            404: {
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
            428: {
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
            404: {
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
            428: {
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
            403: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            404: {
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
    "functionalAccounts.list": {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
                keyword?: string;
                status?: "PENDING_ACTIVATION" | "ACTIVE" | "SUSPENDED" | "REVOKED";
                accountTypeCode?: "SUPPLIER_ACCOUNT_ADMIN" | "SUPPLIER_PRODUCT" | "SUPPLIER_PRICING" | "SUPPLIER_INVENTORY" | "SUPPLIER_FULFILLMENT" | "SUPPLIER_AFTERSALES" | "SUPPLIER_FINANCE" | "SUPPLIER_AUDIT";
            };
            header?: never;
            path: {
                ownerType: "supplier" | "company";
            };
            cookie?: never;
        };
        requestBody?: never;
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FunctionalAccountPageResponseDto"];
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
    "functionalAccounts.create": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                ownerType: "supplier" | "company";
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateFunctionalAccountRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["FunctionalAccountResponseDto"];
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
            428: {
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
