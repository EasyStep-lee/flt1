-- MIG-008A / M2-P061: append-only channel visibility history for the single shared Product/Sku resource.
CREATE TABLE `product_channel_visibility_history` (
  `id` CHAR(36) NOT NULL,
  `product_id` CHAR(36) NOT NULL,
  `supplier_product_id` CHAR(36) NOT NULL,
  `event` ENUM('INITIAL', 'CHANGE') NOT NULL,
  `from_version` INTEGER NOT NULL,
  `to_version` INTEGER NOT NULL,
  `before_snapshot` JSON NOT NULL,
  `after_snapshot` JSON NOT NULL,
  `reason` VARCHAR(1000) NOT NULL,
  `actor_identity_id` CHAR(36) NULL,
  `functional_account_id` CHAR(36) NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `product_channel_visibility_history_product_version_key` (`product_id`, `to_version`),
  INDEX `product_channel_visibility_history_supplier_time_idx` (`supplier_product_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `product_channel_visibility_history_product_id_fkey`
    FOREIGN KEY (`product_id`) REFERENCES `product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_channel_visibility_history_supplier_product_id_fkey`
    FOREIGN KEY (`supplier_product_id`) REFERENCES `supplier_product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `product_channel_visibility_history_version_check`
    CHECK (`from_version` >= 0 AND `to_version` >= 0),
  CONSTRAINT `product_channel_visibility_history_transition_check`
    CHECK (
      (`event` = 'INITIAL' AND `from_version` = 0 AND `to_version` = 0)
      OR (`event` = 'CHANGE' AND `to_version` = `from_version` + 1)
    ),
  CONSTRAINT `product_channel_visibility_history_actor_check`
    CHECK (
      (`event` = 'INITIAL' AND `actor_identity_id` IS NULL AND `functional_account_id` IS NULL)
      OR (`event` = 'CHANGE' AND `actor_identity_id` IS NOT NULL AND `functional_account_id` IS NOT NULL)
    ),
  CONSTRAINT `product_channel_visibility_history_reason_check`
    CHECK (CHAR_LENGTH(TRIM(`reason`)) BETWEEN 1 AND 1000)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `product_channel_visibility_history_update_guard`
BEFORE UPDATE ON `product_channel_visibility_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'HISTORY_IMMUTABLE';

CREATE TRIGGER `product_channel_visibility_history_delete_guard`
BEFORE DELETE ON `product_channel_visibility_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'HISTORY_IMMUTABLE';
