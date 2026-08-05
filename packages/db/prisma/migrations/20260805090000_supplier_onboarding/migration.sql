-- MIG-004 (M1-P003 slice): supplier onboarding, review and append-only state evidence.
CREATE TABLE `supplier` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `legal_name` VARCHAR(128) NOT NULL,
  `credit_code` CHAR(18) NOT NULL,
  `status` ENUM('DRAFT', 'PENDING_REVIEW', 'CORRECTION_REQUIRED', 'ACTIVE', 'SUSPENDED', 'EXITING', 'EXITED') NOT NULL DEFAULT 'DRAFT',
  `pickup_address` VARCHAR(500) NULL,
  `pickup_lat` DECIMAL(10, 7) NULL,
  `pickup_lng` DECIMAL(10, 7) NULL,
  `settlement_account_masked` VARCHAR(128) NULL,
  `qualification_snapshot` JSON NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `submitted_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `supplier_credit_code_key`(`credit_code`),
  INDEX `supplier_company_id_status_idx`(`company_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `approval_task` (
  `id` CHAR(36) NOT NULL,
  `approval_type` ENUM('SUPPLIER_ONBOARDING', 'FUNCTIONAL_ACCOUNT_CHANGE', 'SENSITIVE_EXPORT', 'SUPPLIER_SENSITIVE_CHANGE') NOT NULL,
  `object_type` ENUM('SUPPLIER', 'FUNCTIONAL_ACCOUNT', 'EXPORT_JOB') NOT NULL,
  `object_id` CHAR(36) NOT NULL,
  `applicant_type` ENUM('COMPANY_USER', 'SUPPLIER_USER') NOT NULL,
  `applicant_id` CHAR(36) NOT NULL,
  `status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
  `assigned_account_type_code` ENUM('COMPANY_SUPPLIER_OPS', 'COMPANY_SUPER_ADMIN', 'COMPANY_AUDIT', 'SUPPLIER_ACCOUNT_ADMIN') NOT NULL,
  `reviewed_by` CHAR(36) NULL,
  `review_opinion` VARCHAR(1000) NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `approval_task_object_status_idx`(`object_type`, `object_id`, `status`),
  INDEX `approval_task_assignee_status_idx`(`assigned_account_type_code`, `status`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_status_history` (
  `id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `from_status` ENUM('DRAFT', 'PENDING_REVIEW', 'CORRECTION_REQUIRED', 'ACTIVE', 'SUSPENDED', 'EXITING', 'EXITED') NULL,
  `to_status` ENUM('DRAFT', 'PENDING_REVIEW', 'CORRECTION_REQUIRED', 'ACTIVE', 'SUSPENDED', 'EXITING', 'EXITED') NOT NULL,
  `event` ENUM('REGISTER', 'SUBMIT', 'REQUEST_CORRECTION', 'RESUBMIT', 'APPROVE', 'SUSPEND', 'START_EXIT', 'COMPLETE_EXIT') NOT NULL,
  `actor_identity_id` CHAR(36) NULL,
  `version` INTEGER NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `supplier_status_history_supplier_version_key`(`supplier_id`, `version`),
  INDEX `supplier_status_history_supplier_time_idx`(`supplier_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_status_history_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_onboarding_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(128) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `supplier_onboarding_command_scope_key`(`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
