-- MIG-009 / M2-P063: one shared inventory truth per platform SKU.
CREATE TABLE `inventory_balance` (
  `id` CHAR(36) NOT NULL,
  `sku_id` CHAR(36) NOT NULL,
  `available_qty` INTEGER NOT NULL DEFAULT 0,
  `reserved_qty` INTEGER NOT NULL DEFAULT 0,
  `sold_qty` INTEGER NOT NULL DEFAULT 0,
  `damaged_qty` INTEGER NOT NULL DEFAULT 0,
  `safety_stock_qty` INTEGER NOT NULL DEFAULT 0,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `inventory_balance_sku_key` (`sku_id`),
  INDEX `inventory_balance_warning_idx` (`available_qty`, `safety_stock_qty`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_balance_sku_id_fkey`
    FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_balance_non_negative_check`
    CHECK (`available_qty` >= 0 AND `reserved_qty` >= 0 AND `sold_qty` >= 0 AND `damaged_qty` >= 0 AND `safety_stock_qty` >= 0),
  CONSTRAINT `inventory_balance_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `inventory_change_log` (
  `id` CHAR(36) NOT NULL,
  `inventory_balance_id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `sku_id` CHAR(36) NOT NULL,
  `type` ENUM('INCREASE','DECREASE','STOCKTAKE_GAIN','STOCKTAKE_LOSS','DAMAGE','RESERVE','RELEASE','CONFIRM_SALE') NOT NULL,
  `available_delta` INTEGER NOT NULL,
  `reserved_delta` INTEGER NOT NULL,
  `sold_delta` INTEGER NOT NULL,
  `damaged_delta` INTEGER NOT NULL,
  `before_available_qty` INTEGER NOT NULL,
  `after_available_qty` INTEGER NOT NULL,
  `before_reserved_qty` INTEGER NOT NULL,
  `after_reserved_qty` INTEGER NOT NULL,
  `before_sold_qty` INTEGER NOT NULL,
  `after_sold_qty` INTEGER NOT NULL,
  `before_damaged_qty` INTEGER NOT NULL,
  `after_damaged_qty` INTEGER NOT NULL,
  `resulting_version` INTEGER NOT NULL,
  `reference_type` ENUM('MANUAL_ADJUSTMENT','STOCKTAKE','DAMAGE','ORDER_RESERVATION','ORDER_RELEASE','ORDER_CONFIRM') NOT NULL,
  `reference_id` VARCHAR(128) NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `actor_identity_id` CHAR(36) NULL,
  `functional_account_id` CHAR(36) NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventory_change_log_balance_version_key` (`inventory_balance_id`, `resulting_version`),
  INDEX `inventory_change_log_supplier_time_idx` (`supplier_id`, `occurred_at`),
  INDEX `inventory_change_log_sku_time_idx` (`sku_id`, `occurred_at`),
  INDEX `inventory_change_log_reference_idx` (`reference_type`, `reference_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `inventory_change_log_balance_id_fkey`
    FOREIGN KEY (`inventory_balance_id`) REFERENCES `inventory_balance`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_change_log_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_change_log_sku_id_fkey`
    FOREIGN KEY (`sku_id`) REFERENCES `sku`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `inventory_change_log_non_negative_check`
    CHECK (`before_available_qty` >= 0 AND `after_available_qty` >= 0 AND `before_reserved_qty` >= 0 AND `after_reserved_qty` >= 0 AND `before_sold_qty` >= 0 AND `after_sold_qty` >= 0 AND `before_damaged_qty` >= 0 AND `after_damaged_qty` >= 0),
  CONSTRAINT `inventory_change_log_arithmetic_check`
    CHECK (`after_available_qty` = `before_available_qty` + `available_delta` AND `after_reserved_qty` = `before_reserved_qty` + `reserved_delta` AND `after_sold_qty` = `before_sold_qty` + `sold_delta` AND `after_damaged_qty` = `before_damaged_qty` + `damaged_delta`),
  CONSTRAINT `inventory_change_log_reason_check` CHECK (CHAR_LENGTH(TRIM(`reason`)) BETWEEN 1 AND 1000),
  CONSTRAINT `inventory_change_log_version_check` CHECK (`resulting_version` > 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `inventory_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(191) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `inventory_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

-- Existing approved SKUs receive their supplier-declared initial stock once.
INSERT INTO `inventory_balance` (`id`, `sku_id`, `available_qty`, `reserved_qty`, `sold_qty`, `damaged_qty`, `safety_stock_qty`, `version`, `created_at`, `updated_at`)
SELECT UUID(), s.`id`, sps.`initial_stock`, 0, 0, 0, 0, 0, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)
FROM `sku` s
JOIN `supplier_product_sku` sps ON sps.`id` = s.`supplier_product_sku_id`
LEFT JOIN `inventory_balance` ib ON ib.`sku_id` = s.`id`
WHERE ib.`id` IS NULL;

CREATE TRIGGER `inventory_change_log_update_guard`
BEFORE UPDATE ON `inventory_change_log`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVENTORY_HISTORY_IMMUTABLE';

CREATE TRIGGER `inventory_change_log_delete_guard`
BEFORE DELETE ON `inventory_change_log`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'INVENTORY_HISTORY_IMMUTABLE';
