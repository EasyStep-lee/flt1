-- MIG-002 (M1-P001 slice): the only customer-facing merchant company.
CREATE TABLE `company` (
  `id` CHAR(36) NOT NULL,
  `legal_name` VARCHAR(128) NOT NULL,
  `platform_name` VARCHAR(64) NOT NULL,
  `wechat_pay_config_ref` VARCHAR(255) NOT NULL,
  `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
  `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updated_at` DATETIME(3) NOT NULL,

  UNIQUE INDEX `company_legal_name_key`(`legal_name`),
  UNIQUE INDEX `company_platform_name_key`(`platform_name`),
  CONSTRAINT `chk_company_legal_name`
    CHECK (`legal_name` = '江苏福礼团供应链科技有限公司'),
  CONSTRAINT `chk_company_platform_name`
    CHECK (`platform_name` = '福礼社'),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
