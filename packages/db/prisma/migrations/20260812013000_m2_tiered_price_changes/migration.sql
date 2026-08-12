-- MIG-013 / M2-P019: approved supply-price changes and approval-free sale-price versions.
CREATE TABLE `supply_price_change_request` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `sku_id` CHAR(36) NOT NULL,
  `old_supply_price` INTEGER NOT NULL,
  `requested_supply_price` INTEGER NOT NULL,
  `base_supply_price_version` INTEGER NOT NULL,
  `requested_effective_at` DATETIME(3) NOT NULL,
  `status` ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'EFFECTIVE', 'CANCELLED') NOT NULL DEFAULT 'SUBMITTED',
  `reason` VARCHAR(1000) NOT NULL,
  `applicant_identity_id` CHAR(36) NOT NULL,
  `applicant_functional_account_id` CHAR(36) NOT NULL,
  `reviewer_identity_id` CHAR(36) NULL,
  `reviewer_functional_account_id` CHAR(36) NULL,
  `review_opinion` VARCHAR(1000) NULL,
  `reviewed_at` DATETIME(3) NULL,
  `effective_at` DATETIME(3) NULL,
  `version` INTEGER NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  INDEX `supply_price_change_company_status_time_idx` (`company_id`, `status`, `created_at`),
  INDEX `supply_price_change_supplier_status_time_idx` (`supplier_id`, `status`, `created_at`),
  INDEX `supply_price_change_sku_status_time_idx` (`sku_id`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supply_price_change_request_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `supply_price_change_request_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `supply_price_change_request_sku_id_fkey`
    FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `supply_price_change_price_check`
    CHECK (`old_supply_price` >= 0 AND `requested_supply_price` >= 0 AND `base_supply_price_version` >= 0),
  CONSTRAINT `supply_price_change_version_check` CHECK (`version` >= 1),
  CONSTRAINT `supply_price_change_review_check` CHECK (
    (`status` = 'SUBMITTED' AND `reviewer_identity_id` IS NULL AND `reviewed_at` IS NULL AND `effective_at` IS NULL)
    OR (`status` = 'APPROVED' AND `reviewer_identity_id` IS NOT NULL AND `reviewed_at` IS NOT NULL AND `effective_at` IS NULL)
    OR (`status` = 'REJECTED' AND `reviewer_identity_id` IS NOT NULL AND `reviewed_at` IS NOT NULL AND `effective_at` IS NULL)
    OR (`status` = 'EFFECTIVE' AND `reviewer_identity_id` IS NOT NULL AND `reviewed_at` IS NOT NULL AND `effective_at` IS NOT NULL)
    OR (`status` = 'CANCELLED' AND `effective_at` IS NULL)
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supply_price_change_history` (
  `id` CHAR(36) NOT NULL,
  `request_id` CHAR(36) NOT NULL,
  `event` ENUM('SUBMIT', 'APPROVE', 'REJECT', 'EFFECT', 'CANCEL') NOT NULL,
  `from_status` ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'EFFECTIVE', 'CANCELLED') NULL,
  `to_status` ENUM('SUBMITTED', 'APPROVED', 'REJECTED', 'EFFECTIVE', 'CANCELLED') NOT NULL,
  `version` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `supply_price_change_history_request_version_key` (`request_id`, `version`),
  INDEX `supply_price_change_history_request_time_idx` (`request_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supply_price_change_history_request_id_fkey`
    FOREIGN KEY (`request_id`) REFERENCES `supply_price_change_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `supply_price_change_history_version_check` CHECK (`version` >= 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `price_change_log` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `sku_id` CHAR(36) NOT NULL,
  `supply_price_change_request_id` CHAR(36) NULL,
  `price_type` ENUM('SUPPLY', 'RETAIL', 'ENTERPRISE') NOT NULL,
  `old_price` INTEGER NOT NULL,
  `new_price` INTEGER NOT NULL,
  `old_version` INTEGER NOT NULL,
  `new_version` INTEGER NOT NULL,
  `effective_at` DATETIME(3) NOT NULL,
  `changed_by_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `change_reason` VARCHAR(1000) NOT NULL,
  `review_status` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL,
  `risk_warning` VARCHAR(1000) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `price_change_log_sku_type_version_key` (`sku_id`, `price_type`, `new_version`),
  INDEX `price_change_log_company_effective_idx` (`company_id`, `effective_at`),
  INDEX `price_change_log_supplier_effective_idx` (`supplier_id`, `effective_at`),
  INDEX `price_change_log_sku_effective_idx` (`sku_id`, `effective_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `price_change_log_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `price_change_log_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `price_change_log_sku_id_fkey`
    FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `price_change_log_supply_price_change_request_id_fkey`
    FOREIGN KEY (`supply_price_change_request_id`) REFERENCES `supply_price_change_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `price_change_log_price_check`
    CHECK (`old_price` >= 0 AND `new_price` >= 0 AND `old_version` >= 0 AND `new_version` = `old_version` + 1)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `price_effect_outbox` (
  `id` CHAR(36) NOT NULL,
  `business_key` VARCHAR(191) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `sku_id` CHAR(36) NOT NULL,
  `supply_price_change_request_id` CHAR(36) NULL,
  `price_type` ENUM('SUPPLY', 'RETAIL', 'ENTERPRISE') NOT NULL,
  `target_price` INTEGER NOT NULL,
  `expected_version` INTEGER NOT NULL,
  `change_reason` VARCHAR(1000) NOT NULL,
  `changed_by_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `review_status` ENUM('NOT_REQUIRED', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL,
  `effective_at` DATETIME(3) NOT NULL,
  `status` ENUM('PENDING', 'EFFECTIVE', 'FAILED') NOT NULL DEFAULT 'PENDING',
  `attempts` INTEGER NOT NULL DEFAULT 0,
  `last_error_code` VARCHAR(128) NULL,
  `processed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `price_effect_outbox_business_key` (`business_key`),
  INDEX `price_effect_outbox_status_effective_idx` (`status`, `effective_at`),
  INDEX `price_effect_outbox_sku_type_status_idx` (`sku_id`, `price_type`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `price_effect_outbox_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `price_effect_outbox_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `price_effect_outbox_sku_id_fkey`
    FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `price_effect_outbox_supply_price_change_request_id_fkey`
    FOREIGN KEY (`supply_price_change_request_id`) REFERENCES `supply_price_change_request`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `price_effect_outbox_value_check`
    CHECK (`target_price` >= 0 AND `expected_version` >= 0 AND `attempts` >= 0),
  CONSTRAINT `price_effect_outbox_state_check` CHECK (
    (`status` = 'PENDING' AND `processed_at` IS NULL)
    OR (`status` IN ('EFFECTIVE', 'FAILED') AND `processed_at` IS NOT NULL)
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `price_change_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(191) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `price_change_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `supply_price_change_request_update_guard`
BEFORE UPDATE ON `supply_price_change_request`
FOR EACH ROW
BEGIN
  IF NEW.`id` <> OLD.`id`
    OR NEW.`company_id` <> OLD.`company_id`
    OR NEW.`supplier_id` <> OLD.`supplier_id`
    OR NEW.`sku_id` <> OLD.`sku_id`
    OR NEW.`old_supply_price` <> OLD.`old_supply_price`
    OR NEW.`requested_supply_price` <> OLD.`requested_supply_price`
    OR NEW.`base_supply_price_version` <> OLD.`base_supply_price_version`
    OR NEW.`requested_effective_at` <> OLD.`requested_effective_at`
    OR NEW.`reason` <> OLD.`reason`
    OR NEW.`applicant_identity_id` <> OLD.`applicant_identity_id`
    OR NEW.`applicant_functional_account_id` <> OLD.`applicant_functional_account_id`
    OR NEW.`created_at` <> OLD.`created_at`
    OR NEW.`version` <> OLD.`version` + 1
    OR NOT (
      (OLD.`status` = 'SUBMITTED' AND NEW.`status` IN ('APPROVED', 'REJECTED', 'CANCELLED'))
      OR (OLD.`status` = 'APPROVED' AND NEW.`status` = 'EFFECTIVE')
    ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUPPLY_PRICE_CHANGE_IMMUTABLE';
  END IF;
END;

CREATE TRIGGER `supply_price_change_request_delete_guard`
BEFORE DELETE ON `supply_price_change_request`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUPPLY_PRICE_CHANGE_IMMUTABLE';

CREATE TRIGGER `supply_price_change_history_update_guard`
BEFORE UPDATE ON `supply_price_change_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUPPLY_PRICE_CHANGE_HISTORY_IMMUTABLE';

CREATE TRIGGER `supply_price_change_history_delete_guard`
BEFORE DELETE ON `supply_price_change_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'SUPPLY_PRICE_CHANGE_HISTORY_IMMUTABLE';

CREATE TRIGGER `price_change_log_update_guard`
BEFORE UPDATE ON `price_change_log`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PRICE_CHANGE_LOG_IMMUTABLE';

CREATE TRIGGER `price_change_log_delete_guard`
BEFORE DELETE ON `price_change_log`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PRICE_CHANGE_LOG_IMMUTABLE';

CREATE TRIGGER `price_effect_outbox_delete_guard`
BEFORE DELETE ON `price_effect_outbox`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PRICE_EFFECT_OUTBOX_IMMUTABLE';

CREATE TRIGGER `price_change_command_update_guard`
BEFORE UPDATE ON `price_change_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PRICE_CHANGE_COMMAND_IMMUTABLE';

CREATE TRIGGER `price_change_command_delete_guard`
BEFORE DELETE ON `price_change_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PRICE_CHANGE_COMMAND_IMMUTABLE';
