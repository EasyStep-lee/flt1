-- MIG-013 / M3-P026: original-payment-structure refund intent, state and append-only impacts.
CREATE TABLE `refund_authorization` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `order_item_id` CHAR(36) NOT NULL,
  `approved_amount` INTEGER NOT NULL,
  `approved_by_identity_type` VARCHAR(64) NOT NULL,
  `approved_by_identity_id` CHAR(36) NOT NULL,
  `status` ENUM('APPROVED','CONSUMED','CANCELLED') NOT NULL DEFAULT 'APPROVED',
  `version` INTEGER NOT NULL DEFAULT 1,
  `approved_at` DATETIME(3) NOT NULL,
  `consumed_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `refund_authorization_company_status_idx` (`company_id`, `status`, `approved_at`),
  INDEX `refund_authorization_item_status_idx` (`order_item_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `refund_authorization_company_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `refund_authorization_order_fkey` FOREIGN KEY (`order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `refund_authorization_item_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `buyer_order_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `refund_authorization_amount_check` CHECK (`approved_amount` > 0),
  CONSTRAINT `refund_authorization_version_check` CHECK (`version` > 0),
  CONSTRAINT `refund_authorization_scope_check` CHECK (CHAR_LENGTH(`approved_by_identity_type`) > 0),
  CONSTRAINT `refund_authorization_consumed_check` CHECK (`status` <> 'CONSUMED' OR `consumed_at` IS NOT NULL)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `refund_transaction` (
  `id` CHAR(36) NOT NULL,
  `after_sale_id` CHAR(36) NOT NULL,
  `order_id` CHAR(36) NOT NULL,
  `order_item_id` CHAR(36) NOT NULL,
  `refund_no` VARCHAR(32) NOT NULL,
  `welfare_card_refund_amount` INTEGER NOT NULL,
  `cash_refund_amount` INTEGER NOT NULL,
  `original_payment_transaction_id` CHAR(36) NULL,
  `wechat_refund_no` VARCHAR(64) NULL,
  `status` ENUM('CREATED','PROCESSING','PARTIAL_CHANNEL_DONE','SUCCEEDED','UNKNOWN','FAILED') NOT NULL DEFAULT 'CREATED',
  `welfare_channel_status` ENUM('NOT_REQUIRED','PENDING','PROCESSING','SUCCEEDED','UNKNOWN','FAILED') NOT NULL DEFAULT 'NOT_REQUIRED',
  `wechat_channel_status` ENUM('NOT_REQUIRED','PENDING','PROCESSING','SUCCEEDED','UNKNOWN','FAILED') NOT NULL DEFAULT 'NOT_REQUIRED',
  `notify_verified_at` DATETIME(3) NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `refund_transaction_after_sale_key` (`after_sale_id`),
  UNIQUE INDEX `refund_transaction_refund_no_key` (`refund_no`),
  UNIQUE INDEX `refund_transaction_wechat_refund_no_key` (`wechat_refund_no`),
  UNIQUE INDEX `refund_transaction_order_idempotency_key` (`order_id`, `idempotency_key`),
  INDEX `refund_transaction_item_status_idx` (`order_item_id`, `status`, `created_at`),
  INDEX `refund_transaction_original_payment_idx` (`original_payment_transaction_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `refund_transaction_authorization_fkey` FOREIGN KEY (`after_sale_id`) REFERENCES `refund_authorization`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `refund_transaction_order_fkey` FOREIGN KEY (`order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `refund_transaction_item_fkey` FOREIGN KEY (`order_item_id`) REFERENCES `buyer_order_item`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `refund_transaction_original_payment_fkey` FOREIGN KEY (`original_payment_transaction_id`) REFERENCES `payment_transaction`(`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `refund_transaction_amount_check` CHECK (`welfare_card_refund_amount` >= 0 AND `cash_refund_amount` >= 0 AND (`welfare_card_refund_amount` + `cash_refund_amount`) > 0),
  CONSTRAINT `refund_transaction_channel_reference_check` CHECK ((`cash_refund_amount` = 0 AND `original_payment_transaction_id` IS NULL) OR (`cash_refund_amount` > 0 AND `original_payment_transaction_id` IS NOT NULL)),
  CONSTRAINT `refund_transaction_channel_status_check` CHECK ((`welfare_card_refund_amount` = 0 AND `welfare_channel_status` = 'NOT_REQUIRED') OR (`welfare_card_refund_amount` > 0 AND `welfare_channel_status` <> 'NOT_REQUIRED')),
  CONSTRAINT `refund_transaction_wechat_status_check` CHECK ((`cash_refund_amount` = 0 AND `wechat_channel_status` = 'NOT_REQUIRED') OR (`cash_refund_amount` > 0 AND `wechat_channel_status` <> 'NOT_REQUIRED')),
  CONSTRAINT `refund_transaction_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `refund_transaction_event` (
  `id` CHAR(36) NOT NULL,
  `refund_transaction_id` CHAR(36) NOT NULL,
  `from_status` ENUM('CREATED','PROCESSING','PARTIAL_CHANNEL_DONE','SUCCEEDED','UNKNOWN','FAILED') NULL,
  `to_status` ENUM('CREATED','PROCESSING','PARTIAL_CHANNEL_DONE','SUCCEEDED','UNKNOWN','FAILED') NOT NULL,
  `event` VARCHAR(64) NOT NULL,
  `version` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `actor_type` VARCHAR(64) NOT NULL,
  `actor_id` CHAR(36) NOT NULL,
  `request_id` VARCHAR(128) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `refund_transaction_event_version_key` (`refund_transaction_id`, `version`),
  PRIMARY KEY (`id`),
  CONSTRAINT `refund_transaction_event_transaction_fkey` FOREIGN KEY (`refund_transaction_id`) REFERENCES `refund_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `refund_transaction_event_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `refund_impact_record` (
  `id` CHAR(36) NOT NULL,
  `refund_transaction_id` CHAR(36) NOT NULL,
  `impact_type` ENUM('FINANCIAL','INVENTORY','RECONCILIATION') NOT NULL,
  `status` ENUM('PENDING','APPLIED','REVERSED') NOT NULL DEFAULT 'PENDING',
  `payload` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `applied_at` DATETIME(3) NULL,
  UNIQUE INDEX `refund_impact_transaction_type_key` (`refund_transaction_id`, `impact_type`),
  INDEX `refund_impact_type_status_idx` (`impact_type`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `refund_impact_transaction_fkey` FOREIGN KEY (`refund_transaction_id`) REFERENCES `refund_transaction`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `refund_impact_applied_check` CHECK (`status` = 'PENDING' OR `applied_at` IS NOT NULL)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `refund_transaction_event_update_guard`
BEFORE UPDATE ON `refund_transaction_event`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REFUND_TRANSACTION_EVENT_IMMUTABLE';

CREATE TRIGGER `refund_transaction_event_delete_guard`
BEFORE DELETE ON `refund_transaction_event`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REFUND_TRANSACTION_EVENT_IMMUTABLE';

CREATE TRIGGER `refund_impact_record_delete_guard`
BEFORE DELETE ON `refund_impact_record`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REFUND_IMPACT_RECORD_IMMUTABLE';

CREATE TRIGGER `refund_impact_record_update_guard`
BEFORE UPDATE ON `refund_impact_record`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REFUND_IMPACT_RECORD_IMMUTABLE';
