-- MIG-010 / M3-P022: one company main order split into supplier fulfillment orders.
CREATE TABLE `buyer_order` (
  `id` CHAR(36) NOT NULL,
  `order_no` VARCHAR(32) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `consumer_user_id` CHAR(36) NULL,
  `enterprise_customer_id` CHAR(36) NULL,
  `order_type` ENUM('CONSUMER','ENTERPRISE') NOT NULL,
  `goods_amount` INTEGER NOT NULL,
  `delivery_fee` INTEGER NOT NULL DEFAULT 0,
  `discount_amount` INTEGER NOT NULL DEFAULT 0,
  `total_amount` INTEGER NOT NULL,
  `welfare_card_amount` INTEGER NOT NULL DEFAULT 0,
  `welfare_card_account_id` CHAR(36) NULL,
  `cash_amount` INTEGER NOT NULL,
  `external_payment_method` ENUM('WECHAT_PAY','BANK_TRANSFER') NULL,
  `payment_status` ENUM('NOT_REQUIRED','PENDING','PAID','FAILED','CLOSED','UNKNOWN') NOT NULL DEFAULT 'PENDING',
  `order_status` ENUM('DRAFT','PENDING_PAYMENT','PAID','FULFILLING','PARTIALLY_DELIVERED','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  `idempotency_scope` VARCHAR(128) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `buyer_order_order_no_key` (`order_no`),
  UNIQUE INDEX `buyer_order_idempotency_scope_key` (`idempotency_scope`, `idempotency_key`),
  INDEX `buyer_order_company_type_time_idx` (`company_id`, `order_type`, `created_at`),
  INDEX `buyer_order_consumer_time_idx` (`consumer_user_id`, `created_at`),
  INDEX `buyer_order_enterprise_time_idx` (`enterprise_customer_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `buyer_order_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `buyer_order_owner_check` CHECK (
    (`order_type` = 'CONSUMER' AND `consumer_user_id` IS NOT NULL AND `enterprise_customer_id` IS NULL)
    OR (`order_type` = 'ENTERPRISE' AND `consumer_user_id` IS NULL AND `enterprise_customer_id` IS NOT NULL)
  ),
  CONSTRAINT `buyer_order_amount_non_negative_check` CHECK (
    `goods_amount` >= 0 AND `delivery_fee` >= 0 AND `discount_amount` >= 0
    AND `total_amount` >= 0 AND `welfare_card_amount` >= 0 AND `cash_amount` >= 0
  ),
  CONSTRAINT `buyer_order_amount_arithmetic_check` CHECK (
    `goods_amount` + `delivery_fee` - `discount_amount` = `total_amount`
    AND `welfare_card_amount` + `cash_amount` = `total_amount`
  ),
  CONSTRAINT `buyer_order_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_fulfillment_order` (
  `id` CHAR(36) NOT NULL,
  `buyer_order_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `goods_amount` INTEGER NOT NULL,
  `item_count` INTEGER NOT NULL,
  `status` ENUM('PENDING_PAYMENT','PENDING_PREPARATION','PREPARING','READY_FOR_HANDOFF','CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `fulfillment_order_buyer_supplier_key` (`buyer_order_id`, `supplier_id`),
  INDEX `fulfillment_order_supplier_status_time_idx` (`supplier_id`, `status`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_fulfillment_order_buyer_order_id_fkey`
    FOREIGN KEY (`buyer_order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `supplier_fulfillment_order_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fulfillment_order_amount_item_check` CHECK (`goods_amount` >= 0 AND `item_count` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `buyer_order_item` (
  `id` CHAR(36) NOT NULL,
  `buyer_order_id` CHAR(36) NOT NULL,
  `supplier_fulfillment_order_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `sku_id` CHAR(36) NOT NULL,
  `line_no` INTEGER NOT NULL,
  `product_snapshot` JSON NOT NULL,
  `quantity` INTEGER NOT NULL,
  `sale_price_snapshot` INTEGER NOT NULL,
  `supply_price_snapshot` INTEGER NOT NULL,
  `line_amount` INTEGER NOT NULL,
  `refund_status` ENUM('NONE','REQUESTED','PROCESSING','PARTIAL','REFUNDED','REJECTED') NOT NULL DEFAULT 'NONE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `buyer_order_item_order_line_key` (`buyer_order_id`, `line_no`),
  INDEX `buyer_order_item_fulfillment_idx` (`supplier_fulfillment_order_id`),
  INDEX `buyer_order_item_supplier_sku_idx` (`supplier_id`, `sku_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `buyer_order_item_buyer_order_id_fkey`
    FOREIGN KEY (`buyer_order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `buyer_order_item_fulfillment_fkey`
    FOREIGN KEY (`supplier_fulfillment_order_id`) REFERENCES `supplier_fulfillment_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `buyer_order_item_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `buyer_order_item_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `buyer_order_item_sku_id_fkey`
    FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `buyer_order_item_amount_check` CHECK (
    `line_no` > 0 AND `quantity` > 0 AND `sale_price_snapshot` >= 0
    AND `supply_price_snapshot` >= 0 AND `line_amount` = `quantity` * `sale_price_snapshot`
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `buyer_order_event` (
  `id` CHAR(36) NOT NULL,
  `buyer_order_id` CHAR(36) NOT NULL,
  `event` ENUM('CREATED') NOT NULL,
  `from_status` ENUM('DRAFT','PENDING_PAYMENT','PAID','FULFILLING','PARTIALLY_DELIVERED','COMPLETED','CANCELLED') NULL,
  `to_status` ENUM('DRAFT','PENDING_PAYMENT','PAID','FULFILLING','PARTIALLY_DELIVERED','COMPLETED','CANCELLED') NOT NULL,
  `version` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `actor_type` ENUM('CONSUMER','ENTERPRISE') NOT NULL,
  `actor_id` CHAR(36) NOT NULL,
  `request_id` VARCHAR(128) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `buyer_order_event_order_version_key` (`buyer_order_id`, `version`),
  INDEX `buyer_order_event_order_time_idx` (`buyer_order_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `buyer_order_event_buyer_order_id_fkey`
    FOREIGN KEY (`buyer_order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `buyer_order_event_created_check` CHECK (
    `event` = 'CREATED' AND `from_status` IS NULL AND `to_status` = 'PENDING_PAYMENT' AND `version` = 0
  )
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `buyer_order_event_update_guard`
BEFORE UPDATE ON `buyer_order_event`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BUYER_ORDER_EVENT_IMMUTABLE';

CREATE TRIGGER `buyer_order_event_delete_guard`
BEFORE DELETE ON `buyer_order_event`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BUYER_ORDER_EVENT_IMMUTABLE';
