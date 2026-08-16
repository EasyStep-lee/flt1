-- MIG-015A / M3-P031: upgrade the existing order+supplier split into versioned preparation suborders.
ALTER TABLE `supplier_fulfillment_order`
  CHANGE COLUMN `status` `activation_status`
    ENUM('PENDING_PAYMENT','PENDING_PREPARATION','PREPARING','READY_FOR_HANDOFF','ACTIVE','CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  ADD COLUMN `enterprise_procurement_order_id` CHAR(36) NULL AFTER `buyer_order_id`,
  ADD COLUMN `sub_order_no` VARCHAR(64) NULL AFTER `supplier_id`,
  ADD COLUMN `supply_amount` INTEGER NULL AFTER `goods_amount`,
  ADD COLUMN `channel_type` ENUM('CONSUMER','ENTERPRISE') NULL AFTER `item_count`,
  ADD COLUMN `preparation_status` ENUM('PENDING','ACCEPTED','PREPARING','READY_FOR_HANDOVER','HANDED_OVER','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING' AFTER `activation_status`,
  ADD COLUMN `handover_status` ENUM('NOT_READY','READY','HANDED_OVER') NOT NULL DEFAULT 'NOT_READY' AFTER `preparation_status`,
  ADD COLUMN `settlement_status` ENUM('NOT_RECONCILED','PENDING_STATEMENT','IN_STATEMENT','ADJUSTED') NOT NULL DEFAULT 'NOT_RECONCILED' AFTER `handover_status`,
  ADD COLUMN `pickup_point_snapshot` JSON NULL AFTER `settlement_status`,
  ADD COLUMN `version` INTEGER NOT NULL DEFAULT 0 AFTER `pickup_point_snapshot`;

UPDATE `supplier_fulfillment_order` AS `fulfillment`
JOIN `buyer_order` AS `orders` ON `orders`.`id` = `fulfillment`.`buyer_order_id`
JOIN `supplier` AS `supplier` ON `supplier`.`id` = `fulfillment`.`supplier_id`
LEFT JOIN `enterprise_procurement_order` AS `enterprise_order` ON `enterprise_order`.`buyer_order_id` = `orders`.`id`
SET
  `fulfillment`.`enterprise_procurement_order_id` = `enterprise_order`.`id`,
  `fulfillment`.`sub_order_no` = CONCAT(LEFT(`orders`.`order_no`, 31), '-', REPLACE(`fulfillment`.`supplier_id`, '-', '')),
  `fulfillment`.`supply_amount` = (
    SELECT COALESCE(SUM(`item`.`supply_price_snapshot` * `item`.`quantity`), 0)
    FROM `buyer_order_item` AS `item`
    WHERE `item`.`supplier_fulfillment_order_id` = `fulfillment`.`id`
  ),
  `fulfillment`.`channel_type` = `orders`.`order_type`,
  `fulfillment`.`pickup_point_snapshot` = JSON_OBJECT(
    'schemaVersion', 1,
    'address', COALESCE(`supplier`.`pickup_address`, ''),
    'lat', `supplier`.`pickup_lat`,
    'lng', `supplier`.`pickup_lng`
  ),
  `fulfillment`.`preparation_status` = CASE
    WHEN `fulfillment`.`activation_status` = 'PREPARING' THEN 'PREPARING'
    WHEN `fulfillment`.`activation_status` = 'READY_FOR_HANDOFF' THEN 'READY_FOR_HANDOVER'
    WHEN `fulfillment`.`activation_status` = 'CANCELLED' THEN 'CANCELLED'
    ELSE 'PENDING'
  END,
  `fulfillment`.`handover_status` = CASE
    WHEN `fulfillment`.`activation_status` = 'READY_FOR_HANDOFF' THEN 'READY'
    ELSE 'NOT_READY'
  END;

UPDATE `supplier_fulfillment_order`
SET `activation_status` = CASE
  WHEN `activation_status` = 'PENDING_PAYMENT' THEN 'PENDING_PAYMENT'
  WHEN `activation_status` = 'CANCELLED' THEN 'CANCELLED'
  ELSE 'ACTIVE'
END;

ALTER TABLE `supplier_fulfillment_order`
  MODIFY COLUMN `activation_status` ENUM('PENDING_PAYMENT','ACTIVE','CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  MODIFY COLUMN `sub_order_no` VARCHAR(64) NOT NULL,
  MODIFY COLUMN `supply_amount` INTEGER NOT NULL,
  MODIFY COLUMN `channel_type` ENUM('CONSUMER','ENTERPRISE') NOT NULL,
  MODIFY COLUMN `pickup_point_snapshot` JSON NOT NULL,
  DROP INDEX `fulfillment_order_supplier_status_time_idx`,
  ADD UNIQUE INDEX `fulfillment_sub_order_no_key` (`sub_order_no`),
  ADD INDEX `fulfillment_order_supplier_status_time_idx` (`supplier_id`, `activation_status`, `preparation_status`, `created_at`),
  ADD CONSTRAINT `fulfillment_enterprise_procurement_order_id_fkey`
    FOREIGN KEY (`enterprise_procurement_order_id`) REFERENCES `enterprise_procurement_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT `fulfillment_amount_check` CHECK (`goods_amount` >= 0 AND `supply_amount` >= 0 AND `item_count` > 0);

CREATE TABLE `supplier_fulfillment_node_log` (
  `id` CHAR(36) NOT NULL,
  `sub_order_id` CHAR(36) NOT NULL,
  `node` ENUM('ACCEPT','REPORT_SHORTAGE','START_PREPARING','MARK_READY','HANDOVER') NOT NULL,
  `from_preparation_status` ENUM('PENDING','ACCEPTED','PREPARING','READY_FOR_HANDOVER','HANDED_OVER','COMPLETED','CANCELLED') NOT NULL,
  `to_preparation_status` ENUM('PENDING','ACCEPTED','PREPARING','READY_FOR_HANDOVER','HANDED_OVER','COMPLETED','CANCELLED') NOT NULL,
  `handover_party` ENUM('RUNNER','COMPANY_LOGISTICS') NULL,
  `detail_snapshot` JSON NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `request_id` VARCHAR(128) NOT NULL,
  `ip` VARCHAR(64) NULL,
  `resulting_version` INTEGER NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `fulfillment_node_sub_order_idempotency_key` (`sub_order_id`, `idempotency_key`),
  INDEX `fulfillment_node_sub_order_time_idx` (`sub_order_id`, `occurred_at`),
  CONSTRAINT `fulfillment_node_sub_order_id_fkey` FOREIGN KEY (`sub_order_id`) REFERENCES `supplier_fulfillment_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_fulfillment_readiness_outbox` (
  `id` CHAR(36) NOT NULL,
  `sub_order_id` CHAR(36) NOT NULL,
  `event_type` VARCHAR(64) NOT NULL,
  `channel_type` ENUM('CONSUMER','ENTERPRISE') NOT NULL,
  `aggregate_version` INTEGER NOT NULL,
  `payload` JSON NOT NULL,
  `status` ENUM('PENDING','PUBLISHED','FAILED') NOT NULL DEFAULT 'PENDING',
  `published_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  PRIMARY KEY (`id`),
  UNIQUE INDEX `fulfillment_outbox_sub_order_event_version_key` (`sub_order_id`, `event_type`, `aggregate_version`),
  INDEX `fulfillment_outbox_status_time_idx` (`status`, `created_at`),
  CONSTRAINT `fulfillment_outbox_sub_order_id_fkey` FOREIGN KEY (`sub_order_id`) REFERENCES `supplier_fulfillment_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
