CREATE TABLE `welfare_card_code` (
  `id` CHAR(36) NOT NULL,
  `batch_id` CHAR(36) NOT NULL,
  `card_no` VARCHAR(191) NOT NULL,
  `secret_hash` VARCHAR(191) NOT NULL,
  `amount` INTEGER NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'UNCLAIMED',
  `claimed_by_consumer_user_id` CHAR(36) NULL,
  `claimed_at` DATETIME(3) NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `welfare_card_code_amount_check` CHECK (`amount` > 0),
  CONSTRAINT `welfare_card_code_status_check` CHECK (`status` IN ('UNCLAIMED', 'CLAIMED', 'DISABLED', 'EXPIRED')),
  CONSTRAINT `welfare_card_code_claim_check` CHECK (
    (`status` = 'CLAIMED' AND `claimed_by_consumer_user_id` IS NOT NULL AND `claimed_at` IS NOT NULL)
    OR (`status` <> 'CLAIMED' AND `claimed_by_consumer_user_id` IS NULL AND `claimed_at` IS NULL)
  ),
  UNIQUE INDEX `welfare_card_code_card_no_key` (`card_no`),
  INDEX `welfare_card_code_batch_status_time_idx` (`batch_id`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_code_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `welfare_card_batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_account` (
  `id` CHAR(36) NOT NULL,
  `consumer_user_id` CHAR(36) NOT NULL,
  `program_id` CHAR(36) NOT NULL,
  `batch_id` CHAR(36) NOT NULL,
  `card_code_id` CHAR(36) NOT NULL,
  `balance_amount` INTEGER NOT NULL,
  `frozen_amount` INTEGER NOT NULL DEFAULT 0,
  `status` VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  CONSTRAINT `welfare_card_account_amount_check` CHECK (`balance_amount` >= 0 AND `frozen_amount` >= 0 AND `frozen_amount` <= `balance_amount`),
  CONSTRAINT `welfare_card_account_status_check` CHECK (`status` IN ('ACTIVE', 'SUSPENDED', 'EXPIRED', 'CLOSED')),
  UNIQUE INDEX `welfare_card_account_card_code_id_key` (`card_code_id`),
  INDEX `welfare_card_account_consumer_status_time_idx` (`consumer_user_id`, `status`, `created_at`),
  INDEX `welfare_card_account_program_status_idx` (`program_id`, `status`),
  INDEX `welfare_card_account_batch_status_idx` (`batch_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_account_program_id_fkey` FOREIGN KEY (`program_id`) REFERENCES `welfare_card_program`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_account_batch_id_fkey` FOREIGN KEY (`batch_id`) REFERENCES `welfare_card_batch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_account_card_code_id_fkey` FOREIGN KEY (`card_code_id`) REFERENCES `welfare_card_code`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_ledger` (
  `id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NULL,
  `refund_id` CHAR(36) NULL,
  `business_type` VARCHAR(32) NOT NULL,
  `direction` VARCHAR(16) NOT NULL,
  `amount` INTEGER NOT NULL,
  `before_balance` INTEGER NOT NULL,
  `after_balance` INTEGER NOT NULL,
  `before_frozen` INTEGER NOT NULL,
  `after_frozen` INTEGER NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `welfare_card_ledger_claim_check` CHECK (
    `business_type` = 'CLAIM' AND `direction` = 'CREDIT' AND `amount` > 0
    AND `order_id` IS NULL AND `refund_id` IS NULL
    AND `before_balance` = 0 AND `after_balance` = `amount`
    AND `before_frozen` = 0 AND `after_frozen` = 0
  ),
  UNIQUE INDEX `welfare_card_ledger_account_key` (`account_id`, `idempotency_key`),
  INDEX `welfare_card_ledger_account_time_idx` (`account_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_ledger_account_id_fkey` FOREIGN KEY (`account_id`) REFERENCES `welfare_card_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_binding_command` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `consumer_user_id` CHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `request_id` VARCHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `welfare_card_binding_command_owner_key` (`company_id`, `consumer_user_id`, `idempotency_key`),
  INDEX `welfare_card_binding_command_request_idx` (`request_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_binding_command_company_id_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `welfare_card_account_create_guard`
BEFORE INSERT ON `welfare_card_account`
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM `welfare_card_code` c
    JOIN `welfare_card_batch` b ON b.`id` = c.`batch_id`
    WHERE c.`id` = NEW.`card_code_id`
      AND c.`status` = 'CLAIMED'
      AND c.`claimed_by_consumer_user_id` = NEW.`consumer_user_id`
      AND c.`amount` = NEW.`balance_amount`
      AND c.`batch_id` = NEW.`batch_id`
      AND b.`program_id` = NEW.`program_id`
      AND NEW.`frozen_amount` = 0
      AND NEW.`status` = 'ACTIVE'
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_ACCOUNT_SOURCE_INVALID';
  END IF;
END;

CREATE TRIGGER `welfare_card_claim_ledger_guard`
BEFORE INSERT ON `welfare_card_ledger`
FOR EACH ROW
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM `welfare_card_account` a
    WHERE a.`id` = NEW.`account_id`
      AND a.`balance_amount` = NEW.`after_balance`
      AND a.`frozen_amount` = NEW.`after_frozen`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_LEDGER_BALANCE_INVALID';
  END IF;
END;

CREATE TRIGGER `welfare_card_ledger_no_update` BEFORE UPDATE ON `welfare_card_ledger`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_LEDGER_IMMUTABLE';
CREATE TRIGGER `welfare_card_ledger_no_delete` BEFORE DELETE ON `welfare_card_ledger`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_LEDGER_IMMUTABLE';
CREATE TRIGGER `welfare_card_binding_command_no_update` BEFORE UPDATE ON `welfare_card_binding_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_BINDING_COMMAND_IMMUTABLE';
CREATE TRIGGER `welfare_card_binding_command_no_delete` BEFORE DELETE ON `welfare_card_binding_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_BINDING_COMMAND_IMMUTABLE';
