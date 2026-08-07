-- M1-P069: serialize first-time supplier second verification across instances.
ALTER TABLE `supplier_auth_selection`
  ADD COLUMN `second_verification_claim_id` CHAR(36) NULL AFTER `second_verification_required`,
  ADD COLUMN `second_verification_claimed_at` DATETIME(3) NULL AFTER `second_verification_claim_id`,
  ADD COLUMN `second_verified_at` DATETIME(3) NULL AFTER `second_verification_claimed_at`,
  ADD CONSTRAINT `supplier_auth_selection_second_verification_claim_pair_chk`
    CHECK (
      (`second_verification_claim_id` IS NULL AND `second_verification_claimed_at` IS NULL)
      OR
      (`second_verification_claim_id` IS NOT NULL AND `second_verification_claimed_at` IS NOT NULL)
    ),
  ADD CONSTRAINT `supplier_auth_selection_second_verification_claim_id_chk`
    CHECK (
      `second_verification_claim_id` IS NULL
      OR `second_verification_claim_id` REGEXP '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
    ),
  ADD CONSTRAINT `supplier_auth_selection_second_verified_account_chk`
    CHECK (
      `second_verified_at` IS NULL
      OR (
        `selected_account_id` IS NOT NULL
        AND `second_verification_claim_id` IS NULL
        AND `second_verification_claimed_at` IS NULL
      )
    );
