-- MIG-012B / M3-P025: company-owned checkout and append-only enterprise remittance evidence.
ALTER TABLE `buyer_order_event`
  DROP CHECK `buyer_order_event_lifecycle_check`,
  MODIFY `event` ENUM('CREATED','PAYMENT_CONFIRMED','REMITTANCE_SUBMITTED','REMITTANCE_CONFIRMED','REMITTANCE_REJECTED') NOT NULL,
  MODIFY `actor_type` ENUM('CONSUMER','ENTERPRISE','COMPANY') NOT NULL;

ALTER TABLE `buyer_order_event`
  ADD CONSTRAINT `buyer_order_event_lifecycle_check` CHECK (
    (`event` = 'CREATED' AND `from_status` IS NULL AND `to_status` = 'PENDING_PAYMENT' AND `version` = 0)
    OR (`event` = 'PAYMENT_CONFIRMED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PAID' AND `version` > 0)
    OR (`event` = 'REMITTANCE_SUBMITTED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PENDING_PAYMENT' AND `version` > 0)
    OR (`event` = 'REMITTANCE_CONFIRMED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PAID' AND `version` > 0)
    OR (`event` = 'REMITTANCE_REJECTED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PENDING_PAYMENT' AND `version` > 0)
  );

CREATE TABLE `enterprise_remittance_submission` (
  `id` CHAR(36) NOT NULL,
  `buyer_order_id` CHAR(36) NOT NULL,
  `submission_version` INTEGER NOT NULL,
  `amount` INTEGER NOT NULL,
  `proof_object_key` VARCHAR(512) NOT NULL,
  `submitted_by_enterprise_user_id` CHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `status` ENUM('PENDING_REVIEW','CONFIRMED','REJECTED') NOT NULL DEFAULT 'PENDING_REVIEW',
  `version` INTEGER NOT NULL DEFAULT 0,
  `submitted_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `reviewed_at` DATETIME(3) NULL,
  UNIQUE INDEX `enterprise_remittance_order_version_key` (`buyer_order_id`, `submission_version`),
  UNIQUE INDEX `enterprise_remittance_order_idempotency_key` (`buyer_order_id`, `idempotency_key`),
  INDEX `enterprise_remittance_status_time_idx` (`status`, `submitted_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_remittance_order_fkey` FOREIGN KEY (`buyer_order_id`) REFERENCES `buyer_order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_remittance_amount_check` CHECK (`amount` > 0),
  CONSTRAINT `enterprise_remittance_version_check` CHECK (`submission_version` > 0 AND `version` >= 0),
  CONSTRAINT `enterprise_remittance_proof_check` CHECK (CHAR_LENGTH(`proof_object_key`) > 0),
  CONSTRAINT `enterprise_remittance_reviewed_check` CHECK (`status` = 'PENDING_REVIEW' OR `reviewed_at` IS NOT NULL)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `enterprise_remittance_review` (
  `id` CHAR(36) NOT NULL,
  `submission_id` CHAR(36) NOT NULL,
  `decision` ENUM('CONFIRM','REJECT') NOT NULL,
  `reviewed_amount` INTEGER NOT NULL,
  `reason` VARCHAR(500) NOT NULL,
  `reviewer_functional_account_id` CHAR(36) NOT NULL,
  `reviewer_identity_id` CHAR(36) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `submission_version` INTEGER NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE INDEX `enterprise_remittance_review_submission_key` (`submission_id`),
  UNIQUE INDEX `enterprise_remittance_review_idempotency_key` (`submission_id`, `idempotency_key`),
  PRIMARY KEY (`id`),
  CONSTRAINT `enterprise_remittance_review_submission_fkey` FOREIGN KEY (`submission_id`) REFERENCES `enterprise_remittance_submission`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `enterprise_remittance_review_amount_check` CHECK (`reviewed_amount` > 0),
  CONSTRAINT `enterprise_remittance_review_reason_check` CHECK (CHAR_LENGTH(`reason`) > 0),
  CONSTRAINT `enterprise_remittance_review_version_check` CHECK (`submission_version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `enterprise_remittance_review_update_guard`
BEFORE UPDATE ON `enterprise_remittance_review`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_REMITTANCE_REVIEW_IMMUTABLE';

CREATE TRIGGER `enterprise_remittance_review_delete_guard`
BEFORE DELETE ON `enterprise_remittance_review`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'ENTERPRISE_REMITTANCE_REVIEW_IMMUTABLE';
