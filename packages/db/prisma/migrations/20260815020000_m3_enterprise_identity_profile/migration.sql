-- MIG-011 / M3-P028: enterprise registration, certification and private profile ownership.
ALTER TABLE `approval_task`
  MODIFY `approval_type` ENUM('SUPPLIER_ONBOARDING','ENTERPRISE_CERTIFICATION','FUNCTIONAL_ACCOUNT_CHANGE','SENSITIVE_EXPORT','SUPPLIER_SENSITIVE_CHANGE','PRODUCT_MATERIAL','PRODUCT_INITIAL_PRICE') NOT NULL,
  MODIFY `object_type` ENUM('SUPPLIER','ENTERPRISE_CUSTOMER','FUNCTIONAL_ACCOUNT','EXPORT_JOB','SUPPLIER_PRODUCT') NOT NULL,
  MODIFY `applicant_type` ENUM('COMPANY_USER','SUPPLIER_USER','ENTERPRISE_USER') NOT NULL,
  MODIFY `reviewed_by_type` ENUM('COMPANY_USER','SUPPLIER_USER','ENTERPRISE_USER') NULL;

ALTER TABLE `approval_task_history`
  MODIFY `actor_type` ENUM('COMPANY_USER','SUPPLIER_USER','ENTERPRISE_USER') NOT NULL;

CREATE TABLE `enterprise_customer` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `legal_name` VARCHAR(191) NOT NULL,
  `credit_code` CHAR(18) NOT NULL,
  `registered_address` VARCHAR(500) NULL,
  `enterprise_type` VARCHAR(64) NULL,
  `license_object_key` VARCHAR(255) NULL,
  `license_valid_until` DATETIME(3) NULL,
  `contact_name` VARCHAR(128) NOT NULL,
  `contact_mobile` VARCHAR(16) NOT NULL,
  `contact_email` VARCHAR(254) NULL,
  `contact_title` VARCHAR(128) NULL,
  `agreement_version` VARCHAR(64) NOT NULL,
  `agreement_status` ENUM('NOT_SIGNED','ACTIVE','EXPIRED','TERMINATED') NOT NULL DEFAULT 'NOT_SIGNED',
  `status` ENUM('DRAFT','PENDING_REVIEW','CORRECTION_REQUIRED','ACTIVE','SUSPENDED','REJECTED') NOT NULL DEFAULT 'DRAFT',
  `correction_fields` JSON NOT NULL,
  `review_opinion` VARCHAR(1000) NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `submitted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `enterprise_customer_credit_code_key` (`credit_code`),
  INDEX `enterprise_customer_company_status_time_idx` (`company_id`, `status`, `created_at`),
  INDEX `enterprise_customer_mobile_status_idx` (`contact_mobile`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_customer_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_customer_version_check` CHECK (`version` >= 0),
  CONSTRAINT `enterprise_customer_credit_code_check` CHECK (CHAR_LENGTH(`credit_code`) = 18)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `enterprise_user` (
  `id` CHAR(36) NOT NULL,
  `enterprise_customer_id` CHAR(36) NOT NULL,
  `identity_id` CHAR(36) NOT NULL,
  `role` ENUM('ENTERPRISE_ADMIN','ENTERPRISE_PURCHASER') NOT NULL DEFAULT 'ENTERPRISE_ADMIN',
  `name` VARCHAR(128) NOT NULL,
  `mobile` VARCHAR(16) NOT NULL,
  `email` VARCHAR(254) NULL,
  `title` VARCHAR(128) NULL,
  `status` ENUM('INVITED','ACTIVE','SUSPENDED','DISABLED') NOT NULL DEFAULT 'INVITED',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `enterprise_user_enterprise_mobile_key` (`enterprise_customer_id`, `mobile`),
  UNIQUE INDEX `enterprise_user_enterprise_identity_key` (`enterprise_customer_id`, `identity_id`),
  INDEX `enterprise_user_identity_status_idx` (`identity_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_user_enterprise_customer_id_fkey` FOREIGN KEY (`enterprise_customer_id`) REFERENCES `enterprise_customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `enterprise_address` (
  `id` CHAR(36) NOT NULL,
  `enterprise_customer_id` CHAR(36) NOT NULL,
  `consignee` VARCHAR(128) NOT NULL,
  `mobile` VARCHAR(16) NOT NULL,
  `region` VARCHAR(64) NOT NULL,
  `full_address` VARCHAR(500) NOT NULL,
  `delivery_note` VARCHAR(500) NULL,
  `lat` DECIMAL(10,7) NULL,
  `lng` DECIMAL(10,7) NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT false,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `enterprise_address_enterprise_default_idx` (`enterprise_customer_id`, `is_default`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_address_enterprise_customer_id_fkey` FOREIGN KEY (`enterprise_customer_id`) REFERENCES `enterprise_customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_address_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `enterprise_invoice_profile` (
  `id` CHAR(36) NOT NULL,
  `enterprise_customer_id` CHAR(36) NOT NULL,
  `title` VARCHAR(191) NOT NULL,
  `tax_number` VARCHAR(32) NOT NULL,
  `registered_address` VARCHAR(500) NULL,
  `registered_phone` VARCHAR(32) NULL,
  `bank_name` VARCHAR(191) NULL,
  `bank_account_masked` VARCHAR(64) NULL,
  `is_default` BOOLEAN NOT NULL DEFAULT true,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  INDEX `enterprise_invoice_enterprise_default_idx` (`enterprise_customer_id`, `is_default`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_invoice_enterprise_customer_id_fkey` FOREIGN KEY (`enterprise_customer_id`) REFERENCES `enterprise_customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_invoice_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `enterprise_customer_status_history` (
  `id` CHAR(36) NOT NULL,
  `enterprise_id` CHAR(36) NOT NULL,
  `from_status` ENUM('DRAFT','PENDING_REVIEW','CORRECTION_REQUIRED','ACTIVE','SUSPENDED','REJECTED') NULL,
  `to_status` ENUM('DRAFT','PENDING_REVIEW','CORRECTION_REQUIRED','ACTIVE','SUSPENDED','REJECTED') NOT NULL,
  `event` ENUM('CREATE','SUBMIT_CERTIFICATION','REQUEST_CORRECTION','RESUBMIT','APPROVE','REJECT','SUSPEND') NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `version` INTEGER NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `enterprise_status_history_enterprise_version_key` (`enterprise_id`, `version`),
  INDEX `enterprise_status_history_enterprise_time_idx` (`enterprise_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_status_history_enterprise_id_fkey` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprise_customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_status_history_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `enterprise_certification_snapshot` (
  `id` CHAR(36) NOT NULL,
  `enterprise_id` CHAR(36) NOT NULL,
  `event` VARCHAR(64) NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `payload` JSON NOT NULL,
  `version` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `enterprise_cert_snapshot_enterprise_version_key` (`enterprise_id`, `version`),
  INDEX `enterprise_cert_snapshot_enterprise_time_idx` (`enterprise_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_cert_snapshot_enterprise_id_fkey` FOREIGN KEY (`enterprise_id`) REFERENCES `enterprise_customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_cert_snapshot_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `enterprise_procurement_profile` (
  `id` CHAR(36) NOT NULL,
  `enterprise_customer_id` CHAR(36) NOT NULL,
  `default_invoice_profile_id` CHAR(36) NULL,
  `default_address_id` CHAR(36) NULL,
  `status` ENUM('DRAFT','ACTIVE','SUSPENDED') NOT NULL DEFAULT 'DRAFT',
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `enterprise_procurement_profile_enterprise_customer_id_key` (`enterprise_customer_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_procurement_profile_enterprise_customer_id_fkey` FOREIGN KEY (`enterprise_customer_id`) REFERENCES `enterprise_customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_procurement_profile_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `enterprise_onboarding_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(191) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `enterprise_onboarding_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `enterprise_status_history_immutable_update`
BEFORE UPDATE ON `enterprise_customer_status_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_STATUS_HISTORY_IMMUTABLE';
CREATE TRIGGER `enterprise_status_history_immutable_delete`
BEFORE DELETE ON `enterprise_customer_status_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_STATUS_HISTORY_IMMUTABLE';
CREATE TRIGGER `enterprise_cert_snapshot_immutable_update`
BEFORE UPDATE ON `enterprise_certification_snapshot`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_CERTIFICATION_SNAPSHOT_IMMUTABLE';
CREATE TRIGGER `enterprise_cert_snapshot_immutable_delete`
BEFORE DELETE ON `enterprise_certification_snapshot`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_CERTIFICATION_SNAPSHOT_IMMUTABLE';
CREATE TRIGGER `enterprise_onboarding_command_immutable_update`
BEFORE UPDATE ON `enterprise_onboarding_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_ONBOARDING_COMMAND_IMMUTABLE';
CREATE TRIGGER `enterprise_onboarding_command_immutable_delete`
BEFORE DELETE ON `enterprise_onboarding_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_ONBOARDING_COMMAND_IMMUTABLE';
