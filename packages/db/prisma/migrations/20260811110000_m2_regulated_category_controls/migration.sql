-- MIG-012 / M2-P018: high-risk category templates default to deny without a verified company control.
ALTER TABLE `category_template`
  ADD COLUMN `regulatory_mode` ENUM('STANDARD', 'HIGH_RISK') NOT NULL DEFAULT 'STANDARD' AFTER `status`;

DROP TRIGGER `category_template_update_guard`;
CREATE TRIGGER `category_template_update_guard`
BEFORE UPDATE ON `category_template`
FOR EACH ROW
BEGIN
  IF NEW.`id` <> OLD.`id`
    OR NEW.`company_id` <> OLD.`company_id`
    OR NEW.`category_id` <> OLD.`category_id`
    OR NEW.`version` <> OLD.`version`
    OR OLD.`status` = 'RETIRED'
    OR (OLD.`status` = 'PUBLISHED' AND (
      NEW.`status` <> 'RETIRED'
      OR NEW.`regulatory_mode` <> OLD.`regulatory_mode`
      OR NOT (NEW.`profile` <=> OLD.`profile`)
      OR NOT (NEW.`field_schema` <=> OLD.`field_schema`)
      OR NOT (NEW.`sku_dimensions` <=> OLD.`sku_dimensions`)
      OR NOT (NEW.`qualification_rules` <=> OLD.`qualification_rules`)
      OR NOT (NEW.`detail_modules` <=> OLD.`detail_modules`)
      OR NOT (NEW.`after_sale_rules` <=> OLD.`after_sale_rules`)
      OR NOT (NEW.`published_at` <=> OLD.`published_at`)
    ))
    OR (OLD.`status` = 'DRAFT' AND NEW.`status` NOT IN ('DRAFT', 'PUBLISHED')) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_TEMPLATE_IMMUTABLE';
  END IF;
END;

ALTER TABLE `supplier_product`
  ADD COLUMN `qualification_valid_until` DATETIME(3) NULL AFTER `qualification_snapshot`;

ALTER TABLE `product`
  ADD COLUMN `qualification_valid_until` DATETIME(3) NULL AFTER `detail_snapshot`,
  ADD CONSTRAINT `product_category_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `category`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE `regulated_category_control` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `status` ENUM('DISABLED', 'ENABLED') NOT NULL DEFAULT 'DISABLED',
  `company_qualification_snapshot` JSON NOT NULL,
  `company_qualification_valid_until` DATETIME(3) NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `enabled_at` DATETIME(3) NULL,
  `disabled_at` DATETIME(3) NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `regulated_category_control_category_key` (`category_id`),
  INDEX `regulated_category_control_company_status_idx` (`company_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `regulated_category_control_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `regulated_category_control_category_id_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `category`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `regulated_category_control_state_check` CHECK (
    (`status` = 'ENABLED' AND `enabled_at` IS NOT NULL AND `disabled_at` IS NULL
      AND `company_qualification_valid_until` IS NOT NULL)
    OR (`status` = 'DISABLED' AND `enabled_at` IS NULL)
  ),
  CONSTRAINT `regulated_category_control_version_check` CHECK (`version` >= 0)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `regulated_category_control_history` (
  `id` CHAR(36) NOT NULL,
  `control_id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `event` ENUM('ENABLE', 'DISABLE') NOT NULL,
  `version` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `request_id` CHAR(36) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `regulated_category_control_history_version_key` (`control_id`, `version`),
  INDEX `regulated_category_control_history_company_time_idx` (`company_id`, `occurred_at`),
  INDEX `regulated_category_control_history_category_time_idx` (`category_id`, `occurred_at`),
  INDEX `regulated_category_control_history_request_id_idx` (`request_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `regulated_category_control_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(180) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `regulated_category_control_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `regulated_category_control_insert_guard`
BEFORE INSERT ON `regulated_category_control`
FOR EACH ROW
BEGIN
  IF COALESCE((SELECT `company_id` FROM `category` WHERE `id` = NEW.`category_id`), '') <> NEW.`company_id`
    OR COALESCE((SELECT `level` FROM `category` WHERE `id` = NEW.`category_id`), 0) <> 3
    OR COALESCE((SELECT `status` FROM `category` WHERE `id` = NEW.`category_id`), '') <> 'ENABLED'
    OR EXISTS (SELECT 1 FROM `category` WHERE `parent_id` = NEW.`category_id` LIMIT 1)
    OR NOT EXISTS (
      SELECT 1 FROM `category_template`
      WHERE `category_id` = NEW.`category_id`
        AND `company_id` = NEW.`company_id`
        AND `status` = 'PUBLISHED'
        AND `regulatory_mode` = 'HIGH_RISK'
    ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGULATED_CATEGORY_TARGET_INVALID';
  END IF;
END;

CREATE TRIGGER `regulated_category_control_update_guard`
BEFORE UPDATE ON `regulated_category_control`
FOR EACH ROW
BEGIN
  IF NEW.`id` <> OLD.`id`
    OR NEW.`company_id` <> OLD.`company_id`
    OR NEW.`category_id` <> OLD.`category_id`
    OR NEW.`version` <> OLD.`version` + 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGULATED_CATEGORY_CONTROL_INVALID';
  END IF;
END;

CREATE TRIGGER `regulated_category_control_delete_guard`
BEFORE DELETE ON `regulated_category_control`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGULATED_CATEGORY_CONTROL_IMMUTABLE';

CREATE TRIGGER `regulated_category_control_history_immutable_update`
BEFORE UPDATE ON `regulated_category_control_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGULATED_CATEGORY_CONTROL_HISTORY_IMMUTABLE';

CREATE TRIGGER `regulated_category_control_history_immutable_delete`
BEFORE DELETE ON `regulated_category_control_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'REGULATED_CATEGORY_CONTROL_HISTORY_IMMUTABLE';
