-- MIG-005 / M2-P011: protected three-level category tree without category-template scope.
CREATE TABLE `category` (
  `id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `parent_id` CHAR(36) NULL,
  `parent_scope_key` CHAR(36) NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `level` INTEGER NOT NULL,
  `sort_weight` INTEGER NOT NULL,
  `status` ENUM('ENABLED', 'DISABLED') NOT NULL DEFAULT 'ENABLED',
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `category_company_parent_name_key` (`company_id`, `parent_scope_key`, `name`),
  INDEX `category_company_level_status_sort_idx` (`company_id`, `level`, `status`, `sort_weight`),
  INDEX `category_parent_sort_idx` (`parent_id`, `sort_weight`),
  PRIMARY KEY (`id`),
  CONSTRAINT `category_level_check` CHECK (`level` >= 1 AND `level` <= 3),
  CONSTRAINT `category_company_id_fkey`
    FOREIGN KEY (`company_id`) REFERENCES `company`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `category_parent_id_fkey`
    FOREIGN KEY (`parent_id`) REFERENCES `category`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `category_history` (
  `id` CHAR(36) NOT NULL,
  `category_id` CHAR(36) NOT NULL,
  `company_id` CHAR(36) NOT NULL,
  `event` ENUM('CREATE', 'UPDATE', 'MOVE', 'ENABLE', 'DISABLE', 'DELETE') NOT NULL,
  `version` INTEGER NOT NULL,
  `snapshot` JSON NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `request_id` CHAR(36) NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `category_history_category_version_key` (`category_id`, `version`),
  INDEX `category_history_company_time_idx` (`company_id`, `occurred_at`),
  INDEX `category_history_request_id_idx` (`request_id`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `category_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(160) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `category_command_scope_key` (`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `category_parent_insert_guard`
BEFORE INSERT ON `category`
FOR EACH ROW
BEGIN
  IF (NEW.`level` = 1 AND (NEW.`parent_id` IS NOT NULL OR NEW.`parent_scope_key` <> '00000000-0000-0000-0000-000000000000'))
    OR (NEW.`level` > 1 AND (
      NEW.`parent_id` IS NULL
      OR NEW.`parent_scope_key` <> NEW.`parent_id`
      OR COALESCE((SELECT `company_id` FROM `category` WHERE `id` = NEW.`parent_id`), '') <> NEW.`company_id`
      OR COALESCE((SELECT `level` FROM `category` WHERE `id` = NEW.`parent_id`), 0) <> NEW.`level` - 1
    )) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_PARENT_INVALID';
  END IF;
END;

CREATE TRIGGER `category_parent_update_guard`
BEFORE UPDATE ON `category`
FOR EACH ROW
BEGIN
  IF NEW.`company_id` <> OLD.`company_id` OR NEW.`level` <> OLD.`level`
    OR (NEW.`level` = 1 AND (NEW.`parent_id` IS NOT NULL OR NEW.`parent_scope_key` <> '00000000-0000-0000-0000-000000000000'))
    OR (NEW.`level` > 1 AND (
      NEW.`parent_id` IS NULL
      OR NEW.`parent_scope_key` <> NEW.`parent_id`
      OR NEW.`parent_id` = NEW.`id`
      OR COALESCE((SELECT `company_id` FROM `category` WHERE `id` = NEW.`parent_id`), '') <> NEW.`company_id`
      OR COALESCE((SELECT `level` FROM `category` WHERE `id` = NEW.`parent_id`), 0) <> NEW.`level` - 1
    )) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_PARENT_INVALID';
  END IF;
END;

CREATE TRIGGER `category_reference_delete_guard`
BEFORE DELETE ON `category`
FOR EACH ROW
BEGIN
  IF EXISTS (SELECT 1 FROM `category` WHERE `parent_id` = OLD.`id` LIMIT 1)
    OR EXISTS (SELECT 1 FROM `supplier_product` WHERE `category_id` = OLD.`id` LIMIT 1)
    OR EXISTS (SELECT 1 FROM `product` WHERE `category_id` = OLD.`id` LIMIT 1) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_REFERENCED';
  END IF;
END;

CREATE TRIGGER `category_history_immutable_update`
BEFORE UPDATE ON `category_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_HISTORY_IMMUTABLE';

CREATE TRIGGER `category_history_immutable_delete`
BEFORE DELETE ON `category_history`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'CATEGORY_HISTORY_IMMUTABLE';
