ALTER TABLE `welfare_card_ledger`
  ADD CONSTRAINT `welfare_card_ledger_refund_business_check`
    CHECK (
      (`refund_id` IS NULL AND `business_type` <> 'REFUND') OR
      (`refund_id` IS NOT NULL AND `business_type` = 'REFUND' AND `direction` = 'CREDIT')
    ),
  ADD CONSTRAINT `welfare_card_ledger_refund_fkey`
    FOREIGN KEY (`refund_id`) REFERENCES `refund_transaction`(`id`)
    ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD UNIQUE INDEX `welfare_card_ledger_refund_business_key` (`refund_id`, `business_type`);
