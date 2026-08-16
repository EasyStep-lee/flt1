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
    "/v1/aftersales/{afterSaleId}/refund": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Initiate an approved refund using immutable original payment allocations */
        post: operations["refunds.createOriginalStructureRefund"];
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
    "/v1/audit/sensitive-export-approvals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List server-scoped sensitive approval tasks */
        get: operations["sensitiveApproval.list"];
        put?: never;
        /** Request an approved audit export operation */
        post: operations["sensitiveApproval.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/audit/sensitive-export-approvals/{taskId}/claim": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Claim as an independent company auditor */
        post: operations["sensitiveApproval.claim"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/audit/sensitive-export-approvals/{taskId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve or reject after second verification */
        post: operations["sensitiveApproval.decide"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/catalog/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List guest-safe retail products from the unified company shelf */
        get: operations["catalog.listProducts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/catalog/products/{productId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get a sellable template-driven product detail from the unified company shelf */
        get: operations["catalog.getProductDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/catalog/suppliers/{supplierId}/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List same-source products from the unified company shelf */
        get: operations["catalog.listSupplierProducts"];
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
    "/v1/company/categories": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the role-scoped category tree */
        get: operations["companyCategories.list"];
        put?: never;
        /** Create a category under the fixed company session */
        post: operations["companyCategories.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/categories/{categoryId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Delete only an unreferenced leaf category */
        delete: operations["companyCategories.delete"];
        options?: never;
        head?: never;
        /** Move, sort, rename or enable/disable a category */
        patch: operations["companyCategories.patch"];
        trace?: never;
    };
    "/v1/company/categories/{categoryId}/template-versions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List immutable template versions for one company leaf category */
        get: operations["companyCategoryTemplates.list"];
        put?: never;
        /** Create the next category template draft version */
        post: operations["companyCategoryTemplates.createDraft"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/category-template-versions/{templateId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Edit only a category template draft with optimistic locking */
        patch: operations["companyCategoryTemplates.patchDraft"];
        trace?: never;
    };
    "/v1/company/category-template-versions/{templateId}/publish": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Publish a draft and atomically retire the prior active version */
        post: operations["companyCategoryTemplates.publish"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/enterprise-orders/{orderId}/remittance-review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Review enterprise remittance in the company finance workspace */
        post: operations["enterpriseRemittance.reviewProof"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/enterprise-registrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List enterprise certifications for the fixed company reviewer workspace */
        get: operations["companyEnterpriseRegistration.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/enterprise-registrations/{enterpriseId}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Request correction, approve, or reject an enterprise certification */
        post: operations["companyEnterpriseRegistration.review"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/enterprise-registrations/{enterpriseId}/suspend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Suspend an active enterprise without rewriting certification history */
        post: operations["companyEnterpriseRegistration.suspend"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/price-reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List initial prices for the price-review role */
        get: operations["companyInitialPriceReviews.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/price-reviews/supply-price-changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List supply price changes for the independent price-review role */
        get: operations["companySupplyPriceReviews.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/price-reviews/supply-price-changes/{taskId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve or reject a post-listing supply price change */
        post: operations["companySupplyPriceReviews.decide"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/price-reviews/supply-price-changes/{taskId}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the append-only decision and effect history for one company-scoped review */
        get: operations["companySupplyPriceReviews.history"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/price-reviews/{taskId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve or reject the frozen initial three-price snapshot */
        post: operations["companyInitialPriceReviews.decide"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/product-material-reviews": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List material reviews for product operations */
        get: operations["companyProductMaterialReviews.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/product-material-reviews/{taskId}/decision": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Approve or reject material without price visibility */
        post: operations["companyProductMaterialReviews.decide"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/regulated-category-controls": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List company-scoped high-risk controls */
        get: operations["regulatedCategoryControls.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/regulated-category-controls/{categoryId}/disable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Disable a high-risk category after second verification */
        post: operations["regulatedCategoryControls.disable"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/regulated-category-controls/{categoryId}/enable": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Enable a high-risk category after second verification */
        post: operations["regulatedCategoryControls.enable"];
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
    "/v1/company/welfare-card/programs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List company-owned welfare-card programs and draft batches */
        get: operations["companyWelfareCard.listPrograms"];
        put?: never;
        /** Create one DRAFT company welfare-card program */
        post: operations["companyWelfareCard.createProgram"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/company/welfare-card/programs/{programId}/batches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create one amount-conserving DRAFT welfare-card batch */
        post: operations["companyWelfareCard.createBatch"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/consumer/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create one company consumer order across suppliers */
        post: operations["orders.createConsumerOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/enterprise/catalog/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List enterprise-enabled Product and SKU resources from the unified company shelf */
        get: operations["enterpriseCatalog.listProducts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/enterprise/catalog/products/{productId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Get an enterprise-only product detail with the procurement selling price */
        get: operations["enterpriseCatalog.getProductDetail"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/enterprise/orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create one company enterprise order across suppliers */
        post: operations["orders.createEnterpriseOrder"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/enterprise/orders/{orderId}/remittance-proof": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit company bank-remittance proof for an enterprise order */
        post: operations["enterpriseRemittance.submitProof"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/enterprise/registrations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create an enterprise certification draft after mobile verification */
        post: operations["enterpriseRegistration.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/enterprise/registrations/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Read the enterprise certification bound to a registration credential */
        get: operations["enterpriseRegistration.getOwn"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Save enterprise certification draft or correction fields */
        patch: operations["enterpriseRegistration.patchOwn"];
        trace?: never;
    };
    "/v1/enterprise/registrations/me/submit-review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit or resubmit an enterprise certification for company review */
        post: operations["enterpriseRegistration.submitOwn"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/orders/{orderId}/wechat-prepay": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create or replay a WeChat prepay for an owned order */
        post: operations["payments.createWechatPrepay"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/payment-notifications/wechat": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Verify and idempotently process a WeChat Pay notification */
        post: operations["payments.confirmWechatNotification"];
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
    "/v1/supplier-auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 供应商独立登录并解析本方职能账号 */
        post: operations["supplierauth.login"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier-auth/workspace/current": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取当前固定供应商职能工作区白名单 */
        get: operations["supplierauth.currentWorkspace"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier-auth/workspace/page": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** 读取当前供应商职能页面的隔离模块目录 */
        get: operations["supplierauth.workspacePage"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier-auth/workspaces/{accountId}/select": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** 选择一个供应商职能账号并签发单工作区会话 */
        post: operations["supplierauth.selectWorkspace"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/fulfillment-sub-orders": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List active fulfillment suborders in the current supplier scope */
        get: operations["supplierFulfillment.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/fulfillment-sub-orders/{subOrderId}/nodes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Append one idempotent supplier preparation node */
        post: operations["supplierFulfillment.appendNode"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/inventory": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List the current supplier shared SKU inventory balances */
        get: operations["supplierInventory.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/inventory/{skuId}/adjustments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Append one idempotent inventory adjustment */
        post: operations["supplierInventory.adjust"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/inventory/{skuId}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List append-only inventory history in the current supplier scope */
        get: operations["supplierInventory.history"];
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
    "/v1/supplier/pricing/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List current-supplier products and initial pricing review state */
        get: operations["supplierPricing.listInitialPricingProducts"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/pricing/products/{supplierProductId}/initial-prices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Freeze and submit current-supplier initial three-price values */
        put: operations["supplierPricing.submitInitialPrices"];
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/pricing/skus": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List own listed SKU prices and versions */
        get: operations["supplierListedPricing.list"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/pricing/skus/{skuId}/sale-prices": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Version retail and enterprise sale prices without creating an approval task */
        patch: operations["supplierListedPricing.patchSalePrices"];
        trace?: never;
    };
    "/v1/supplier/pricing/skus/{skuId}/supply-price-change": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit a reviewed supply price change while the old price remains effective */
        post: operations["supplierListedPricing.submitSupplyPriceChange"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/pricing/supply-price-changes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List current-supplier supply price applications and review outcomes */
        get: operations["supplierListedPricing.listSupplyPriceChanges"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/products": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Create a supplier product draft */
        post: operations["supplierProducts.create"];
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/products/{supplierProductId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Patch an owned supplier product draft */
        patch: operations["supplierProducts.patch"];
        trace?: never;
    };
    "/v1/supplier/products/{supplierProductId}/channel-visibility": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Change ACTIVE product channel visibility without duplicating Product/Sku resources */
        patch: operations["supplierProducts.changeChannelVisibility"];
        trace?: never;
    };
    "/v1/supplier/products/{supplierProductId}/channel-visibility-history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** List immutable channel visibility history for an owned supplier product */
        get: operations["supplierProducts.listChannelVisibilityHistory"];
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/v1/supplier/products/{supplierProductId}/submit-material": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Submit product material for company review */
        post: operations["supplierProducts.submitMaterial"];
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
            code: "ACCESS_DENIED" | "AUTHENTICATION_REQUIRED" | "INTERNAL_ERROR" | "REQUEST_INVALID" | "RESOURCE_NOT_FOUND" | "SERVICE_UNAVAILABLE" | "FORBIDDEN_CAPABILITY" | "PAYEE_FORBIDDEN" | "SELLER_IDENTITY_FORBIDDEN" | "SINGLE_MERCHANT_VIOLATION" | "ACTOR_SPOOFED" | "ACCOUNT_TYPE_INVALID" | "APPROVAL_VERSION_CONFLICT" | "DATA_SCOPE_FORBIDDEN" | "FIELD_FORBIDDEN" | "IDEMPOTENCY_CONFLICT" | "SECOND_VERIFICATION_REQUIRED" | "STATE_TRANSITION_INVALID" | "SUPPLIER_DUPLICATE" | "SUPPLIER_SCOPE_FORBIDDEN" | "VALIDATION_FAILED" | "VERSION_CONFLICT" | "WORKSPACE_FORBIDDEN" | "ACCOUNT_SUSPENDED" | "AUTH_INVALID" | "AUTH_SESSION_REVOKED" | "RATE_LIMITED" | "SUPPLIER_NOT_ACTIVE" | "WORKSPACE_MENU_VIOLATION" | "WORKSPACE_MODULE_NOT_FOUND" | "WORKSPACE_SELECTION_REQUIRED" | "WORKSPACE_SESSION_CONFLICT" | "AUDIT_IMMUTABLE" | "AUDIT_REQUIRED" | "EXPORT_APPROVAL_REQUIRED" | "REQUEST_ID_REQUIRED" | "SAME_NATURAL_PERSON_REVIEW" | "SECOND_REVIEW_REQUIRED" | "APPROVAL_NOT_FOUND" | "APPROVAL_STATE_INVALID" | "IDEMPOTENCY_KEY_CONFLICT" | "IDEMPOTENCY_KEY_REQUIRED" | "APPAREL_HISTORY_REWRITE" | "APPAREL_REQUIRED_FIELD_MISSING" | "BUNDLE_SCHEMA_INVALID" | "DIGITAL_HISTORY_REWRITE" | "DIGITAL_MODEL_DUPLICATE" | "DIGITAL_REQUIRED_FIELD_MISSING" | "CATEGORY_DISABLED" | "CATEGORY_DUPLICATE" | "CATEGORY_LEVEL_INVALID" | "CATEGORY_NOT_FOUND" | "CATEGORY_NOT_LEAF" | "CATEGORY_PARENT_INVALID" | "CATEGORY_REFERENCED" | "CATEGORY_TEMPLATE_INVALID" | "DUPLICATE_CATALOG_RESOURCE" | "PRICE_FIELD_FORBIDDEN" | "PRICE_INVALID" | "INITIAL_PRICE_REVIEW_PENDING" | "INITIAL_PRICE_STATE_INVALID" | "PRICE_CHANGE_PENDING" | "PRICE_EFFECT_SCHEDULE_FAILED" | "SUPPLY_PRICE_REVIEW_REQUIRED" | "PRODUCT_APPROVAL_INCOMPLETE" | "PRODUCT_NOT_FOUND" | "PRODUCT_NOT_SALEABLE" | "SUPPLIER_INACTIVE" | "SUPPLIER_PRODUCT_DUPLICATE" | "SUPPLIER_PRODUCT_NOT_FOUND" | "SUPPLIER_SKU_DUPLICATE" | "SELF_APPROVAL_FORBIDDEN" | "SKU_DIMENSION_DUPLICATE" | "FRESH_HISTORY_REWRITE" | "FRESH_REQUIRED_FIELD_MISSING" | "FRESH_WEIGHT_RULE_INVALID" | "REGULATORY_WARNING_REQUIRED" | "REGULATED_CATEGORY_DISABLED" | "QUALIFICATION_REQUIRED" | "TEMPLATE_DATA_INVALID" | "TEMPLATE_DRAFT_EXISTS" | "TEMPLATE_IMMUTABLE" | "TEMPLATE_NOT_FOUND" | "TEMPLATE_SCHEMA_INVALID" | "TEMPLATE_VERSION_INACTIVE" | "TEMPLATE_VERSION_IMMUTABLE" | "REGION_UNAVAILABLE" | "SENSITIVE_FIELD_LEAK" | "CREDIT_CODE_DUPLICATE" | "ENTERPRISE_NOT_FOUND" | "ENTERPRISE_NOT_ACTIVE" | "ENTERPRISE_PROFILE_INCOMPLETE" | "ENTERPRISE_SCOPE_FORBIDDEN" | "INVENTORY_INSUFFICIENT" | "INVENTORY_NEGATIVE" | "INVENTORY_RESERVATION_CONFLICT" | "INVENTORY_STATE_INVALID" | "INVENTORY_VERSION_CONFLICT" | "FULFILLMENT_HANDOVER_PARTY_INVALID" | "AMOUNT_MISMATCH" | "EXTERNAL_SERVICE_UNAVAILABLE" | "ORDER_NOT_FOUND" | "PAYMENT_AMOUNT_MISMATCH" | "PAYMENT_CONCURRENT_CONFLICT" | "PAYMENT_IDEMPOTENCY_CONFLICT" | "PAYMENT_IDENTITY_MISMATCH" | "PAYMENT_METHOD_INVALID" | "PAYMENT_NOTIFICATION_INVALID" | "PAYMENT_STATE_INVALID" | "PAYMENT_TRANSACTION_CONFLICT" | "PAYMENT_TRANSACTION_NOT_FOUND" | "REMITTANCE_ALREADY_SUBMITTED" | "REFUND_ALLOCATION_INVALID" | "REFUND_AUTHORIZATION_NOT_FOUND" | "REFUND_CHANNEL_REJECTED" | "REFUND_DUPLICATE" | "REFUND_OVERPAID" | "REFUND_STATE_CONFLICT" | "SAME_NATURAL_PERSON_REVIEW_FORBIDDEN" | "DUPLICATE_OR_STATE_CONFLICT" | "PERSONAL_RECHARGE_FORBIDDEN" | "WELFARE_BATCH_AMOUNT_MISMATCH" | "WELFARE_CLAIM_MODE_INVALID" | "WELFARE_FUNDING_SOURCE_INVALID" | "WELFARE_PROGRAM_NOT_FOUND";
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
        BuyerOrderItemResponseDto: {
            /** Format: uuid */
            orderItemId: string;
            /** Format: uuid */
            productId: string;
            productName: string;
            quantity: number;
            /** @description Channel sale price snapshot in integer cents */
            salePrice: number;
            /** Format: uuid */
            skuId: string;
            /** Format: uuid */
            supplierId: string;
            /** @description Line amount in integer cents */
            totalAmount: number;
        };
        CatalogMediaResponseDto: {
            alt: string;
            /** Format: uri */
            url: string;
        };
        CategoryCreateRequestDto: {
            /** @enum {number} */
            level: 1 | 2 | 3;
            name: string;
            /** Format: uuid */
            parentId: string | null;
            sortWeight: number;
        };
        CategoryDeleteResponseDto: {
            /** @enum {boolean} */
            deleted: true;
            /** Format: uuid */
            id: string;
            version: number;
        };
        CategoryPatchRequestDto: {
            name?: string;
            /** Format: uuid */
            parentId?: string | null;
            sortWeight?: number;
            /** @enum {string} */
            status?: "ENABLED" | "DISABLED";
            version: number;
        };
        CategoryResponseDto: {
            /** Format: uuid */
            id: string;
            /** @enum {number} */
            level: 1 | 2 | 3;
            name: string;
            /** Format: uuid */
            parentId: string | null;
            sortWeight: number;
            /** @enum {string} */
            status: "ENABLED" | "DISABLED";
            version: number;
        };
        CategoryTemplateCreateRequestDto: {
            afterSaleRules: components["schemas"]["TemplateAfterSaleRulesDto"];
            detailModules: components["schemas"]["TemplateDetailModulesDto"];
            fieldSchema: components["schemas"]["TemplateFieldSchemaDto"];
            /**
             * @default GENERIC
             * @enum {string}
             */
            profile: "FOOD" | "FRESH" | "APPAREL" | "DIGITAL" | "GIFT_BOX" | "GENERIC";
            qualificationRules: components["schemas"]["TemplateQualificationRulesDto"];
            /**
             * @default STANDARD
             * @enum {string}
             */
            regulatoryMode: "STANDARD" | "HIGH_RISK";
            skuDimensions: components["schemas"]["TemplateSkuDimensionsDto"];
        };
        CategoryTemplateDefinitionDto: {
            afterSaleRules: components["schemas"]["TemplateAfterSaleRulesDto"];
            detailModules: components["schemas"]["TemplateDetailModulesDto"];
            fieldSchema: components["schemas"]["TemplateFieldSchemaDto"];
            /**
             * @default GENERIC
             * @enum {string}
             */
            profile: "FOOD" | "FRESH" | "APPAREL" | "DIGITAL" | "GIFT_BOX" | "GENERIC";
            qualificationRules: components["schemas"]["TemplateQualificationRulesDto"];
            /**
             * @default STANDARD
             * @enum {string}
             */
            regulatoryMode: "STANDARD" | "HIGH_RISK";
            skuDimensions: components["schemas"]["TemplateSkuDimensionsDto"];
        };
        CategoryTemplateListResponseDto: {
            activeVersion: number | null;
            /** Format: uuid */
            categoryId: string;
            items: components["schemas"]["CategoryTemplateResponseDto"][];
            total: number;
        };
        CategoryTemplatePatchRequestDto: {
            afterSaleRules: components["schemas"]["TemplateAfterSaleRulesDto"];
            detailModules: components["schemas"]["TemplateDetailModulesDto"];
            fieldSchema: components["schemas"]["TemplateFieldSchemaDto"];
            /**
             * @default GENERIC
             * @enum {string}
             */
            profile: "FOOD" | "FRESH" | "APPAREL" | "DIGITAL" | "GIFT_BOX" | "GENERIC";
            qualificationRules: components["schemas"]["TemplateQualificationRulesDto"];
            /**
             * @default STANDARD
             * @enum {string}
             */
            regulatoryMode: "STANDARD" | "HIGH_RISK";
            revision: number;
            skuDimensions: components["schemas"]["TemplateSkuDimensionsDto"];
        };
        CategoryTemplatePublishRequestDto: {
            revision: number;
        };
        CategoryTemplateResponseDto: {
            afterSaleRules: components["schemas"]["TemplateAfterSaleRulesDto"];
            /** Format: uuid */
            categoryId: string;
            /** Format: date-time */
            createdAt: string;
            detailModules: components["schemas"]["TemplateDetailModulesDto"];
            fieldSchema: components["schemas"]["TemplateFieldSchemaDto"];
            /** Format: uuid */
            id: string;
            /**
             * @default GENERIC
             * @enum {string}
             */
            profile: "FOOD" | "FRESH" | "APPAREL" | "DIGITAL" | "GIFT_BOX" | "GENERIC";
            /** Format: date-time */
            publishedAt: string | null;
            qualificationRules: components["schemas"]["TemplateQualificationRulesDto"];
            /**
             * @default STANDARD
             * @enum {string}
             */
            regulatoryMode: "STANDARD" | "HIGH_RISK";
            /** Format: date-time */
            retiredAt: string | null;
            revision: number;
            skuDimensions: components["schemas"]["TemplateSkuDimensionsDto"];
            /** @enum {string} */
            status: "DRAFT" | "PUBLISHED" | "RETIRED";
            version: number;
        };
        CategoryTreeNodeDto: {
            children: components["schemas"]["CategoryTreeNodeDto"][];
            /** Format: uuid */
            id: string;
            /** @enum {number} */
            level: 1 | 2 | 3;
            name: string;
            /** Format: uuid */
            parentId: string | null;
            sortWeight: number;
            /** @enum {string} */
            status: "ENABLED" | "DISABLED";
            version: number;
        };
        CategoryTreeResponseDto: {
            items: components["schemas"]["CategoryTreeNodeDto"][];
            total: number;
        };
        ClaimSensitiveApprovalRequestDto: {
            version: number;
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
        ConsumerCatalogPageResponseDto: {
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            items: components["schemas"]["ConsumerCatalogProductResponseDto"][];
            page: number;
            pageSize: number;
            region: components["schemas"]["ConsumerCatalogRegionResponseDto"];
            /** @example 江苏福礼团供应链科技有限公司 */
            sellerName: string;
            total: number;
        };
        ConsumerCatalogProductResponseDto: {
            activeSkuCount: number;
            /** Format: uuid */
            categoryId: string;
            media: components["schemas"]["CatalogMediaResponseDto"][];
            name: string;
            /** Format: uuid */
            productId: string;
            /** @description Minimum active SKU retail price in integer cents */
            retailSalePrice: number;
            /** Format: uuid */
            supplierId: string;
        };
        ConsumerCatalogQueryDto: {
            /** @default 1 */
            page: number;
            /** @default 20 */
            pageSize: number;
            /** @description Reserved for a server-verified delivery region; arbitrary client scope is rejected */
            regionCode?: string;
        };
        ConsumerCatalogRegionResponseDto: {
            code: string | null;
            /** @example 请选择配送区域 */
            label: string;
            /** @enum {string} */
            status: "UNSELECTED";
        };
        CreateBuyerOrderResponseDto: {
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            deliveryFee: number;
            discountAmount: number;
            goodsAmount: number;
            items: components["schemas"]["BuyerOrderItemResponseDto"][];
            /** Format: uuid */
            orderId: string;
            orderNo: string;
            /** @enum {string} */
            orderStatus: "PENDING_PAYMENT";
            /** @enum {string} */
            orderType: "CONSUMER" | "ENTERPRISE";
            /** @enum {string} */
            paymentStatus: "PENDING";
            /** @example 江苏福礼团供应链科技有限公司 */
            sellerName: string;
            supplierFulfillments: components["schemas"]["SupplierFulfillmentOrderResponseDto"][];
            totalAmount: number;
        };
        CreateEnterpriseOrderRequestDto: {
            /**
             * Format: uuid
             * @description Omit all checkout fields to use the active enterprise defaults
             */
            enterpriseAddressId?: string;
            /**
             * Format: uuid
             * @description Omit all checkout fields to use the active enterprise defaults
             */
            invoiceProfileId?: string;
            items: components["schemas"]["CreateOrderItemRequestDto"][];
            /**
             * @description Defaults to WECHAT_PAY only when all checkout fields are omitted
             * @enum {string}
             */
            paymentMethod?: "WECHAT_PAY" | "BANK_TRANSFER";
        };
        CreateEnterpriseOrderResponseDto: {
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            deliveryFee: number;
            discountAmount: number;
            enterpriseProcurement: components["schemas"]["EnterpriseProcurementResponseDto"];
            goodsAmount: number;
            items: components["schemas"]["BuyerOrderItemResponseDto"][];
            /** Format: uuid */
            orderId: string;
            orderNo: string;
            /** @enum {string} */
            orderStatus: "PENDING_PAYMENT";
            /** @enum {string} */
            orderType: "CONSUMER" | "ENTERPRISE";
            /** @enum {string} */
            paymentStatus: "PENDING";
            /** @example 江苏福礼团供应链科技有限公司 */
            sellerName: string;
            supplierFulfillments: components["schemas"]["SupplierFulfillmentOrderResponseDto"][];
            totalAmount: number;
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
        CreateOrderItemRequestDto: {
            quantity: number;
            /** Format: uuid */
            skuId: string;
        };
        CreateOrderRequestDto: {
            items: components["schemas"]["CreateOrderItemRequestDto"][];
        };
        CreateSensitiveApprovalRequestDto: {
            reason: string;
            /** @enum {string} */
            resource: "AUDIT_EVENTS";
        };
        CreateWelfareBatchRequestDto: {
            agreementVersion: number;
            batchNo: string;
            /** @enum {string} */
            claimMode: "ENTERPRISE_ASSIGNED" | "COMPANY_ASSIGNED" | "PHYSICAL_CARD_OR_CODE";
            /** Format: uuid */
            enterpriseCustomerId?: string;
            issueCount: number;
            /** @description Integer cents */
            totalAmount: number;
            /** @description Integer cents */
            unitAmount: number;
        };
        CreateWelfareProgramRequestDto: {
            canPayDeliveryFee: boolean;
            /** @enum {string} */
            fundingType: "ENTERPRISE_GRANT" | "COMPANY_GIFT" | "PHYSICAL_CARD_OR_CODE";
            name: string;
            refundPolicy: string;
            scopeRules: components["schemas"]["WelfareScopeRulesDto"];
            /** @enum {string} */
            scopeType: "ALL_PRODUCTS" | "CATEGORY" | "PRODUCT" | "SKU";
        };
        DecideSensitiveApprovalRequestDto: {
            /** @enum {string} */
            decision: "APPROVE" | "REJECT";
            opinion: string;
            secondVerificationCode: string;
            version: number;
        };
        EnterpriseAddressInputDto: {
            consignee: string;
            deliveryNote?: string;
            fullAddress: string;
            isDefault: boolean;
            mobile: string;
            region: string;
        };
        EnterpriseAddressResponseDto: {
            consignee: string;
            deliveryNote?: string;
            fullAddress: string;
            /** Format: uuid */
            id: string;
            isDefault: boolean;
            mobileMasked: string;
            region: string;
        };
        EnterpriseCatalogPageResponseDto: {
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            items: components["schemas"]["EnterpriseCatalogProductResponseDto"][];
            page: number;
            pageSize: number;
            /** @example 江苏福礼团供应链科技有限公司 */
            sellerName: string;
            total: number;
        };
        EnterpriseCatalogProductResponseDto: {
            activeSkuCount: number;
            /** Format: uuid */
            categoryId: string;
            /** @description Minimum active SKU enterprise procurement price in integer cents */
            enterpriseSalePrice: number;
            media: components["schemas"]["CatalogMediaResponseDto"][];
            name: string;
            /** Format: uuid */
            productId: string;
            skuIds: string[];
            /** Format: uuid */
            supplierId: string;
            templateVersion: number;
        };
        EnterpriseCatalogQueryDto: {
            /** @default 1 */
            page: number;
            /** @default 20 */
            pageSize: number;
        };
        EnterpriseCheckoutAddressResponseDto: {
            consignee: string;
            deliveryNote: string | null;
            fullAddress: string;
            /** @example 138****8000 */
            mobileMasked: string;
            region: string;
        };
        EnterpriseCheckoutInvoiceResponseDto: {
            bankAccountMasked: string | null;
            bankName: string | null;
            registeredAddress: string | null;
            registeredPhoneMasked: string | null;
            /** @example 9132********2D3X */
            taxNumberMasked: string;
            title: string;
        };
        EnterpriseFoodSkuResponseDto: {
            /** @description Enterprise procurement price in integer cents */
            enterpriseSalePrice: number;
            /** Format: uuid */
            skuId: string;
            specifications: components["schemas"]["PublicFoodDetailFieldResponseDto"][];
        };
        EnterpriseInvoiceProfileInputDto: {
            bankAccount?: string;
            bankName?: string;
            registeredAddress?: string;
            registeredPhone?: string;
            taxNumber: string;
            title: string;
        };
        EnterpriseInvoiceProfileResponseDto: {
            bankAccountMasked?: string;
            bankName?: string;
            /** Format: uuid */
            id: string;
            registeredAddress?: string;
            registeredPhoneMasked?: string;
            taxNumberMasked: string;
            title: string;
        };
        EnterpriseProcurementResponseDto: {
            address: components["schemas"]["EnterpriseCheckoutAddressResponseDto"];
            /** Format: uuid */
            enterpriseOrderId: string;
            invoiceProfile: components["schemas"]["EnterpriseCheckoutInvoiceResponseDto"];
            /** @enum {string} */
            nextAction: "SUBMIT_REMITTANCE_PROOF" | "START_WECHAT_PAYMENT" | "WAIT_FOR_PAYMENT_CONFIRMATION" | "VIEW_ORDER";
            /** @enum {string} */
            paymentMethod: "WECHAT_PAY" | "BANK_TRANSFER";
            /** @enum {string} */
            remittanceReviewStatus: "NOT_SUBMITTED" | "PENDING_REVIEW" | "CONFIRMED" | "REJECTED";
            /** @enum {string} */
            status: "PENDING_PAYMENT" | "PAYMENT_CONFIRMING" | "PAID" | "FULFILLING" | "COMPLETED" | "CANCELLED";
        };
        EnterpriseProductDetailResponseDto: {
            brand: string | null;
            bundleItems?: components["schemas"]["PublicGiftBoxItemResponseDto"][];
            /** Format: uuid */
            categoryId: string;
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            detailModules: components["schemas"]["PublicFoodDetailModuleResponseDto"][];
            /** @description Minimum active SKU enterprise procurement price in integer cents */
            enterpriseSalePrice: number;
            media: components["schemas"]["CatalogMediaResponseDto"][];
            name: string;
            /** Format: uuid */
            productId: string;
            /** @example 江苏福礼团供应链科技有限公司 */
            sellerName: string;
            skus: components["schemas"]["EnterpriseFoodSkuResponseDto"][];
            /** Format: uuid */
            supplierId: string;
            /** @enum {string} */
            templateProfile: "FOOD" | "FRESH" | "APPAREL" | "DIGITAL" | "GIFT_BOX";
            templateVersion: number;
        };
        EnterpriseRegistrationCreatedResponseDto: {
            /** @enum {string} */
            nextAction: "COMPLETE_PROFILE";
            /** Format: date-time */
            registrationAccessExpiresAt: string;
            /** @description Short-lived registration credential returned only to the creating client */
            registrationAccessToken: string;
            /** Format: uuid */
            registrationId: string;
            /** @enum {string} */
            status: "DRAFT" | "PENDING_REVIEW" | "CORRECTION_REQUIRED" | "ACTIVE" | "SUSPENDED" | "REJECTED";
            version: number;
        };
        EnterpriseRegistrationPageResponseDto: {
            items: components["schemas"]["EnterpriseRegistrationResponseDto"][];
            page: number;
            pageSize: number;
            total: number;
        };
        EnterpriseRegistrationPatchRequestDto: {
            addresses?: components["schemas"]["EnterpriseAddressInputDto"][];
            administratorEmail?: string;
            administratorName?: string;
            administratorTitle?: string;
            creditCode?: string;
            enterpriseType?: string;
            invoiceProfile?: components["schemas"]["EnterpriseInvoiceProfileInputDto"];
            legalName?: string;
            licenseObjectKey?: string;
            /** Format: date */
            licenseValidUntil?: string | null;
            registeredAddress?: string;
            version: number;
        };
        EnterpriseRegistrationRequestDto: {
            addresses?: components["schemas"]["EnterpriseAddressInputDto"][];
            administratorEmail?: string;
            administratorMobile: string;
            administratorName: string;
            administratorTitle?: string;
            agreementVersion: string;
            creditCode: string;
            enterpriseType?: string;
            invoiceProfile?: components["schemas"]["EnterpriseInvoiceProfileInputDto"];
            legalName: string;
            licenseObjectKey?: string;
            /** Format: date */
            licenseValidUntil?: string | null;
            registeredAddress?: string;
            verificationCode: string;
        };
        EnterpriseRegistrationResponseDto: {
            addresses: components["schemas"]["EnterpriseAddressResponseDto"][];
            administratorEmailMasked?: string;
            administratorMobileMasked: string;
            administratorName: string;
            businessLicenseProvided: boolean;
            businessLicenseReference?: string;
            correctionFields: ("LEGAL_NAME" | "CREDIT_CODE" | "REGISTERED_ADDRESS" | "ENTERPRISE_TYPE" | "BUSINESS_LICENSE" | "CONTACT" | "INVOICE_PROFILE" | "SHIPPING_ADDRESS" | "AGREEMENT")[];
            creditCodeMasked: string;
            enterpriseType?: string;
            /** Format: uuid */
            id: string;
            invoiceProfile?: components["schemas"]["EnterpriseInvoiceProfileResponseDto"];
            legalName: string;
            /** Format: date */
            licenseValidUntil?: string;
            nextAction: string;
            registeredAddress?: string;
            reviewOpinion?: string;
            /** @enum {string} */
            status: "DRAFT" | "PENDING_REVIEW" | "CORRECTION_REQUIRED" | "ACTIVE" | "SUSPENDED" | "REJECTED";
            version: number;
        };
        EnterpriseRemittanceProofRequestDto: {
            /** @description Declared company remittance amount in integer cents */
            amount: number;
            proofObjectKey: string;
        };
        EnterpriseRemittanceResponseDto: {
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            /** Format: uuid */
            orderId: string;
            orderNo: string;
            /** @enum {string} */
            orderStatus: "PENDING_PAYMENT" | "PAID";
            /** @enum {string} */
            paymentMethod: "BANK_TRANSFER";
            /** @enum {string} */
            paymentStatus: "PENDING" | "PAID";
            /** Format: uuid */
            remittanceId: string;
            /** @enum {string} */
            remittanceStatus: "PENDING_REVIEW" | "CONFIRMED" | "REJECTED";
            /** Format: date-time */
            reviewedAt: string | null;
            /** @example 江苏福礼团供应链科技有限公司 */
            sellerName: string;
            /** Format: date-time */
            submittedAt: string;
            totalAmount: number;
            version: number;
        };
        EnterpriseRemittanceReviewRequestDto: {
            /** @description Reviewed amount in integer cents */
            amount: number;
            /** @enum {string} */
            decision: "CONFIRM" | "REJECT";
            reason: string;
            version: number;
        };
        EnterpriseReviewRequestDto: {
            correctionFields?: ("LEGAL_NAME" | "CREDIT_CODE" | "REGISTERED_ADDRESS" | "ENTERPRISE_TYPE" | "BUSINESS_LICENSE" | "CONTACT" | "INVOICE_PROFILE" | "SHIPPING_ADDRESS" | "AGREEMENT")[];
            /** @enum {string} */
            decision: "REQUEST_CORRECTION" | "APPROVE" | "REJECT";
            opinion: string;
            version: number;
        };
        EnterpriseSubmitReviewRequestDto: {
            version: number;
        };
        EnterpriseSuspendRequestDto: {
            reason: string;
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
        FulfillmentNodeRequestDto: {
            expectedVersion: number;
            /** @enum {string} */
            handoverParty?: "RUNNER" | "COMPANY_LOGISTICS";
            handoverReference?: string;
            /** @enum {string} */
            node: "ACCEPT" | "REPORT_SHORTAGE" | "START_PREPARING" | "MARK_READY" | "HANDOVER";
            reason?: string;
            shortages?: components["schemas"]["FulfillmentShortageItemRequestDto"][];
        };
        FulfillmentShortageItemRequestDto: {
            /** Format: uuid */
            orderItemId: string;
            quantity: number;
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
        InitialPriceReviewDto: {
            /** @enum {string} */
            approvalType: "PRODUCT_INITIAL_PRICE";
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            name: string;
            reviewOpinion?: string | null;
            skus: components["schemas"]["InitialPriceReviewSkuDto"][];
            /** @enum {string} */
            status: "PENDING" | "APPROVED" | "REJECTED";
            /** Format: uuid */
            supplierId: string;
            /** Format: uuid */
            supplierProductId: string;
            /** Format: date-time */
            updatedAt: string;
            version: number;
        };
        InitialPriceReviewPageDto: {
            items: components["schemas"]["InitialPriceReviewDto"][];
            total: number;
        };
        InitialPriceReviewSkuDto: {
            /** Format: uuid */
            id: string;
            requestedEnterpriseSalePrice: number;
            requestedRetailSalePrice: number;
            requestedSupplyPrice: number;
            supplierSkuCode: string;
        };
        InitialPriceReviewSummaryDto: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            status: "PENDING" | "APPROVED" | "REJECTED";
            /** Format: date-time */
            submittedAt: string;
            version: number;
        };
        InitialPriceRowRequestDto: {
            requestedEnterpriseSalePrice: number;
            requestedRetailSalePrice: number;
            requestedSupplyPrice: number;
            supplierSkuCode: string;
        };
        InitialPricesRequestDto: {
            prices: components["schemas"]["InitialPriceRowRequestDto"][];
            /** Format: uuid */
            requestId: string;
        };
        InitialPricesResponseDto: {
            /** Format: uuid */
            id: string;
            prices: components["schemas"]["InitialPriceRowRequestDto"][];
            /** @enum {string} */
            status: "PENDING";
            /** Format: uuid */
            supplierProductId: string;
            version: number;
        };
        ListedSkuPriceDto: {
            approvedSupplyPrice: number;
            code: string;
            currentEnterpriseSalePrice: number;
            currentRetailSalePrice: number;
            enterprisePriceVersion: number;
            /** Format: uuid */
            id: string;
            productName: string;
            retailPriceVersion: number;
            supplyPriceVersion: number;
        };
        ListedSkuPricePageDto: {
            items: components["schemas"]["ListedSkuPriceDto"][];
            total: number;
        };
        MiniappPaymentPayloadDto: {
            nonceStr: string;
            package: string;
            paySign: string;
            /** @enum {string} */
            signType: "RSA";
            timeStamp: string;
        };
        ProductApprovalDecisionRequestDto: {
            /** @enum {string} */
            decision: "APPROVE" | "REJECT";
            opinion: string;
            secondVerificationCode?: string;
            version: number;
        };
        ProductApprovalDecisionResponseDto: {
            /** @enum {string} */
            approvalType: "PRODUCT_MATERIAL" | "PRODUCT_INITIAL_PRICE";
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            productId?: string | null;
            /** @enum {string} */
            publicationStatus: "ACTIVE" | "REJECTED" | "WAITING_OTHER_APPROVAL";
            reviewOpinion: string;
            /** @enum {string} */
            status: "APPROVED" | "REJECTED";
            /** Format: uuid */
            supplierProductId: string;
            version: number;
        };
        ProductChannelVisibilityHistoryItemDto: {
            after: components["schemas"]["ProductChannelVisibilitySnapshotDto"];
            before: components["schemas"]["ProductChannelVisibilitySnapshotDto"];
            /** @enum {string} */
            event: "INITIAL" | "CHANGE";
            fromVersion: number;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            occurredAt: string;
            /** Format: uuid */
            productId: string;
            reason: string;
            /** Format: uuid */
            supplierProductId: string;
            toVersion: number;
        };
        ProductChannelVisibilityHistoryPageDto: {
            items: components["schemas"]["ProductChannelVisibilityHistoryItemDto"][];
            /** Format: uuid */
            supplierProductId: string;
        };
        ProductChannelVisibilitySnapshotDto: {
            enterpriseMinOrderQty: number;
            enterprisePackageMultiple: number;
            isEnterpriseProcurementEnabled: boolean;
            isRetailEnabled: boolean;
        };
        ProductMaterialApprovalResponseDto: {
            /** @enum {string} */
            approvalType: "PRODUCT_MATERIAL";
            /** @enum {string} */
            assignedAccountTypeCode: "COMPANY_PRODUCT_OPS";
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            objectId: string;
            /** @enum {string} */
            objectType: "SUPPLIER_PRODUCT";
            /** @enum {string} */
            status: "PENDING";
            version: number;
        };
        ProductMaterialReviewDto: {
            /** @enum {string} */
            approvalType: "PRODUCT_MATERIAL";
            attributes: {
                [key: string]: unknown;
            };
            brand?: string | null;
            /** Format: uuid */
            categoryId: string;
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            isEnterpriseProcurementEnabled: boolean;
            isRetailEnabled: boolean;
            name: string;
            preparationMinutes: number;
            qualificationReferenceCount: number;
            /** Format: date-time */
            qualificationValidUntil: string | null;
            reviewOpinion?: string | null;
            skus: components["schemas"]["ProductMaterialReviewSkuDto"][];
            /** @enum {string} */
            status: "PENDING" | "APPROVED" | "REJECTED";
            /** Format: uuid */
            supplierId: string;
            /** Format: uuid */
            supplierProductId: string;
            templateVersion: number;
            /** Format: date-time */
            updatedAt: string;
            version: number;
        };
        ProductMaterialReviewPageDto: {
            items: components["schemas"]["ProductMaterialReviewDto"][];
            total: number;
        };
        ProductMaterialReviewSkuDto: {
            attributes: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            id: string;
            supplierSkuCode: string;
        };
        PublicFoodDetailFieldResponseDto: {
            key: string;
            label: string;
            value: string;
        };
        PublicFoodDetailModuleResponseDto: {
            fields: components["schemas"]["PublicFoodDetailFieldResponseDto"][];
            key: string;
            /** @enum {string} */
            kind: "AFTER_SALE" | "FIELDS" | "FIXED_NOTICE";
            notice: string | null;
            title: string;
        };
        PublicFoodProductDetailResponseDto: {
            brand: string | null;
            bundleItems?: components["schemas"]["PublicGiftBoxItemResponseDto"][];
            /** Format: uuid */
            categoryId: string;
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            detailModules: components["schemas"]["PublicFoodDetailModuleResponseDto"][];
            media: components["schemas"]["CatalogMediaResponseDto"][];
            name: string;
            /** Format: uuid */
            productId: string;
            /** @description Minimum active SKU retail price in integer cents */
            retailSalePrice: number;
            /** @example 江苏福礼团供应链科技有限公司 */
            sellerName: string;
            skus: components["schemas"]["PublicFoodSkuResponseDto"][];
            /** Format: uuid */
            supplierId: string;
            /** @enum {string} */
            templateProfile: "FOOD" | "FRESH" | "APPAREL" | "DIGITAL" | "GIFT_BOX";
            templateVersion: number;
        };
        PublicFoodSkuResponseDto: {
            /** @description Retail price in integer cents */
            retailSalePrice: number;
            /** Format: uuid */
            skuId: string;
            specifications: components["schemas"]["PublicFoodDetailFieldResponseDto"][];
        };
        PublicGiftBoxItemResponseDto: {
            minimumExpiryDays: number;
            name: string;
            quantity: number;
            specification: string;
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
        PublicProductCardResponseDto: {
            activeSkuCount: number;
            name: string;
            /** Format: uuid */
            productId: string;
            /** @description Minimum active SKU retail price in integer cents */
            retailSalePrice: number;
        };
        PublicProductPageResponseDto: {
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            items: components["schemas"]["PublicProductCardResponseDto"][];
            page: number;
            pageSize: number;
            /** @example 江苏福礼团供应链科技有限公司 */
            sellerName: string;
            /** @example 该供应来源的更多商品 */
            sourceLabel: string;
            /** Format: uuid */
            supplierId: string;
            total: number;
        };
        RefundCreateRequestDto: {
            /** @description Server-issued approved refund authorization version */
            authorizationVersion: number;
            reason: string;
        };
        RefundResponseDto: {
            /** Format: uuid */
            afterSaleId: string;
            cashRefundAmount: number;
            /** Format: uuid */
            orderId: string;
            /** Format: uuid */
            orderItemId: string;
            /** Format: uuid */
            refundId: string;
            refundNo: string;
            /** @enum {string} */
            status: "PROCESSING" | "PARTIAL_CHANNEL_DONE" | "SUCCEEDED" | "UNKNOWN" | "FAILED";
            /** @enum {string} */
            wechatChannelStatus: "NOT_REQUIRED" | "PENDING" | "PROCESSING" | "SUCCEEDED" | "UNKNOWN" | "FAILED";
            welfareCardRefundAmount: number;
            /** @enum {string} */
            welfareChannelStatus: "NOT_REQUIRED" | "PENDING" | "PROCESSING" | "SUCCEEDED" | "UNKNOWN" | "FAILED";
        };
        RegulatedCategoryControlPageDto: {
            items: components["schemas"]["RegulatedCategoryControlResponseDto"][];
            total: number;
        };
        RegulatedCategoryControlResponseDto: {
            /** Format: uuid */
            categoryId: string;
            companyQualificationReferenceCount: number;
            /** Format: date-time */
            disabledAt?: string | null;
            /** Format: date-time */
            enabledAt?: string | null;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            qualificationValidUntil: string | null;
            /** @enum {string} */
            status: "DISABLED" | "ENABLED";
            version: number;
        };
        RegulatedCategoryDisableRequestDto: {
            reason: string;
            secondVerificationCode: string;
            version: number;
        };
        RegulatedCategoryEnableRequestDto: {
            companyQualificationReferences: string[];
            /** Format: date-time */
            qualificationValidUntil: string;
            secondVerificationCode: string;
            version: number;
        };
        SalePriceChangeRequestDto: {
            /** Format: date-time */
            effectiveAt: string;
            enterprisePriceVersion?: number;
            enterpriseSalePrice?: number;
            reason: string;
            retailPriceVersion?: number;
            retailSalePrice?: number;
            secondVerificationCode: string;
        };
        SalePriceChangeResponseDto: {
            currentEnterpriseSalePrice: number;
            currentRetailSalePrice: number;
            /** Format: date-time */
            effectiveAt: string;
            enterprisePriceVersion: number;
            retailPriceVersion: number;
            reviewCreated: boolean;
            scheduled: boolean;
            /** Format: uuid */
            skuId: string;
        };
        SelectWorkspaceRequestDto: {
            secondVerificationCode?: string;
            selectionNonce: string;
        };
        SensitiveApprovalPageResponseDto: {
            items: components["schemas"]["SensitiveApprovalTaskResponseDto"][];
            total: number;
        };
        SensitiveApprovalTaskResponseDto: {
            /** @enum {string} */
            approvalType: "SENSITIVE_EXPORT";
            /** Format: date-time */
            createdAt: string;
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            resource: "AUDIT_EVENTS";
            reviewOpinion?: string | null;
            /** @enum {string} */
            status: "PENDING" | "IN_REVIEW" | "APPROVED" | "REJECTED" | "CANCELLED";
            /** Format: date-time */
            updatedAt: string;
            version: number;
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
        SubmitProductMaterialRequestDto: {
            /** Format: uuid */
            requestId: string;
            version: number;
        };
        SubmitReviewRequestDto: {
            /** Format: uuid */
            requestId: string;
            version: number;
        };
        SupplierFulfillmentItemDto: {
            /** Format: uuid */
            orderItemId: string;
            productName: string;
            quantity: number;
            skuLabel: string;
        };
        SupplierFulfillmentNodeDto: {
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            node: "ACCEPT" | "REPORT_SHORTAGE" | "START_PREPARING" | "MARK_READY" | "HANDOVER";
            /** Format: date-time */
            occurredAt: string;
            reason?: string | null;
            resultingVersion: number;
        };
        SupplierFulfillmentOrderResponseDto: {
            /** Format: uuid */
            fulfillmentOrderId: string;
            /** @description Supplier group sale amount in integer cents */
            goodsAmount: number;
            itemCount: number;
            /** @enum {string} */
            status: "PENDING_PAYMENT";
            /** Format: uuid */
            supplierId: string;
        };
        SupplierFulfillmentPickupPointDto: {
            address: string;
        };
        SupplierInitialPriceSkuDto: {
            /** Format: uuid */
            id: string;
            requestedEnterpriseSalePrice: number | null;
            requestedRetailSalePrice: number | null;
            requestedSupplyPrice: number | null;
            supplierSkuCode: string;
        };
        SupplierInitialPricingPageDto: {
            items: components["schemas"]["SupplierInitialPricingProductDto"][];
            total: number;
        };
        SupplierInitialPricingProductDto: {
            initialPriceEditable: boolean;
            latestReview: components["schemas"]["InitialPriceReviewSummaryDto"] | null;
            name: string;
            skus: components["schemas"]["SupplierInitialPriceSkuDto"][];
            /** @enum {string} */
            status: "DRAFT" | "PENDING_MATERIAL_REVIEW" | "CORRECTION_REQUIRED" | "MATERIAL_APPROVED" | "ACTIVE" | "OFF_SHELF" | "REJECTED" | "ARCHIVED";
            /** Format: uuid */
            supplierProductId: string;
            version: number;
        };
        SupplierInventoryAdjustmentRequestDto: {
            expectedVersion: number;
            /** @enum {string} */
            mode: "DELTA_AVAILABLE" | "SET_AVAILABLE";
            quantity: number;
            reason: string;
            safetyStockQty?: number;
            /** @enum {string} */
            type: "INCREASE" | "DECREASE" | "STOCKTAKE_GAIN" | "STOCKTAKE_LOSS" | "DAMAGE";
        };
        SupplierInventoryBalanceDto: {
            availableQty: number;
            damagedQty: number;
            productName: string;
            reservedQty: number;
            safetyStockQty: number;
            skuCode: string;
            /** Format: uuid */
            skuId: string;
            soldQty: number;
            /** @enum {string} */
            status: "AVAILABLE" | "LOW_STOCK" | "OUT_OF_STOCK";
            /** Format: date-time */
            updatedAt: string;
            version: number;
            warning: boolean;
        };
        SupplierInventoryChangeDto: {
            afterAvailableQty: number;
            afterReservedQty: number;
            afterSoldQty: number;
            availableDelta: number;
            beforeAvailableQty: number;
            beforeReservedQty: number;
            beforeSoldQty: number;
            damagedDelta: number;
            /** Format: uuid */
            id: string;
            /** Format: date-time */
            occurredAt: string;
            reason: string;
            reservedDelta: number;
            resultingVersion: number;
            /** Format: uuid */
            skuId: string;
            soldDelta: number;
            type: string;
        };
        SupplierInventoryHistoryDto: {
            items: components["schemas"]["SupplierInventoryChangeDto"][];
            total: number;
        };
        SupplierInventoryMutationDto: {
            balance: components["schemas"]["SupplierInventoryBalanceDto"];
            log: components["schemas"]["SupplierInventoryChangeDto"];
        };
        SupplierInventoryPageDto: {
            items: components["schemas"]["SupplierInventoryBalanceDto"][];
            page: number;
            pageSize: number;
            total: number;
        };
        SupplierLoginRequestDto: {
            /** @example 13800138000 */
            loginAccount: string;
            password: string;
            /** Format: uuid */
            requestId: string;
            verificationCode?: string;
        };
        SupplierPageResponseDto: {
            items: components["schemas"]["SupplierResponseDto"][];
            page: number;
            pageSize: number;
            total: number;
        };
        SupplierProductChannelVisibilityRequestDto: {
            enterpriseMinOrderQty: number;
            enterprisePackageMultiple: number;
            isEnterpriseProcurementEnabled: boolean;
            isRetailEnabled: boolean;
            reason: string;
            version: number;
        };
        SupplierProductChannelVisibilityResponseDto: {
            enterpriseMinOrderQty: number;
            enterprisePackageMultiple: number;
            isEnterpriseProcurementEnabled: boolean;
            isRetailEnabled: boolean;
            /** Format: uuid */
            productId: string;
            productVersion: number;
            /** Format: uuid */
            supplierProductId: string;
            supplierProductVersion: number;
        };
        SupplierProductDraftRequestDto: {
            attributes: {
                [key: string]: unknown;
            };
            brand: string | null;
            /** Format: uuid */
            categoryId: string;
            enterpriseMinOrderQty: number;
            enterprisePackageMultiple: number;
            isEnterpriseProcurementEnabled: boolean;
            isRetailEnabled: boolean;
            name: string;
            preparationMinutes: number;
            qualificationReferences: string[];
            /** Format: date-time */
            qualificationValidUntil?: string | null;
            skus: components["schemas"]["SupplierProductSkuDraftRequestDto"][];
            templateVersion: number;
        };
        SupplierProductPatchRequestDto: {
            attributes?: {
                [key: string]: unknown;
            };
            brand?: string | null;
            /** Format: uuid */
            categoryId?: string;
            enterpriseMinOrderQty?: number;
            enterprisePackageMultiple?: number;
            isEnterpriseProcurementEnabled?: boolean;
            isRetailEnabled?: boolean;
            name?: string;
            preparationMinutes?: number;
            qualificationReferences?: string[];
            /** Format: date-time */
            qualificationValidUntil?: string | null;
            skus?: components["schemas"]["SupplierProductSkuDraftRequestDto"][];
            templateVersion?: number;
            version: number;
        };
        SupplierProductQueryDto: {
            /** Format: uuid */
            excludeProductId?: string;
            /** @default 1 */
            page: number;
            /** @default 20 */
            pageSize: number;
        };
        SupplierProductResponseDto: {
            attributes: {
                [key: string]: unknown;
            };
            brand: string | null;
            /** Format: uuid */
            categoryId: string;
            enterpriseMinOrderQty: number;
            enterprisePackageMultiple: number;
            /** Format: uuid */
            id: string;
            isEnterpriseProcurementEnabled: boolean;
            isRetailEnabled: boolean;
            name: string;
            preparationMinutes: number;
            qualificationReferenceCount: number;
            /** Format: date-time */
            qualificationValidUntil: string | null;
            skus: components["schemas"]["SupplierProductSkuResponseDto"][];
            /** @enum {string} */
            status: "DRAFT" | "PENDING_MATERIAL_REVIEW" | "CORRECTION_REQUIRED" | "MATERIAL_APPROVED" | "ACTIVE" | "OFF_SHELF" | "REJECTED" | "ARCHIVED";
            templateVersion: number;
            version: number;
        };
        SupplierProductSkuDraftRequestDto: {
            attributes: {
                [key: string]: unknown;
            };
            initialStock: number;
            supplierSkuCode: string;
        };
        SupplierProductSkuResponseDto: {
            attributes: {
                [key: string]: unknown;
            };
            /** Format: uuid */
            id: string;
            initialStock: number;
            /** @enum {string} */
            status: "DRAFT" | "ACTIVE" | "INACTIVE" | "ARCHIVED";
            supplierSkuCode: string;
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
        SupplierSelectWorkspaceRequestDto: {
            secondVerificationCode?: string;
            selectionNonce: string;
        };
        SupplierSessionResponseDto: {
            accountTypeCode: string;
            /** Format: date-time */
            expiresAt: string;
            /** Format: uuid */
            functionalAccountId: string;
            /** @enum {string} */
            ownerType: "SUPPLIER";
            workspaceRoute: string;
        };
        SupplierSubOrderPageResponseDto: {
            items: components["schemas"]["SupplierSubOrderResponseDto"][];
            page: number;
            pageSize: number;
            total: number;
        };
        SupplierSubOrderResponseDto: {
            /** @enum {string} */
            channelType: "CONSUMER" | "ENTERPRISE";
            /** Format: date-time */
            createdAt: string;
            /** @enum {string} */
            handoverStatus: "NOT_READY" | "READY" | "HANDED_OVER";
            /** Format: uuid */
            id: string;
            items: components["schemas"]["SupplierFulfillmentItemDto"][];
            nodes: components["schemas"]["SupplierFulfillmentNodeDto"][];
            orderNo: string;
            pickupPoint: components["schemas"]["SupplierFulfillmentPickupPointDto"];
            /** @enum {string} */
            preparationStatus: "PENDING" | "ACCEPTED" | "PREPARING" | "READY_FOR_HANDOVER" | "HANDED_OVER" | "COMPLETED" | "CANCELLED";
            subOrderNo: string;
            /** Format: date-time */
            updatedAt: string;
            version: number;
        };
        SupplierWorkspaceChoiceDto: {
            /** Format: uuid */
            accountId: string;
            accountTypeCode: string;
            accountTypeName: string;
            /** Format: date-time */
            lastUsedAt?: string | null;
            ownerDisplayName: string;
            /** @enum {string} */
            ownerType: "SUPPLIER";
            /** @enum {string} */
            status: "ACTIVE" | "PENDING_ACTIVATION" | "REVOKED" | "SUSPENDED";
            workspaceRoute: string;
        };
        SupplierWorkspaceChoiceResponseDto: {
            /** @example /supplier/account-select */
            accountSelectRoute: string;
            accounts: components["schemas"]["SupplierWorkspaceChoiceDto"][];
            selectionNonce: string;
            selectionRequired: boolean;
        };
        SupplierWorkspaceMenuItemDto: {
            /** @enum {string} */
            key: "workspace";
            label: string;
            route: string;
        };
        SupplierWorkspaceModuleDetailDto: {
            /** @enum {string} */
            availability: "AVAILABLE" | "DEFERRED";
            dataBoundary: string;
            /** @enum {string} */
            deliveryStage: "M1" | "M2" | "M3" | "M5";
            description: string;
            label: string;
            moduleKey: string;
            sections: string[];
            timeline: components["schemas"]["SupplierWorkspaceModuleTimelineEventDto"][];
        };
        SupplierWorkspaceModuleItemDto: {
            /** @enum {string} */
            availability: "AVAILABLE" | "DEFERRED";
            dataBoundary: string;
            /** @enum {string} */
            deliveryStage: "M1" | "M2" | "M3" | "M5";
            description: string;
            label: string;
            moduleKey: string;
        };
        SupplierWorkspaceModuleTimelineEventDto: {
            code: string;
            label: string;
            /** @enum {string} */
            stage: "M1" | "M2" | "M3" | "M5";
            /** @enum {string} */
            status: "DONE" | "DEFERRED";
        };
        SupplierWorkspacePageFiltersDto: {
            /** @enum {string} */
            availability: "ALL" | "AVAILABLE" | "DEFERRED";
            keyword: string;
        };
        SupplierWorkspacePageResponseDto: {
            /** @enum {string} */
            accountTypeCode: "SUPPLIER_ACCOUNT_ADMIN" | "SUPPLIER_PRODUCT" | "SUPPLIER_PRICING" | "SUPPLIER_INVENTORY" | "SUPPLIER_FULFILLMENT" | "SUPPLIER_AFTERSALES" | "SUPPLIER_FINANCE" | "SUPPLIER_AUDIT";
            accountTypeName: string;
            filters: components["schemas"]["SupplierWorkspacePageFiltersDto"];
            items: components["schemas"]["SupplierWorkspaceModuleItemDto"][];
            /** @enum {string} */
            pageId: "PAGE-016" | "PAGE-017" | "PAGE-018" | "PAGE-019" | "PAGE-020" | "PAGE-021" | "PAGE-022" | "PAGE-023";
            selectedModule: components["schemas"]["SupplierWorkspaceModuleDetailDto"] | null;
            summary: components["schemas"]["SupplierWorkspacePageSummaryDto"];
            workspaceRoute: string;
        };
        SupplierWorkspacePageSummaryDto: {
            availableTotal: number;
            catalogTotal: number;
            deferredTotal: number;
            filteredTotal: number;
        };
        SupplierWorkspaceResponseDto: {
            /** @enum {string} */
            accountTypeCode: "SUPPLIER_ACCOUNT_ADMIN" | "SUPPLIER_PRODUCT" | "SUPPLIER_PRICING" | "SUPPLIER_INVENTORY" | "SUPPLIER_FULFILLMENT" | "SUPPLIER_AFTERSALES" | "SUPPLIER_FINANCE" | "SUPPLIER_AUDIT";
            accountTypeName: string;
            menuItems: components["schemas"]["SupplierWorkspaceMenuItemDto"][];
            /** @enum {string} */
            pageId: "PAGE-016" | "PAGE-017" | "PAGE-018" | "PAGE-019" | "PAGE-020" | "PAGE-021" | "PAGE-022" | "PAGE-023";
            workspaceRoute: string;
        };
        SupplyPriceChangeDto: {
            /** @enum {string} */
            approvalType: "SUPPLY_PRICE_CHANGE";
            /** Format: date-time */
            createdAt: string;
            currentApprovedSupplyPrice: number;
            /** Format: date-time */
            effectiveAt?: string | null;
            /** Format: uuid */
            id: string;
            oldSupplyPrice: number;
            productName: string;
            reason: string;
            /** Format: date-time */
            requestedEffectiveAt: string;
            requestedSupplyPrice: number;
            reviewOpinion?: string | null;
            skuCode: string;
            /** Format: uuid */
            skuId: string;
            /** @enum {string} */
            status: "SUBMITTED" | "APPROVED" | "REJECTED" | "EFFECTIVE" | "CANCELLED";
            /** Format: date-time */
            updatedAt: string;
            version: number;
        };
        SupplyPriceChangePageDto: {
            items: components["schemas"]["SupplyPriceChangeDto"][];
            total: number;
        };
        SupplyPriceChangeRequestDto: {
            /** Format: date-time */
            effectiveAt: string;
            reason: string;
            requestedSupplyPrice: number;
            secondVerificationCode: string;
            version: number;
        };
        SupplyPriceReviewHistoryItemDto: {
            /** @enum {string} */
            event: "SUBMIT" | "APPROVE" | "REJECT" | "EFFECT" | "CANCEL";
            /** @enum {string|null} */
            fromStatus?: "SUBMITTED" | "APPROVED" | "REJECTED" | "EFFECTIVE" | "CANCELLED" | null;
            /** Format: date-time */
            occurredAt: string;
            opinion?: string | null;
            /** @enum {string} */
            toStatus: "SUBMITTED" | "APPROVED" | "REJECTED" | "EFFECTIVE" | "CANCELLED";
            version: number;
        };
        SupplyPriceReviewHistoryPageDto: {
            items: components["schemas"]["SupplyPriceReviewHistoryItemDto"][];
            /** Format: uuid */
            taskId: string;
        };
        TemplateAfterSaleRulesDto: {
            evidenceRequirements: string[];
            notice: string;
            /** @enum {string} */
            returnPolicy: "CATEGORY_RESTRICTED" | "COMPANY_STANDARD" | "NON_RETURNABLE";
        };
        TemplateDetailModuleDto: {
            key: string;
            /** @enum {string} */
            kind: "AFTER_SALE" | "FIELDS" | "NOTICE" | "QUALIFICATIONS";
            sortWeight: number;
            title: string;
        };
        TemplateDetailModulesDto: {
            modules: components["schemas"]["TemplateDetailModuleDto"][];
        };
        TemplateFieldDefinitionDto: {
            detailModuleKey: string;
            enumValues: string[];
            key: string;
            label: string;
            required: boolean;
            searchable: boolean;
            specification: boolean;
            /** @enum {string} */
            type: "BOOLEAN" | "BUNDLE_ITEMS" | "DATE" | "DECIMAL" | "ENUM" | "INTEGER" | "RICH_TEXT" | "TEXT";
            unit: string | null;
            validation: components["schemas"]["TemplateValidationRuleDto"];
        };
        TemplateFieldSchemaDto: {
            fields: components["schemas"]["TemplateFieldDefinitionDto"][];
            /** @enum {string} */
            schemaVersion: "1.0";
        };
        TemplateQualificationRuleDto: {
            expiryRequired: boolean;
            key: string;
            label: string;
            objectTypes: ("IMAGE" | "PDF")[];
            required: boolean;
        };
        TemplateQualificationRulesDto: {
            rules: components["schemas"]["TemplateQualificationRuleDto"][];
        };
        TemplateSkuDimensionDto: {
            fieldKey: string;
            key: string;
            label: string;
        };
        TemplateSkuDimensionsDto: {
            dimensions: components["schemas"]["TemplateSkuDimensionDto"][];
        };
        TemplateValidationRuleDto: {
            max: number | null;
            maxLength: number | null;
            min: number | null;
            minLength: number | null;
            pattern: string | null;
        };
        WechatNotificationAcknowledgementDto: {
            /** @enum {string} */
            code: "SUCCESS";
            /** @example 成功 */
            message: string;
        };
        WechatPaymentNotificationDto: {
            id: string;
            resource: {
                [key: string]: unknown;
            };
        };
        WechatPrepayRequestDto: Record<string, never>;
        WechatPrepayResponseDto: {
            /** @description WeChat amount in integer cents */
            amount: number;
            /** @enum {string} */
            channel: "WECHAT_PAY";
            /** @enum {string} */
            checkoutMode: "COMPANY_UNIFIED";
            clientPayment: components["schemas"]["MiniappPaymentPayloadDto"];
            /** @example 江苏福礼团供应链科技有限公司 */
            collectorName: string;
            /** Format: uuid */
            orderId: string;
            outTradeNo: string;
            /** Format: uuid */
            paymentTransactionId: string;
            prepayId: string;
            /** @enum {string} */
            status: "PREPAY_CREATED";
        };
        WelfareBatchResponseDto: {
            agreementVersion: number;
            batchNo: string;
            /** @enum {string} */
            claimMode: "ENTERPRISE_ASSIGNED" | "COMPANY_ASSIGNED" | "PHYSICAL_CARD_OR_CODE";
            /** Format: date-time */
            createdAt: string;
            history: components["schemas"]["WelfareHistoryResponseDto"][];
            /** Format: uuid */
            id: string;
            issueCount: number;
            /** @enum {string} */
            status: "DRAFT";
            totalAmount: number;
            unitAmount: number;
            version: number;
        };
        WelfareHistoryResponseDto: {
            /** @enum {string} */
            event: "PROGRAM_CREATED" | "BATCH_CREATED";
            /** Format: date-time */
            occurredAt: string;
            resultingVersion: number;
        };
        WelfareProgramPageResponseDto: {
            items: components["schemas"]["WelfareProgramResponseDto"][];
            total: number;
        };
        WelfareProgramResponseDto: {
            batches: components["schemas"]["WelfareBatchResponseDto"][];
            canPayDeliveryFee: boolean;
            /** @enum {string} */
            complianceStatus: "DRAFT";
            /** Format: date-time */
            createdAt: string;
            /** @enum {string} */
            fundingType: "ENTERPRISE_GRANT" | "COMPANY_GIFT" | "PHYSICAL_CARD_OR_CODE";
            history: components["schemas"]["WelfareHistoryResponseDto"][];
            /** Format: uuid */
            id: string;
            /** @enum {string} */
            issuerType: "COMPANY";
            name: string;
            refundPolicy: string;
            scopeRules: components["schemas"]["WelfareScopeRulesDto"];
            /** @enum {string} */
            scopeType: "ALL_PRODUCTS" | "CATEGORY" | "PRODUCT" | "SKU";
            /** @enum {string} */
            status: "DRAFT";
            /** Format: date-time */
            updatedAt: string;
            version: number;
        };
        WelfareScopeRulesDto: {
            excludedIds: string[];
            includedIds: string[];
            /** @enum {number} */
            schemaVersion: 1;
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
    "refunds.createOriginalStructureRefund": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                afterSaleId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RefundCreateRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefundResponseDto"];
                };
            };
            202: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RefundResponseDto"];
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
    "sensitiveApproval.list": {
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
                    "application/json": components["schemas"]["SensitiveApprovalPageResponseDto"];
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
    "sensitiveApproval.create": {
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
                "application/json": components["schemas"]["CreateSensitiveApprovalRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SensitiveApprovalTaskResponseDto"];
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
            /** @description IDEMPOTENCY_CONFLICT */
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
            /** @description AUDIT_REQUIRED */
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
    "sensitiveApproval.claim": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ClaimSensitiveApprovalRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SensitiveApprovalTaskResponseDto"];
                };
            };
            /** @description SAME_NATURAL_PERSON_REVIEW */
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
            /** @description APPROVAL_VERSION_CONFLICT */
            409: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
            /** @description SECOND_REVIEW_REQUIRED */
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
    "sensitiveApproval.decide": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["DecideSensitiveApprovalRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SensitiveApprovalTaskResponseDto"];
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
            /** @description APPROVAL_VERSION_CONFLICT */
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
            /** @description SECOND_REVIEW_REQUIRED */
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
    "catalog.listProducts": {
        parameters: {
            query?: {
                page?: number;
                pageSize?: number;
                /** @description Reserved for a server-verified delivery region; arbitrary client scope is rejected */
                regionCode?: string;
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
                    "application/json": components["schemas"]["ConsumerCatalogPageResponseDto"];
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
    "catalog.getProductDetail": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                productId: string;
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
                    "application/json": components["schemas"]["PublicFoodProductDetailResponseDto"];
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
    "catalog.listSupplierProducts": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                supplierId: string;
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
                    "application/json": components["schemas"]["PublicProductPageResponseDto"];
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
    "companyCategories.list": {
        parameters: {
            query?: {
                status?: "ENABLED" | "DISABLED";
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
                    "application/json": components["schemas"]["CategoryTreeResponseDto"];
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
    "companyCategories.create": {
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
                "application/json": components["schemas"]["CategoryCreateRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryResponseDto"];
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
    "companyCategories.delete": {
        parameters: {
            query: {
                version: number;
            };
            header: {
                "Idempotency-Key": string;
            };
            path: {
                categoryId: string;
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
                    "application/json": components["schemas"]["CategoryDeleteResponseDto"];
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
    "companyCategories.patch": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                categoryId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryPatchRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryResponseDto"];
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
    "companyCategoryTemplates.list": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                categoryId: string;
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
                    "application/json": components["schemas"]["CategoryTemplateListResponseDto"];
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
        };
    };
    "companyCategoryTemplates.createDraft": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                categoryId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryTemplateCreateRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryTemplateResponseDto"];
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
    "companyCategoryTemplates.patchDraft": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                templateId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryTemplatePatchRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryTemplateResponseDto"];
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
    "companyCategoryTemplates.publish": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                templateId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CategoryTemplatePublishRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CategoryTemplateResponseDto"];
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
    "enterpriseRemittance.reviewProof": {
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
                "application/json": components["schemas"]["EnterpriseRemittanceReviewRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EnterpriseRemittanceResponseDto"];
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
    "companyEnterpriseRegistration.list": {
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
                    "application/json": components["schemas"]["EnterpriseRegistrationPageResponseDto"];
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
    "companyEnterpriseRegistration.review": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                enterpriseId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EnterpriseReviewRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EnterpriseRegistrationResponseDto"];
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
    "companyEnterpriseRegistration.suspend": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                enterpriseId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EnterpriseSuspendRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EnterpriseRegistrationResponseDto"];
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
        };
    };
    "companyInitialPriceReviews.list": {
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
                    "application/json": components["schemas"]["InitialPriceReviewPageDto"];
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
    "companySupplyPriceReviews.list": {
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
                    "application/json": components["schemas"]["SupplyPriceChangePageDto"];
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
    "companySupplyPriceReviews.decide": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductApprovalDecisionRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplyPriceChangeDto"];
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
    "companySupplyPriceReviews.history": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                taskId: string;
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
                    "application/json": components["schemas"]["SupplyPriceReviewHistoryPageDto"];
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
        };
    };
    "companyInitialPriceReviews.decide": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductApprovalDecisionRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductApprovalDecisionResponseDto"];
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
    "companyProductMaterialReviews.list": {
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
                    "application/json": components["schemas"]["ProductMaterialReviewPageDto"];
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
    "companyProductMaterialReviews.decide": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                taskId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["ProductApprovalDecisionRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductApprovalDecisionResponseDto"];
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
    "regulatedCategoryControls.list": {
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
                    "application/json": components["schemas"]["RegulatedCategoryControlPageDto"];
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
    "regulatedCategoryControls.disable": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                categoryId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegulatedCategoryDisableRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegulatedCategoryControlResponseDto"];
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
    "regulatedCategoryControls.enable": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                categoryId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["RegulatedCategoryEnableRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["RegulatedCategoryControlResponseDto"];
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
    "companyWelfareCard.listPrograms": {
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
                    "application/json": components["schemas"]["WelfareProgramPageResponseDto"];
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
        };
    };
    "companyWelfareCard.createProgram": {
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
                "application/json": components["schemas"]["CreateWelfareProgramRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WelfareProgramResponseDto"];
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
    "companyWelfareCard.createBatch": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                programId: unknown;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["CreateWelfareBatchRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WelfareBatchResponseDto"];
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
    "orders.createConsumerOrder": {
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
                "application/json": components["schemas"]["CreateOrderRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateBuyerOrderResponseDto"];
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
    "enterpriseCatalog.listProducts": {
        parameters: {
            query?: {
                pageSize?: number;
                page?: number;
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
                    "application/json": components["schemas"]["EnterpriseCatalogPageResponseDto"];
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
    "enterpriseCatalog.getProductDetail": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                productId: string;
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
                    "application/json": components["schemas"]["EnterpriseProductDetailResponseDto"];
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
    "orders.createEnterpriseOrder": {
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
                "application/json": components["schemas"]["CreateEnterpriseOrderRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["CreateEnterpriseOrderResponseDto"];
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
    "enterpriseRemittance.submitProof": {
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
                "application/json": components["schemas"]["EnterpriseRemittanceProofRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EnterpriseRemittanceResponseDto"];
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
    "enterpriseRegistration.create": {
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
                "application/json": components["schemas"]["EnterpriseRegistrationRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EnterpriseRegistrationCreatedResponseDto"];
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
    "enterpriseRegistration.getOwn": {
        parameters: {
            query?: never;
            header: {
                Authorization: string;
            };
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
                    "application/json": components["schemas"]["EnterpriseRegistrationResponseDto"];
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
            404: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ApiErrorResponseDto"];
                };
            };
        };
    };
    "enterpriseRegistration.patchOwn": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                Authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EnterpriseRegistrationPatchRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EnterpriseRegistrationResponseDto"];
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
    "enterpriseRegistration.submitOwn": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
                Authorization: string;
            };
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["EnterpriseSubmitReviewRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["EnterpriseRegistrationResponseDto"];
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
    "payments.createWechatPrepay": {
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
                "application/json": components["schemas"]["WechatPrepayRequestDto"];
            };
        };
        responses: {
            /** @description Idempotent replay */
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WechatPrepayResponseDto"];
                };
            };
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WechatPrepayResponseDto"];
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
    "payments.confirmWechatNotification": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["WechatPaymentNotificationDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["WechatNotificationAcknowledgementDto"];
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
    "supplierauth.login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupplierLoginRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierWorkspaceChoiceResponseDto"];
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
    "supplierauth.currentWorkspace": {
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
                    "application/json": components["schemas"]["SupplierWorkspaceResponseDto"];
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
    "supplierauth.workspacePage": {
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
                    "application/json": components["schemas"]["SupplierWorkspacePageResponseDto"];
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
    "supplierauth.selectWorkspace": {
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
                "application/json": components["schemas"]["SupplierSelectWorkspaceRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierSessionResponseDto"];
                };
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
    "supplierFulfillment.list": {
        parameters: {
            query?: {
                preparationStatus?: "PENDING" | "ACCEPTED" | "PREPARING" | "READY_FOR_HANDOVER" | "HANDED_OVER" | "COMPLETED" | "CANCELLED";
                channelType?: "CONSUMER" | "ENTERPRISE";
                pageSize?: number;
                page?: number;
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
                    "application/json": components["schemas"]["SupplierSubOrderPageResponseDto"];
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
    "supplierFulfillment.appendNode": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                subOrderId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["FulfillmentNodeRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierSubOrderResponseDto"];
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
    "supplierInventory.list": {
        parameters: {
            query?: {
                warningOnly?: boolean;
                pageSize?: number;
                page?: number;
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
                    "application/json": components["schemas"]["SupplierInventoryPageDto"];
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
    "supplierInventory.adjust": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                skuId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupplierInventoryAdjustmentRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierInventoryMutationDto"];
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
    "supplierInventory.history": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                skuId: string;
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
                    "application/json": components["schemas"]["SupplierInventoryHistoryDto"];
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
    "supplierPricing.listInitialPricingProducts": {
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
                    "application/json": components["schemas"]["SupplierInitialPricingPageDto"];
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
    "supplierPricing.submitInitialPrices": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                supplierProductId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["InitialPricesRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["InitialPricesResponseDto"];
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
    "supplierListedPricing.list": {
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
                    "application/json": components["schemas"]["ListedSkuPricePageDto"];
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
    "supplierListedPricing.patchSalePrices": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                skuId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SalePriceChangeRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SalePriceChangeResponseDto"];
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
    "supplierListedPricing.submitSupplyPriceChange": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                skuId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupplyPriceChangeRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplyPriceChangeDto"];
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
    "supplierListedPricing.listSupplyPriceChanges": {
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
                    "application/json": components["schemas"]["SupplyPriceChangePageDto"];
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
    "supplierProducts.create": {
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
                "application/json": components["schemas"]["SupplierProductDraftRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierProductResponseDto"];
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
    "supplierProducts.patch": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                supplierProductId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupplierProductPatchRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierProductResponseDto"];
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
    "supplierProducts.changeChannelVisibility": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                supplierProductId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SupplierProductChannelVisibilityRequestDto"];
            };
        };
        responses: {
            200: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["SupplierProductChannelVisibilityResponseDto"];
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
    "supplierProducts.listChannelVisibilityHistory": {
        parameters: {
            query?: never;
            header?: never;
            path: {
                supplierProductId: string;
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
                    "application/json": components["schemas"]["ProductChannelVisibilityHistoryPageDto"];
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
    "supplierProducts.submitMaterial": {
        parameters: {
            query?: never;
            header: {
                "Idempotency-Key": string;
            };
            path: {
                supplierProductId: string;
            };
            cookie?: never;
        };
        requestBody: {
            content: {
                "application/json": components["schemas"]["SubmitProductMaterialRequestDto"];
            };
        };
        responses: {
            201: {
                headers: {
                    [name: string]: unknown;
                };
                content: {
                    "application/json": components["schemas"]["ProductMaterialApprovalResponseDto"];
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
