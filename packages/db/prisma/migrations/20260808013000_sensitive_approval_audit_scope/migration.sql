-- M1-P072: append-only sensitive operation approvals and tenant-scoped audit events.
ALTER TABLE `approval_task`
  ADD COLUMN `applicant_functional_account_id` CHAR(36) NULL,
  ADD COLUMN `supplier_id` CHAR(36) NULL,
  ADD COLUMN `reviewed_by_type` ENUM('COMPANY_USER', 'SUPPLIER_USER') NULL,
  ADD COLUMN `reviewer_functional_account_id` CHAR(36) NULL,
  ADD COLUMN `request_snapshot` JSON NULL,
  ADD INDEX `approval_task_supplier_type_status_idx` (`supplier_id`, `approval_type`, `status`);

CREATE TABLE `approval_task_history` (
  `id` CHAR(36) NOT NULL,
  `approval_task_id` CHAR(36) NOT NULL,
  `from_status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NULL,
  `to_status` ENUM('PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'CANCELLED') NOT NULL,
  `event` ENUM('CREATE', 'CLAIM', 'APPROVE', 'REJECT', 'CANCEL') NOT NULL,
  `actor_type` ENUM('COMPANY_USER', 'SUPPLIER_USER') NOT NULL,
  `actor_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `opinion` VARCHAR(1000) NULL,
  `version` INTEGER NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `approval_task_history_task_version_key` (`approval_task_id`, `version`),
  INDEX `approval_task_history_task_time_idx` (`approval_task_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `approval_task_history_task_id_fkey`
    FOREIGN KEY (`approval_task_id`) REFERENCES `approval_task`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `approval_task_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(128) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `approval_task_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `approval_task_history_immutable_update`
BEFORE UPDATE ON `approval_task_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'APPROVAL_HISTORY_IMMUTABLE';

CREATE TRIGGER `approval_task_history_immutable_delete`
BEFORE DELETE ON `approval_task_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'APPROVAL_HISTORY_IMMUTABLE';

ALTER TABLE `audit_log`
  ADD COLUMN `supplier_id` CHAR(36) NULL,
  ADD COLUMN `functional_account_id` CHAR(36) NULL,
  ADD INDEX `audit_log_supplier_time_idx` (`supplier_id`, `occurred_at`),
  ADD INDEX `audit_log_functional_account_time_idx` (`functional_account_id`, `occurred_at`);

INSERT INTO `permission` (`id`, `code`, `resource`, `action`, `field_group`, `risk_level`) VALUES
  ('72000000-0000-4000-8000-000000000001', 'supply_price.reveal', 'supply_price', 'REVEAL', 'supply_price', 3),
  ('72000000-0000-4000-8000-000000000002', 'supply_price.approve', 'supply_price', 'APPROVE', NULL, 3),
  ('72000000-0000-4000-8000-000000000003', 'refund.review', 'refund', 'APPROVE', NULL, 3),
  ('72000000-0000-4000-8000-000000000004', 'welfare_card.adjust', 'welfare_card', 'UPDATE', NULL, 3),
  ('72000000-0000-4000-8000-000000000005', 'offline_payment.record', 'offline_payment', 'CREATE', NULL, 3),
  ('72000000-0000-4000-8000-000000000006', 'bank_account.review', 'bank_account', 'APPROVE', NULL, 3),
  ('72000000-0000-4000-8000-000000000007', 'sensitive_export.request', 'sensitive_export', 'CREATE', NULL, 3),
  ('72000000-0000-4000-8000-000000000008', 'sensitive_export.review', 'sensitive_export', 'APPROVE', NULL, 3),
  ('72000000-0000-4000-8000-000000000009', 'audit_event.read', 'audit_event', 'READ', NULL, 3);
