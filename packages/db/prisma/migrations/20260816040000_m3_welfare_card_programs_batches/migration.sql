CREATE TABLE `welfare_card_program` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(191) NOT NULL,
  `funding_type` VARCHAR(32) NOT NULL,
  `issuer_type` VARCHAR(16) NOT NULL DEFAULT 'COMPANY',
  `scope_type` VARCHAR(32) NOT NULL,
  `scope_rules` JSON NOT NULL,
  `can_pay_delivery_fee` BOOLEAN NOT NULL DEFAULT FALSE,
  `refund_policy` VARCHAR(500) NOT NULL,
  `compliance_status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_by_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  CONSTRAINT `welfare_card_program_funding_check` CHECK (`funding_type` IN ('ENTERPRISE_GRANT', 'COMPANY_GIFT', 'PHYSICAL_CARD_OR_CODE')),
  CONSTRAINT `welfare_card_program_issuer_check` CHECK (`issuer_type` = 'COMPANY'),
  CONSTRAINT `welfare_card_program_status_check` CHECK (`status` IN ('DRAFT', 'ACTIVE', 'SUSPENDED', 'EXPIRED', 'CLOSED')),
  CONSTRAINT `welfare_card_program_compliance_check` CHECK (`compliance_status` IN ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED')),
  UNIQUE INDEX `welfare_card_program_company_name_key` (`company_id`, `name`),
  INDEX `welfare_card_program_company_status_time_idx` (`company_id`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_program_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_program_functional_account_id_fkey` FOREIGN KEY (`functional_account_id`) REFERENCES `functional_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_batch` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `program_id` CHAR(36) NOT NULL,
  `enterprise_customer_id` CHAR(36) NULL,
  `batch_no` VARCHAR(64) NOT NULL,
  `total_amount` INTEGER NOT NULL,
  `unit_amount` INTEGER NOT NULL,
  `issue_count` INTEGER NOT NULL,
  `claim_mode` VARCHAR(32) NOT NULL,
  `agreement_version` INTEGER NOT NULL,
  `status` VARCHAR(32) NOT NULL DEFAULT 'DRAFT',
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_by_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `welfare_card_batch_amount_check` CHECK (`unit_amount` > 0 AND `issue_count` > 0 AND `unit_amount` * `issue_count` = `total_amount`),
  CONSTRAINT `welfare_card_batch_status_check` CHECK (`status` IN ('DRAFT', 'ISSUED', 'SUSPENDED', 'EXPIRED', 'CLOSED')),
  CONSTRAINT `welfare_card_batch_claim_mode_check` CHECK (`claim_mode` IN ('ENTERPRISE_ASSIGNED', 'COMPANY_ASSIGNED', 'PHYSICAL_CARD_OR_CODE')),
  UNIQUE INDEX `welfare_card_batch_company_batch_no_key` (`company_id`, `batch_no`),
  INDEX `welfare_card_batch_program_status_time_idx` (`program_id`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_batch_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_batch_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `welfare_card_program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_batch_enterprise_customer_id_fkey` FOREIGN KEY (`enterprise_customer_id`) REFERENCES `enterprise_customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_batch_functional_account_id_fkey` FOREIGN KEY (`functional_account_id`) REFERENCES `functional_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_program_history` (
  `id` CHAR(36) NOT NULL, `program_id` CHAR(36) NOT NULL, `event` VARCHAR(64) NOT NULL,
  `snapshot` JSON NOT NULL, `resulting_version` INTEGER NOT NULL, `actor_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL, `request_id` VARCHAR(64) NOT NULL, `ip` VARCHAR(64) NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `welfare_card_program_history_program_time_idx` (`program_id`, `occurred_at`), PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_program_history_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `welfare_card_program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_batch_history` (
  `id` CHAR(36) NOT NULL, `batch_id` CHAR(36) NOT NULL, `event` VARCHAR(64) NOT NULL,
  `snapshot` JSON NOT NULL, `resulting_version` INTEGER NOT NULL, `actor_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL, `request_id` VARCHAR(64) NOT NULL, `ip` VARCHAR(64) NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `welfare_card_batch_history_batch_time_idx` (`batch_id`, `occurred_at`), PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_batch_history_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `welfare_card_batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_command` (
  `id` CHAR(36) NOT NULL, `company_id` CHAR(36) NOT NULL, `operation` VARCHAR(32) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL, `request_hash` CHAR(64) NOT NULL, `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `welfare_card_command_company_key` (`company_id`, `idempotency_key`), PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_command_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `welfare_card_batch_create_guard`
BEFORE INSERT ON `welfare_card_batch`
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM `welfare_card_program` p
    WHERE p.`id` = NEW.`program_id`
      AND p.`company_id` = NEW.`company_id`
      AND p.`status` = 'DRAFT'
      AND (
        (p.`funding_type` = 'ENTERPRISE_GRANT'
          AND NEW.`claim_mode` = 'ENTERPRISE_ASSIGNED'
          AND NEW.`enterprise_customer_id` IS NOT NULL
          AND EXISTS (
            SELECT 1 FROM `enterprise_customer` e
            WHERE e.`id` = NEW.`enterprise_customer_id`
              AND e.`company_id` = NEW.`company_id`
              AND e.`status` = 'ACTIVE'
          ))
        OR (p.`funding_type` = 'COMPANY_GIFT'
          AND NEW.`claim_mode` = 'COMPANY_ASSIGNED'
          AND NEW.`enterprise_customer_id` IS NULL)
        OR (p.`funding_type` = 'PHYSICAL_CARD_OR_CODE'
          AND NEW.`claim_mode` = 'PHYSICAL_CARD_OR_CODE'
          AND NEW.`enterprise_customer_id` IS NULL)
      )
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_BATCH_PROGRAM_INVALID';
  END IF;
END;

CREATE TRIGGER `welfare_card_program_history_no_update` BEFORE UPDATE ON `welfare_card_program_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_HISTORY_IMMUTABLE';
CREATE TRIGGER `welfare_card_program_history_no_delete` BEFORE DELETE ON `welfare_card_program_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_HISTORY_IMMUTABLE';
CREATE TRIGGER `welfare_card_batch_history_no_update` BEFORE UPDATE ON `welfare_card_batch_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_HISTORY_IMMUTABLE';
CREATE TRIGGER `welfare_card_batch_history_no_delete` BEFORE DELETE ON `welfare_card_batch_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_HISTORY_IMMUTABLE';
