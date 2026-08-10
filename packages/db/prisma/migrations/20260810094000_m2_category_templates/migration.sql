-- MIG-006 / M2-P012: append-only, versioned category templates for enabled leaf categories.
CREATE TABLE `category_template` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `version` INTEGER NOT NULL,
  `revision` INTEGER NOT NULL DEFAULT 0,
  `status` ENUM('DRAFT', 'PUBLISHED', 'RETIRED') NOT NULL DEFAULT 'DRAFT',
  `draft_slot` INTEGER NULL,
  `active_slot` INTEGER NULL,
  `field_schema` JSON NOT NULL,
  `sku_dimensions` JSON NOT NULL,
  `qualification_rules` JSON NOT NULL,
  `detail_modules` JSON NOT NULL,
  `after_sale_rules` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `published_at` DATETIME(3) NULL,
  `retired_at` DATETIME(3) NULL,

  UNIQUE INDEX `category_template_category_version_key` (`category_id`, `version`),
  UNIQUE INDEX `category_template_category_draft_key` (`category_id`, `draft_slot`),
  UNIQUE INDEX `category_template_category_active_key` (`category_id`, `active_slot`),
  INDEX `category_template_company_status_idx` (`company_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `category_template_slot_check` CHECK (
    (`status` = 'DRAFT' AND `draft_slot` = 1 AND `active_slot` IS NULL AND `published_at` IS NULL AND `retired_at` IS NULL)
    OR (`status` = 'PUBLISHED' AND `draft_slot` IS NULL AND `active_slot` = 1 AND `published_at` IS NOT NULL AND `retired_at` IS NULL)
    OR (`status` = 'RETIRED' AND `draft_slot` IS NULL AND `active_slot` IS NULL AND `published_at` IS NOT NULL AND `retired_at` IS NOT NULL)
  ),
  CONSTRAINT `category_template_version_check` CHECK (`version` >= 1 AND `revision` >= 0),
  CONSTRAINT `category_template_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `category_template_category_id_fkey`
    FOREIGN KEY (`category_id`) REFERENCES `category`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `category_template_history` (
  `id` CHAR(36) NOT NULL,
  `template_id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `event` ENUM('CREATE', 'UPDATE', 'PUBLISH', 'RETIRE') NOT NULL,
  `revision` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `request_id` CHAR(36) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `category_template_history_template_revision_event_key` (`template_id`, `revision`, `event`),
  INDEX `category_template_history_category_time_idx` (`category_id`, `occurred_at`),
  INDEX `category_template_history_company_time_idx` (`company_id`, `occurred_at`),
  INDEX `category_template_history_request_id_idx` (`request_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `category_template_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(180) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `category_template_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

ALTER TABLE `supplier_product`
  ADD CONSTRAINT `supplier_product_category_template_fkey`
  FOREIGN KEY (`category_id`, `template_version`)
  REFERENCES `category_template`(`category_id`, `version`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `product`
  ADD CONSTRAINT `product_category_template_fkey`
  FOREIGN KEY (`category_id`, `template_version`)
  REFERENCES `category_template`(`category_id`, `version`)
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TRIGGER `category_template_insert_guard`
BEFORE INSERT ON `category_template`
FOR EACH ROW
BEGIN
  IF NEW.`status` <> 'DRAFT'
    OR COALESCE((SELECT `company_id` FROM `category` WHERE `id` = NEW.`category_id`), '') <> NEW.`company_id`
    OR COALESCE((SELECT `level` FROM `category` WHERE `id` = NEW.`category_id`), 0) <> 3
    OR COALESCE((SELECT `status` FROM `category` WHERE `id` = NEW.`category_id`), '') <> 'ENABLED'
    OR EXISTS (SELECT 1 FROM `category` WHERE `parent_id` = NEW.`category_id` LIMIT 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_TEMPLATE_TARGET_INVALID';
  END IF;
END;

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

CREATE TRIGGER `category_template_delete_guard`
BEFORE DELETE ON `category_template`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_TEMPLATE_IMMUTABLE';

CREATE TRIGGER `category_template_history_immutable_update`
BEFORE UPDATE ON `category_template_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_TEMPLATE_HISTORY_IMMUTABLE';

CREATE TRIGGER `category_template_history_immutable_delete`
BEFORE DELETE ON `category_template_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_TEMPLATE_HISTORY_IMMUTABLE';
