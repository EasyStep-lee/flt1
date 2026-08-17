-- MIG-015 / M3-P055: atomic idempotent full welfare-card payment.
ALTER TABLE `welfare_card_ledger`
  DROP CHECK `welfare_card_ledger_claim_check`;

ALTER TABLE `welfare_card_ledger`
  ADD CONSTRAINT `welfare_card_ledger_business_check` CHECK (
    (
      `business_type` = 'CLAIM' AND `direction` = 'CREDIT' AND `amount` > 0
      AND `order_id` IS NULL AND `refund_id` IS NULL
      AND `before_balance` = 0 AND `after_balance` = `amount`
      AND `before_frozen` = 0 AND `after_frozen` = 0
    )
    OR (
      `business_type` = 'FREEZE' AND `direction` = 'DEBIT' AND `amount` > 0
      AND `order_id` IS NOT NULL AND `refund_id` IS NULL
      AND `after_balance` = `before_balance`
      AND `after_frozen` = `before_frozen` + `amount`
    )
    OR (
      `business_type` = 'CAPTURE' AND `direction` = 'DEBIT' AND `amount` > 0
      AND `order_id` IS NOT NULL AND `refund_id` IS NULL
      AND `after_balance` = `before_balance` - `amount`
      AND `after_frozen` = `before_frozen` - `amount`
    )
  );

DROP TRIGGER `welfare_card_claim_ledger_guard`;
CREATE TRIGGER `welfare_card_ledger_balance_guard`
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

CREATE TABLE `welfare_card_payment_command` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `consumer_user_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `account_id` CHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `request_id` VARCHAR(128) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `welfare_card_payment_command_order_key` (`order_id`),
  UNIQUE INDEX `welfare_card_payment_command_owner_key` (`company_id`, `consumer_user_id`, `idempotency_key`),
  INDEX `welfare_card_payment_command_account_time_idx` (`account_id`, `created_at`),
  INDEX `welfare_card_payment_command_request_idx` (`request_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `welfare_card_payment_command_company_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_payment_command_order_fkey` FOREIGN KEY (`order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `welfare_card_payment_command_account_fkey` FOREIGN KEY (`account_id`) REFERENCES `welfare_card_account`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `welfare_card_payment_command_no_update` BEFORE UPDATE ON `welfare_card_payment_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_PAYMENT_COMMAND_IMMUTABLE';
CREATE TRIGGER `welfare_card_payment_command_no_delete` BEFORE DELETE ON `welfare_card_payment_command`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'WELFARE_CARD_PAYMENT_COMMAND_IMMUTABLE';
