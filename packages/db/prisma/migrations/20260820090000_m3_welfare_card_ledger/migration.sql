CREATE TABLE `welfare_card_adjustment` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `business_type` VARCHAR(32) NOT NULL,
  `direction` VARCHAR(16) NOT NULL,
  `amount` INTEGER NOT NULL,
  `reversal_of_ledger_id` CHAR(36) NULL,
  `reason` VARCHAR(500) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  `version` INTEGER NOT NULL DEFAULT 0,
  `applicant_identity_id` CHAR(36) NOT NULL,
  `applicant_functional_account_id` CHAR(36) NOT NULL,
  `reviewer_identity_id` CHAR(36) NULL,
  `reviewer_functional_account_id` CHAR(36) NULL,
  `review_opinion` VARCHAR(1000) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  CONSTRAINT `welfare_card_adjustment_type_check` CHECK (
    (`business_type` = 'ADJUSTMENT' AND `reversal_of_ledger_id` IS NULL)
    OR (`business_type` = 'REVERSAL' AND `reversal_of_ledger_id` IS NOT NULL)
  ),
  CONSTRAINT `welfare_card_adjustment_money_check` CHECK (`direction` IN ('CREDIT', 'DEBIT') AND `amount` > 0),
  CONSTRAINT `welfare_card_adjustment_status_check` CHECK (
    (`status` = 'PENDING' AND `version` = 0 AND `reviewer_identity_id` IS NULL AND `review_opinion` IS NULL)
    OR (`status` IN ('APPROVED', 'REJECTED') AND `version` = 1 AND `reviewer_identity_id` IS NOT NULL AND `review_opinion` IS NOT NULL)
  ),
  UNIQUE INDEX `welfare_card_adjustment_reversal_ledger_key` (`reversal_of_ledger_id`),
  INDEX `welfare_card_adjustment_company_status_time_idx` (`company_id`, `status`, `created_at`),
  INDEX `welfare_card_adjustment_account_time_idx` (`account_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_adjustment_company_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_adjustment_account_fkey` FOREIGN KEY (`account_id`) REFERENCES `welfare_card_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_adjustment_reversal_ledger_fkey` FOREIGN KEY (`reversal_of_ledger_id`) REFERENCES `welfare_card_ledger`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `welfare_card_adjustment_applicant_account_fkey` FOREIGN KEY (`applicant_functional_account_id`) REFERENCES `functional_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_adjustment_reviewer_account_fkey` FOREIGN KEY (`reviewer_functional_account_id`) REFERENCES `functional_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_adjustment_history` (
  `id` CHAR(36) NOT NULL,
  `adjustment_id` CHAR(36) NOT NULL,
  `from_status` VARCHAR(16) NULL,
  `to_status` VARCHAR(16) NOT NULL,
  `event` VARCHAR(16) NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `opinion` VARCHAR(1000) NULL,
  `version` INTEGER NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `welfare_card_adjustment_history_check` CHECK (
    (`event` = 'CREATE' AND `from_status` IS NULL AND `to_status` = 'PENDING' AND `version` = 0)
    OR (`event` = 'APPROVE' AND `from_status` = 'PENDING' AND `to_status` = 'APPROVED' AND `version` = 1)
    OR (`event` = 'REJECT' AND `from_status` = 'PENDING' AND `to_status` = 'REJECTED' AND `version` = 1)
  ),
  UNIQUE INDEX `welfare_card_adjustment_history_version_key` (`adjustment_id`, `version`),
  INDEX `welfare_card_adjustment_history_time_idx` (`adjustment_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_adjustment_history_adjustment_fkey` FOREIGN KEY (`adjustment_id`) REFERENCES `welfare_card_adjustment`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_adjustment_history_functional_account_fkey` FOREIGN KEY (`functional_account_id`) REFERENCES `functional_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `welfare_card_adjustment_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(128) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `welfare_card_adjustment_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `welfare_card_ledger`
  ADD COLUMN `sequence` INTEGER NULL AFTER `account_id`,
  ADD COLUMN `adjustment_id` CHAR(36) NULL AFTER `refund_id`;

ALTER TABLE `welfare_card_account`
  ADD COLUMN `ledger_sequence` INTEGER NULL AFTER `frozen_amount`;

CREATE TEMPORARY TABLE `welfare_card_ledger_sequence_backfill` AS
SELECT
  `id`,
  ROW_NUMBER() OVER (
    PARTITION BY `account_id`
    ORDER BY `occurred_at`, FIELD(`business_type`, 'CLAIM', 'GRANT', 'GIFT', 'FREEZE', 'RELEASE', 'CAPTURE', 'REFUND', 'ADJUSTMENT', 'REVERSAL'), `id`
  ) AS `ledger_sequence`
FROM `welfare_card_ledger`;

UPDATE `welfare_card_ledger` ledger
JOIN `welfare_card_ledger_sequence_backfill` backfill ON backfill.`id` = ledger.`id`
SET ledger.`sequence` = backfill.`ledger_sequence`;

DROP TEMPORARY TABLE `welfare_card_ledger_sequence_backfill`;

UPDATE `welfare_card_account` account
SET account.`ledger_sequence` = (
  SELECT COUNT(*) FROM `welfare_card_ledger` ledger WHERE ledger.`account_id` = account.`id`
);

ALTER TABLE `welfare_card_account`
  MODIFY COLUMN `ledger_sequence` INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT `welfare_card_account_ledger_sequence_check` CHECK (`ledger_sequence` >= 0);

ALTER TABLE `welfare_card_ledger`
  MODIFY COLUMN `sequence` INTEGER NOT NULL,
  DROP CHECK `welfare_card_ledger_business_check`,
  DROP CHECK `welfare_card_ledger_refund_business_check`,
  ADD CONSTRAINT `welfare_card_ledger_business_check` CHECK (
    `sequence` > 0 AND `amount` > 0
    AND `before_balance` >= 0 AND `after_balance` >= 0
    AND `before_frozen` >= 0 AND `after_frozen` >= 0
    AND `before_frozen` <= `before_balance` AND `after_frozen` <= `after_balance`
    AND (
      (`business_type` IN ('CLAIM', 'GRANT', 'GIFT') AND `direction` = 'CREDIT'
        AND `order_id` IS NULL AND `refund_id` IS NULL AND `adjustment_id` IS NULL
        AND `before_balance` = 0 AND `after_balance` = `amount` AND `before_frozen` = 0 AND `after_frozen` = 0)
      OR (`business_type` = 'FREEZE' AND `direction` = 'DEBIT'
        AND `order_id` IS NOT NULL AND `refund_id` IS NULL AND `adjustment_id` IS NULL
        AND `after_balance` = `before_balance` AND `after_frozen` = `before_frozen` + `amount`)
      OR (`business_type` = 'RELEASE' AND `direction` = 'CREDIT'
        AND `order_id` IS NOT NULL AND `refund_id` IS NULL AND `adjustment_id` IS NULL
        AND `after_balance` = `before_balance` AND `after_frozen` = `before_frozen` - `amount`)
      OR (`business_type` = 'CAPTURE' AND `direction` = 'DEBIT'
        AND `order_id` IS NOT NULL AND `refund_id` IS NULL AND `adjustment_id` IS NULL
        AND `after_balance` = `before_balance` - `amount` AND `after_frozen` = `before_frozen` - `amount`)
      OR (`business_type` = 'REFUND' AND `direction` = 'CREDIT'
        AND `order_id` IS NOT NULL AND `refund_id` IS NOT NULL AND `adjustment_id` IS NULL
        AND `after_balance` = `before_balance` + `amount` AND `after_frozen` = `before_frozen`)
      OR (`business_type` IN ('ADJUSTMENT', 'REVERSAL') AND `direction` IN ('CREDIT', 'DEBIT')
        AND `order_id` IS NULL AND `refund_id` IS NULL AND `adjustment_id` IS NOT NULL
        AND `after_balance` = `before_balance` + IF(`direction` = 'CREDIT', `amount`, -`amount`)
        AND `after_frozen` = `before_frozen`)
    )
  ),
  ADD UNIQUE INDEX `welfare_card_ledger_account_sequence_key` (`account_id`, `sequence`),
  ADD UNIQUE INDEX `welfare_card_ledger_adjustment_key` (`adjustment_id`),
  ADD CONSTRAINT `welfare_card_ledger_adjustment_fkey` FOREIGN KEY (`adjustment_id`) REFERENCES `welfare_card_adjustment`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT;

DROP TRIGGER `welfare_card_ledger_balance_guard`;
CREATE TRIGGER `welfare_card_ledger_balance_guard`
BEFORE INSERT ON `welfare_card_ledger`
FOR EACH ROW
BEGIN
  DECLARE expected_sequence INTEGER;
  SELECT COALESCE(MAX(`sequence`), 0) + 1 INTO expected_sequence
  FROM `welfare_card_ledger` WHERE `account_id` = NEW.`account_id`;
  IF NEW.`sequence` <> expected_sequence THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_LEDGER_SEQUENCE_INVALID';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM `welfare_card_account` a
    WHERE a.`id` = NEW.`account_id`
      AND a.`balance_amount` = NEW.`after_balance`
      AND a.`frozen_amount` = NEW.`after_frozen`
      AND a.`ledger_sequence` = NEW.`sequence`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_LEDGER_BALANCE_INVALID';
  END IF;
END;

CREATE TRIGGER `welfare_card_adjustment_history_no_update` BEFORE UPDATE ON `welfare_card_adjustment_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_ADJUSTMENT_HISTORY_IMMUTABLE';
CREATE TRIGGER `welfare_card_adjustment_history_no_delete` BEFORE DELETE ON `welfare_card_adjustment_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_ADJUSTMENT_HISTORY_IMMUTABLE';
CREATE TRIGGER `welfare_card_adjustment_command_no_update` BEFORE UPDATE ON `welfare_card_adjustment_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_ADJUSTMENT_COMMAND_IMMUTABLE';
CREATE TRIGGER `welfare_card_adjustment_command_no_delete` BEFORE DELETE ON `welfare_card_adjustment_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_ADJUSTMENT_COMMAND_IMMUTABLE';
