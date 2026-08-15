-- MIG-015 / M3-P029: immutable enterprise checkout snapshots and payment-route state.
CREATE TABLE `enterprise_procurement_order` (
  `id` CHAR(36) NOT NULL,
  `buyer_order_id` CHAR(36) NOT NULL,
  `enterprise_customer_id` CHAR(36) NOT NULL,
  `purchaser_user_id` CHAR(36) NOT NULL,
  `invoice_profile_snapshot` JSON NOT NULL,
  `enterprise_address_snapshot` JSON NOT NULL,
  `payment_method` ENUM('WECHAT_PAY','BANK_TRANSFER') NOT NULL,
  `remittance_review_status` ENUM('NOT_SUBMITTED','PENDING_REVIEW','CONFIRMED','REJECTED') NOT NULL DEFAULT 'NOT_SUBMITTED',
  `status` ENUM('PENDING_PAYMENT','PAYMENT_CONFIRMING','PAID','FULFILLING','COMPLETED','CANCELLED') NOT NULL DEFAULT 'PENDING_PAYMENT',
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,
  UNIQUE INDEX `enterprise_procurement_order_buyer_order_id_key` (`buyer_order_id`),
  INDEX `enterprise_procurement_order_customer_status_idx` (`enterprise_customer_id`, `status`, `created_at`),
  INDEX `enterprise_procurement_order_purchaser_time_idx` (`purchaser_user_id`, `created_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_procurement_order_buyer_order_id_fkey` FOREIGN KEY (`buyer_order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_procurement_order_enterprise_customer_id_fkey` FOREIGN KEY (`enterprise_customer_id`) REFERENCES `enterprise_customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_procurement_order_purchaser_user_id_fkey` FOREIGN KEY (`purchaser_user_id`) REFERENCES `enterprise_user`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_procurement_order_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `enterprise_procurement_order_snapshot_immutable_update`
BEFORE UPDATE ON `enterprise_procurement_order`
FOR EACH ROW
BEGIN
  IF NOT (
    OLD.`buyer_order_id` <=> NEW.`buyer_order_id`
    AND OLD.`enterprise_customer_id` <=> NEW.`enterprise_customer_id`
    AND OLD.`purchaser_user_id` <=> NEW.`purchaser_user_id`
    AND OLD.`invoice_profile_snapshot` <=> NEW.`invoice_profile_snapshot`
    AND OLD.`enterprise_address_snapshot` <=> NEW.`enterprise_address_snapshot`
    AND OLD.`payment_method` <=> NEW.`payment_method`
    AND OLD.`created_at` <=> NEW.`created_at`
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_PROCUREMENT_SNAPSHOT_IMMUTABLE';
  END IF;
END;

CREATE TRIGGER `enterprise_procurement_order_immutable_delete`
BEFORE DELETE ON `enterprise_procurement_order`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_PROCUREMENT_ORDER_IMMUTABLE';
