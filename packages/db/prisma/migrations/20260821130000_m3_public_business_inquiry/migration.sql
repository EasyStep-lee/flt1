CREATE TABLE `business_inquiry` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `lead_number` VARCHAR(32) NOT NULL,
  `inquiry_type` VARCHAR(32) NOT NULL,
  `contact_name` VARCHAR(64) NOT NULL,
  `enterprise_name` VARCHAR(191) NOT NULL,
  `contact_mobile_encrypted` VARCHAR(500) NOT NULL,
  `demand_summary` VARCHAR(500) NOT NULL,
  `source_page` VARCHAR(255) NOT NULL,
  `consent_version` INTEGER NOT NULL,
  `consented_at` DATETIME(3) NOT NULL,
  `status` VARCHAR(16) NOT NULL DEFAULT 'SUBMITTED',
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `request_id` VARCHAR(128) NOT NULL,
  `source_fingerprint` CHAR(64) NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  CONSTRAINT `business_inquiry_fixed_type_status_check` CHECK (
    `inquiry_type` = 'ENTERPRISE_WELFARE' AND `status` = 'SUBMITTED'
    AND `source_page` = '/welfare-card-service' AND `consent_version` = 1
  ),
  UNIQUE INDEX `business_inquiry_lead_number_key` (`lead_number`),
  UNIQUE INDEX `business_inquiry_company_idempotency_key` (`company_id`, `idempotency_key`),
  INDEX `business_inquiry_company_status_time_idx` (`company_id`, `status`, `created_at`),
  INDEX `business_inquiry_request_id_idx` (`request_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `business_inquiry_company_fkey` FOREIGN KEY (`company_id`) REFERENCES `company`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `business_inquiry_no_update` BEFORE UPDATE ON `business_inquiry`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BUSINESS_INQUIRY_IMMUTABLE';

CREATE TRIGGER `business_inquiry_no_delete` BEFORE DELETE ON `business_inquiry`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'BUSINESS_INQUIRY_IMMUTABLE';
