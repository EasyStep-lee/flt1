-- MIG-002 continuation (M1-P005 slice): supplier identities and fixed functional accounts.
CREATE TABLE `functional_account_type` (
  `id` CHAR(36) NOT NULL,
  `owner_type` ENUM('COMPANY', 'SUPPLIER') NOT NULL,
  `code` VARCHAR(64) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `workspace_route` VARCHAR(255) NOT NULL,
  `internal_menu_schema` JSON NOT NULL,
  `status` ENUM('ACTIVE', 'DISABLED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `functional_account_type_owner_code_key`(`owner_type`, `code`),
  UNIQUE INDEX `functional_account_type_owner_route_key`(`owner_type`, `workspace_route`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `supplier_user` (
  `id` CHAR(36) NOT NULL,
  `supplier_id` CHAR(36) NOT NULL,
  `name` VARCHAR(128) NOT NULL,
  `mobile` VARCHAR(16) NOT NULL,
  `email` VARCHAR(254) NULL,
  `status` ENUM('INVITED', 'ACTIVE', 'LOCKED', 'SUSPENDED', 'REVOKED') NOT NULL DEFAULT 'INVITED',
  `last_login_at` DATETIME(3) NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `supplier_user_supplier_mobile_key`(`supplier_id`, `mobile`),
  INDEX `supplier_user_supplier_status_idx`(`supplier_id`, `status`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_user_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `functional_account` (
  `id` CHAR(36) NOT NULL,
  `identity_type` ENUM('COMPANY_USER', 'SUPPLIER_USER') NOT NULL,
  `identity_id` CHAR(36) NOT NULL,
  `owner_type` ENUM('COMPANY', 'SUPPLIER') NOT NULL,
  `company_id` CHAR(36) NULL,
  `supplier_id` CHAR(36) NULL,
  `account_type_id` CHAR(36) NOT NULL,
  `display_name` VARCHAR(128) NOT NULL,
  `status` ENUM('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'REVOKED') NOT NULL DEFAULT 'PENDING_ACTIVATION',
  `expires_at` DATETIME(3) NULL,
  `version` INTEGER NOT NULL DEFAULT 0,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `functional_account_supplier_identity_type_key`(`supplier_id`, `identity_id`, `account_type_id`),
  INDEX `functional_account_supplier_status_idx`(`supplier_id`, `status`),
  INDEX `functional_account_identity_idx`(`identity_type`, `identity_id`),
  PRIMARY KEY (`id`),
  CONSTRAINT `functional_account_supplier_id_fkey`
    FOREIGN KEY (`supplier_id`) REFERENCES `supplier`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `functional_account_identity_id_fkey`
    FOREIGN KEY (`identity_id`) REFERENCES `supplier_user`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `functional_account_account_type_id_fkey`
    FOREIGN KEY (`account_type_id`) REFERENCES `functional_account_type`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `functional_account_status_history` (
  `id` CHAR(36) NOT NULL,
  `functional_account_id` CHAR(36) NOT NULL,
  `from_status` ENUM('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'REVOKED') NULL,
  `to_status` ENUM('PENDING_ACTIVATION', 'ACTIVE', 'SUSPENDED', 'REVOKED') NOT NULL,
  `event` ENUM('INVITE', 'ACTIVATE', 'SUSPEND', 'RESTORE', 'REVOKE') NOT NULL,
  `actor_identity_id` CHAR(36) NOT NULL,
  `version` INTEGER NOT NULL,
  `occurred_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `functional_account_history_account_version_key`(`functional_account_id`, `version`),
  INDEX `functional_account_history_account_time_idx`(`functional_account_id`, `occurred_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `functional_account_history_account_id_fkey`
    FOREIGN KEY (`functional_account_id`) REFERENCES `functional_account`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

CREATE TABLE `functional_account_command` (
  `id` CHAR(36) NOT NULL,
  `scope` VARCHAR(128) NOT NULL,
  `idempotency_key` VARCHAR(128) NOT NULL,
  `request_hash` CHAR(64) NOT NULL,
  `response_snapshot` JSON NOT NULL,
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  UNIQUE INDEX `functional_account_command_scope_key`(`scope`, `idempotency_key`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;

INSERT INTO `functional_account_type`
  (`id`, `owner_type`, `code`, `name`, `workspace_route`, `internal_menu_schema`, `status`, `updated_at`)
VALUES
  ('10000000-0000-4000-8000-000000000001', 'SUPPLIER', 'SUPPLIER_ACCOUNT_ADMIN', '主体管理', '/supplier/workspaces/account-admin', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY('profile', 'accounts')), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000002', 'SUPPLIER', 'SUPPLIER_PRODUCT', '商品运营', '/supplier/workspaces/products', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY()), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000003', 'SUPPLIER', 'SUPPLIER_PRICING', '价格管理', '/supplier/workspaces/pricing', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY()), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000004', 'SUPPLIER', 'SUPPLIER_INVENTORY', '库存/仓库', '/supplier/workspaces/inventory', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY()), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000005', 'SUPPLIER', 'SUPPLIER_FULFILLMENT', '订单履约', '/supplier/workspaces/fulfillment', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY()), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000006', 'SUPPLIER', 'SUPPLIER_AFTERSALES', '售后', '/supplier/workspaces/aftersales', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY()), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000007', 'SUPPLIER', 'SUPPLIER_FINANCE', '财务对账', '/supplier/workspaces/finance', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY()), 'ACTIVE', CURRENT_TIMESTAMP(3)),
  ('10000000-0000-4000-8000-000000000008', 'SUPPLIER', 'SUPPLIER_AUDIT', '只读审计', '/supplier/workspaces/audit', JSON_OBJECT('version', '1.0', 'items', JSON_ARRAY()), 'ACTIVE', CURRENT_TIMESTAMP(3));

