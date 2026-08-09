-- MIG-006 / M2-P006: supplier submissions stay upstream until company material and initial-price approval.
ALTER TABLE `approval_task`
  MODIFY `approval_type` ENUM('SUPPLIER_ONBOARDING', 'FUNCTIONAL_ACCOUNT_CHANGE', 'SENSITIVE_EXPORT', 'SUPPLIER_SENSITIVE_CHANGE', 'PRODUCT_MATERIAL') NOT NULL,
  MODIFY `object_type` ENUM('SUPPLIER', 'FUNCTIONAL_ACCOUNT', 'EXPORT_JOB', 'SUPPLIER_PRODUCT') NOT NULL,
  MODIFY `assigned_account_type_code` ENUM('COMPANY_SUPPLIER_OPS', 'COMPANY_SUPER_ADMIN', 'COMPANY_AUDIT', 'SUPPLIER_ACCOUNT_ADMIN', 'COMPANY_PRODUCT_OPS') NOT NULL;

CREATE TABLE `supplier_product` (
  `id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `template_version` INTEGER NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `brand` VARCHAR(120) NULL,
  `attributes` JSON NOT NULL,
  `qualification_snapshot` JSON NOT NULL,
  `is_retail_enabled` BOOLEAN NOT NULL,
  `is_enterprise_procurement_enabled` BOOLEAN NOT NULL,
  `enterprise_min_order_qty` INTEGER NOT NULL,
  `enterprise_package_multiple` INTEGER NOT NULL,
  `preparation_minutes` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'PENDING_MATERIAL_REVIEW', 'CORRECTION_REQUIRED', 'MATERIAL_APPROVED', 'ACTIVE', 'OFF_SHELF', 'REJECTED', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `version` INTEGER NOT NULL DEFAULT 0,
  `submitted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `supplier_product_supplier_name_key` (`supplier_id`, `name`),
  INDEX `supplier_product_supplier_status_idx` (`supplier_id`, `status`),
  INDEX `supplier_product_category_template_status_idx` (`category_id`, `template_version`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_product_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_product_sku` (
  `id` CHAR(36) NOT NULL,
  `supplier_product_id` CHAR(36) NOT NULL,
  `supplier_sku_code` VARCHAR(64) NOT NULL,
  `attributes` JSON NOT NULL,
  `requested_supply_price` INTEGER NULL,
  `requested_retail_sale_price` INTEGER NULL,
  `requested_enterprise_sale_price` INTEGER NULL,
  `initial_stock` INTEGER NOT NULL,
  `status` ENUM('DRAFT', 'ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'DRAFT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `supplier_product_sku_product_code_key` (`supplier_product_id`, `supplier_sku_code`),
  INDEX `supplier_product_sku_product_status_idx` (`supplier_product_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_product_sku_product_id_fkey`
    FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_product`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_product_status_history` (
  `id` CHAR(36) NOT NULL,
  `supplier_product_id` CHAR(36) NOT NULL,
  `from_status` ENUM('DRAFT', 'PENDING_MATERIAL_REVIEW', 'CORRECTION_REQUIRED', 'MATERIAL_APPROVED', 'ACTIVE', 'OFF_SHELF', 'REJECTED', 'ARCHIVED') NULL,
  `to_status` ENUM('DRAFT', 'PENDING_MATERIAL_REVIEW', 'CORRECTION_REQUIRED', 'MATERIAL_APPROVED', 'ACTIVE', 'OFF_SHELF', 'REJECTED', 'ARCHIVED') NOT NULL,
  `event` ENUM('CREATE', 'UPDATE', 'SUBMIT_MATERIAL', 'APPROVE_MATERIAL', 'ACTIVATE', 'OFF_SHELF', 'ARCHIVE') NOT NULL,
  `actor_identity_id` CHAR(36) NULL,
  `functional_account_id` CHAR(36) NULL,
  `version` INTEGER NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `supplier_product_history_product_version_key` (`supplier_product_id`, `version`),
  INDEX `supplier_product_history_product_time_idx` (`supplier_product_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_product_history_product_id_fkey`
    FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_product`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_product_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(128) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `supplier_product_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `product` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `supplier_product_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `template_version` INTEGER NOT NULL,
  `name` VARCHAR(200) NOT NULL,
  `sale_status` ENUM('ACTIVE', 'OFF_SHELF', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `is_retail_enabled` BOOLEAN NOT NULL,
  `is_enterprise_procurement_enabled` BOOLEAN NOT NULL,
  `detail_snapshot` JSON NOT NULL,
  `after_sale_snapshot` JSON NOT NULL,
  `delivery_rule_id` CHAR(36) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `product_supplier_product_key` (`supplier_product_id`),
  INDEX `product_company_status_idx` (`company_id`, `sale_status`),
  INDEX `product_supplier_status_idx` (`supplier_id`, `sale_status`),
  INDEX `product_category_template_status_idx` (`category_id`, `template_version`, `sale_status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `product_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_supplier_product_id_fkey`
    FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_product`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `sku` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `supplier_product_sku_id` CHAR(36) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `approved_supply_price` INTEGER NOT NULL,
  `current_retail_sale_price` INTEGER NOT NULL,
  `current_enterprise_sale_price` INTEGER NOT NULL,
  `supply_price_version` INTEGER NOT NULL,
  `retail_price_version` INTEGER NOT NULL,
  `enterprise_price_version` INTEGER NOT NULL,
  `status` ENUM('ACTIVE', 'INACTIVE', 'ARCHIVED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `sku_supplier_product_sku_key` (`supplier_product_sku_id`),
  UNIQUE INDEX `sku_code_key` (`code`),
  INDEX `sku_product_status_idx` (`product_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `sku_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `product`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `sku_supplier_product_sku_id_fkey`
    FOREIGN KEY (`supplier_product_sku_id`) REFERENCES `supplier_product_sku`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `supplier_product_status_history_immutable_update`
BEFORE UPDATE ON `supplier_product_status_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUPPLIER_PRODUCT_HISTORY_IMMUTABLE';

CREATE TRIGGER `supplier_product_status_history_immutable_delete`
BEFORE DELETE ON `supplier_product_status_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUPPLIER_PRODUCT_HISTORY_IMMUTABLE';
