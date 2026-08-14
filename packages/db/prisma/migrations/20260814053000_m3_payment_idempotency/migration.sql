-- MIG-012A / M3-P024: idempotent WeChat prepay and verified notification processing.
ALTER TABLE `buyer_order_event`
  DROP CHECK `buyer_order_event_created_check`,
  MODIFY `event` ENUM('CREATED','PAYMENT_CONFIRMED') NOT NULL;

ALTER TABLE `buyer_order_event`
  ADD CONSTRAINT `buyer_order_event_lifecycle_check` CHECK (
    (`event` = 'CREATED' AND `from_status` IS NULL AND `to_status` = 'PENDING_PAYMENT' AND `version` = 0)
    OR (`event` = 'PAYMENT_CONFIRMED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PAID' AND `version` > 0)
  );

CREATE TABLE `payment_transaction` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `channel` ENUM('WECHAT_PAY') NOT NULL DEFAULT 'WECHAT_PAY',
  `amount` INTEGER NOT NULL,
  `out_trade_no` VARCHAR(32) NOT NULL,
  `wechat_transaction_id` VARCHAR(64) NULL,
  `status` ENUM('CREATED','PREPAY_CREATED','PAID','CLOSED','UNKNOWN','FAILED') NOT NULL DEFAULT 'CREATED',
  `notify_verified_at` DATETIME(3) NULL,
  `paid_at` DATETIME(3) NULL,
  `closed_at` DATETIME(3) NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `payment_transaction_order_key` (`order_id`),
  UNIQUE INDEX `payment_transaction_out_trade_no_key` (`out_trade_no`),
  UNIQUE INDEX `payment_transaction_wechat_transaction_key` (`wechat_transaction_id`),
  INDEX `payment_transaction_status_time_idx` (`status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_transaction_order_fkey` FOREIGN KEY (`order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payment_transaction_amount_check` CHECK (`amount` > 0),
  CONSTRAINT `payment_transaction_version_check` CHECK (`version` >= 0),
  CONSTRAINT `payment_transaction_timestamps_check` CHECK (
    (`status` <> 'PAID' OR (`wechat_transaction_id` IS NOT NULL AND `notify_verified_at` IS NOT NULL AND `paid_at` IS NOT NULL))
    AND (`status` <> 'CLOSED' OR `closed_at` IS NOT NULL)
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `payment_attempt` (
  `id` CHAR(36) NOT NULL,
  `payment_transaction_id` CHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `status` ENUM('CREATED','SUCCEEDED','FAILED') NOT NULL DEFAULT 'CREATED',
  `response_snapshot` JSON NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `completed_at` DATETIME(3) NULL,
  UNIQUE INDEX `payment_attempt_transaction_key` (`payment_transaction_id`, `idempotency_key`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_attempt_transaction_fkey` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payment_attempt_completed_check` CHECK (`status` = 'CREATED' OR `completed_at` IS NOT NULL)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `order_payment_allocation` (
  `id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `order_item_id` CHAR(36) NOT NULL,
  `welfare_card_amount` INTEGER NOT NULL DEFAULT 0,
  `cash_amount` INTEGER NOT NULL,
  `allocation_rule_version` INTEGER NOT NULL DEFAULT 1,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `order_payment_allocation_item_key` (`order_item_id`),
  INDEX `order_payment_allocation_order_idx` (`order_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `order_payment_allocation_order_fkey` FOREIGN KEY (`order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `order_payment_allocation_item_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `buyer_order_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `order_payment_allocation_amount_check` CHECK (`welfare_card_amount` >= 0 AND `cash_amount` >= 0 AND (`welfare_card_amount` + `cash_amount`) > 0),
  CONSTRAINT `order_payment_allocation_version_check` CHECK (`allocation_rule_version` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `payment_notification` (
  `id` CHAR(36) NOT NULL,
  `payment_transaction_id` CHAR(36) NOT NULL,
  `notification_id` VARCHAR(128) NOT NULL,
  `raw_body_hash` CHAR(64) NOT NULL,
  `out_trade_no` VARCHAR(32) NOT NULL,
  `wechat_transaction_id` VARCHAR(64) NOT NULL,
  `amount` INTEGER NOT NULL,
  `result` ENUM('PAID','REPLAYED','REJECTED') NOT NULL,
  `verified_at` DATETIME(3) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `payment_notification_notification_key` (`notification_id`),
  INDEX `payment_notification_transaction_time_idx` (`payment_transaction_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_notification_transaction_fkey` FOREIGN KEY (`payment_transaction_id`) REFERENCES `payment_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payment_notification_amount_check` CHECK (`amount` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `payment_notification_update_guard`
BEFORE UPDATE ON `payment_notification`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAYMENT_NOTIFICATION_IMMUTABLE';

CREATE TRIGGER `payment_notification_delete_guard`
BEFORE DELETE ON `payment_notification`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'PAYMENT_NOTIFICATION_IMMUTABLE';

CREATE TRIGGER `order_payment_allocation_update_guard`
BEFORE UPDATE ON `order_payment_allocation`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_PAYMENT_ALLOCATION_IMMUTABLE';

CREATE TRIGGER `order_payment_allocation_delete_guard`
BEFORE DELETE ON `order_payment_allocation`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ORDER_PAYMENT_ALLOCATION_IMMUTABLE';

CREATE TABLE `payment_outbox` (
  `id` CHAR(36) NOT NULL,
  `buyer_order_id` CHAR(36) NOT NULL,
  `event_type` VARCHAR(64) NOT NULL,
  `event_version` INTEGER NOT NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('PENDING','PUBLISHED','FAILED') NOT NULL DEFAULT 'PENDING',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `published_at` DATETIME(3) NULL,
  UNIQUE INDEX `payment_outbox_order_event_version_key` (`buyer_order_id`, `event_type`, `event_version`),
  INDEX `payment_outbox_status_time_idx` (`status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `payment_outbox_order_fkey` FOREIGN KEY (`buyer_order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `payment_outbox_version_check` CHECK (`event_version` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
