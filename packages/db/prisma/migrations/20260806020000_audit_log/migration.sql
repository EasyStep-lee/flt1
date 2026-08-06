CREATE TABLE `audit_log` (
  `id` CHAR(36) NOT NULL,
  `actor_type` ENUM('COMPANY_USER', 'SUPPLIER_USER', 'SYSTEM') NOT NULL,
  `actor_id` VARCHAR(128) NOT NULL,
  `action` VARCHAR(128) NOT NULL,
  `object_type` VARCHAR(128) NOT NULL,
  `object_id` VARCHAR(64) NOT NULL,
  `before_snapshot` JSON NOT NULL,
  `after_snapshot` JSON NOT NULL,
  `request_id` CHAR(36) NOT NULL,
  `ip` VARCHAR(64) NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `audit_log_action_time_idx` (`action`, `occurred_at`),
  INDEX `audit_log_object_time_idx` (`object_type`, `object_id`, `occurred_at`),
  INDEX `audit_log_actor_time_idx` (`actor_type`, `actor_id`, `occurred_at`),
  INDEX `audit_log_request_id_idx` (`request_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TRIGGER `audit_log_prevent_update`
BEFORE UPDATE ON `audit_log`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUDIT_IMMUTABLE';

CREATE TRIGGER `audit_log_prevent_delete`
BEFORE DELETE ON `audit_log`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'AUDIT_IMMUTABLE';
