-- M1-P066: company identities, one-functional-account sessions and append-only login audit.
ALTER TABLE `functional_account`
  DROP FOREIGN KEY `functional_account_identity_id_fkey`,
  DROP INDEX `functional_account_identity_id_fkey`;

ALTER TABLE `functional_account`
  ADD UNIQUE INDEX `functional_account_company_identity_type_key`(`company_id`, `identity_id`, `account_type_id`),
  ADD INDEX `functional_account_company_status_idx`(`company_id`, `status`),
  ADD CONSTRAINT `functional_account_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `company_user` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `mobile` VARCHAR(16) NOT NULL,
  `email` VARCHAR(254) NOT NULL,
  `status` ENUM('INVITED', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'REVOKED') NOT NULL DEFAULT 'INVITED',
  `last_login_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `company_user_company_mobile_key`(`company_id`, `mobile`),
  UNIQUE INDEX `company_user_company_email_key`(`company_id`, `email`),
  INDEX `company_user_company_status_idx`(`company_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `company_user_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `auth_session` (
  `id` CHAR(36) NOT NULL,
  `user_type` ENUM('COMPANY_USER', 'SUPPLIER_USER') NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `workspace_route` VARCHAR(255) NOT NULL,
  `session_hash` CHAR(64) NOT NULL,
  `device_info` JSON NOT NULL,
  `ip` VARCHAR(45) NOT NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `revoked_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `auth_session_hash_key`(`session_hash`),
  INDEX `auth_session_user_active_idx`(`user_type`, `user_id`, `revoked_at`, `expires_at`),
  INDEX `auth_session_account_active_idx`(`functional_account_id`, `revoked_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `auth_session_hash_format_chk`
    CHECK (`session_hash` REGEXP '^[0-9a-f]{64}$'),
  CONSTRAINT `auth_session_functional_account_id_fkey`
    FOREIGN KEY (`functional_account_id`) REFERENCES `functional_account`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `company_auth_selection` (
  `id` CHAR(36) NOT NULL,
  `user_id` CHAR(36) NOT NULL,
  `nonce_hash` CHAR(64) NOT NULL,
  `request_id` CHAR(36) NOT NULL,
  `second_verification_required` BOOLEAN NOT NULL DEFAULT false,
  `selected_account_id` CHAR(36) NULL,
  `selected_session_id` CHAR(36) NULL,
  `expires_at` DATETIME(3) NOT NULL,
  `used_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `company_auth_selection_nonce_key`(`nonce_hash`),
  UNIQUE INDEX `company_auth_selection_user_request_key`(`user_id`, `request_id`),
  INDEX `company_auth_selection_user_expiry_idx`(`user_id`, `expires_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `company_auth_selection_nonce_hash_format_chk`
    CHECK (`nonce_hash` REGEXP '^[0-9a-f]{64}$'),
  CONSTRAINT `company_auth_selection_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `company_user`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `login_audit` (
  `id` CHAR(36) NOT NULL,
  `user_type` ENUM('COMPANY_USER', 'SUPPLIER_USER', 'UNKNOWN') NOT NULL,
  `user_id` CHAR(36) NULL,
  `functional_account_id` CHAR(36) NULL,
  `login_account_hash` CHAR(64) NOT NULL,
  `result` ENUM('SUCCESS', 'AUTH_INVALID', 'ACCOUNT_SUSPENDED', 'RATE_LIMITED', 'SECOND_VERIFICATION_REQUIRED') NOT NULL,
  `risk_reason` VARCHAR(128) NOT NULL,
  `device_info` JSON NOT NULL,
  `ip` VARCHAR(45) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  INDEX `login_audit_account_time_idx`(`login_account_hash`, `occurred_at`),
  INDEX `login_audit_user_time_idx`(`user_type`, `user_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `login_audit_account_hash_format_chk`
    CHECK (`login_account_hash` REGEXP '^[0-9a-f]{64}$')
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `login_audit_prevent_update`
BEFORE UPDATE ON `login_audit`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'LOGIN_AUDIT_IMMUTABLE';

CREATE TRIGGER `login_audit_prevent_delete`
BEFORE DELETE ON `login_audit`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'LOGIN_AUDIT_IMMUTABLE';
