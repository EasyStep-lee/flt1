-- M1-P069: supplier one-functional-account login selection contexts.
CREATE TABLE `supplier_auth_selection` (
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

  UNIQUE INDEX `supplier_auth_selection_nonce_key`(`nonce_hash`),
  UNIQUE INDEX `supplier_auth_selection_user_request_key`(`user_id`, `request_id`),
  INDEX `supplier_auth_selection_user_expiry_idx`(`user_id`, `expires_at`),
  PRIMARY KEY (`id`),
  CONSTRAINT `supplier_auth_selection_nonce_hash_format_chk`
    CHECK (`nonce_hash` REGEXP '^[0-9a-f]{64}$'),
  CONSTRAINT `supplier_auth_selection_user_id_fkey`
    FOREIGN KEY (`user_id`) REFERENCES `supplier_user`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
