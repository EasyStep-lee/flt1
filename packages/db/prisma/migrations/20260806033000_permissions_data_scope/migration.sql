-- MIG-003 (M1-P046): default-deny permissions, data scopes, and field access.
CREATE TABLE `permission` (
  `id` CHAR(36) NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `resource` VARCHAR(128) NOT NULL,
  `action` ENUM('READ', 'CREATE', 'UPDATE', 'SUBMIT', 'APPROVE', 'REJECT', 'EXPORT', 'REVEAL', 'MANAGE', 'REVOKE') NOT NULL,
  `field_group` VARCHAR(128) NULL,
  `risk_level` INTEGER NOT NULL,

  UNIQUE INDEX `permission_code_key`(`code`),
  PRIMARY KEY (`id`),
  CONSTRAINT `permission_risk_level_check` CHECK (`risk_level` >= 0 AND `risk_level` <= 3)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `functional_account_permission` (
  `id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `permission_id` CHAR(36) NOT NULL,
  `effect` ENUM('ALLOW', 'DENY') NOT NULL,

  UNIQUE INDEX `functional_account_permission_account_permission_key`(`functional_account_id`, `permission_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `functional_account_permission_account_id_fkey`
    FOREIGN KEY (`functional_account_id`) REFERENCES `functional_account`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `functional_account_permission_permission_id_fkey`
    FOREIGN KEY (`permission_id`) REFERENCES `permission`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `data_scope_policy` (
  `id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `scope_type` ENUM('COMPANY', 'SUPPLIER', 'SELF', 'RESOURCE_SET') NOT NULL,
  `scope_rules` JSON NOT NULL,

  UNIQUE INDEX `data_scope_policy_account_key`(`functional_account_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `data_scope_policy_account_id_fkey`
    FOREIGN KEY (`functional_account_id`) REFERENCES `functional_account`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `field_access_policy` (
  `id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `resource` VARCHAR(128) NOT NULL,
  `field_group` VARCHAR(128) NOT NULL,
  `access_mode` ENUM('HIDDEN', 'MASKED', 'VISIBLE', 'VISIBLE_WITH_AUDIT', 'APPROVED_EXPORT_ONLY') NOT NULL DEFAULT 'HIDDEN',

  UNIQUE INDEX `field_access_policy_account_resource_group_key`(`functional_account_id`, `resource`, `field_group`),
  PRIMARY KEY (`id`),
  CONSTRAINT `field_access_policy_account_id_fkey`
    FOREIGN KEY (`functional_account_id`) REFERENCES `functional_account`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TRIGGER `data_scope_policy_supplier_insert_guard`
BEFORE INSERT ON `data_scope_policy`
FOR EACH ROW
BEGIN
  IF NEW.`scope_type` = 'SUPPLIER' AND (
    COALESCE(JSON_TYPE(JSON_EXTRACT(NEW.`scope_rules`, '$.supplierId')), '') <> 'STRING'
    OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(NEW.`scope_rules`, '$.supplierId')), '') <>
      COALESCE((SELECT `supplier_id` FROM `functional_account` WHERE `id` = NEW.`functional_account_id`), '')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DATA_SCOPE_SUPPLIER_FORBIDDEN';
  END IF;
END;

CREATE TRIGGER `data_scope_policy_supplier_update_guard`
BEFORE UPDATE ON `data_scope_policy`
FOR EACH ROW
BEGIN
  IF NEW.`scope_type` = 'SUPPLIER' AND (
    COALESCE(JSON_TYPE(JSON_EXTRACT(NEW.`scope_rules`, '$.supplierId')), '') <> 'STRING'
    OR COALESCE(JSON_UNQUOTE(JSON_EXTRACT(NEW.`scope_rules`, '$.supplierId')), '') <>
      COALESCE((SELECT `supplier_id` FROM `functional_account` WHERE `id` = NEW.`functional_account_id`), '')
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'DATA_SCOPE_SUPPLIER_FORBIDDEN';
  END IF;
END;
