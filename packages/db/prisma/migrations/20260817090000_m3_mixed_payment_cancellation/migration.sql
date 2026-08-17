-- MIG-012C / M3-P057: append-only payment uncertainty and cancellation audit events.
ALTER TABLE `buyer_order_event`
  DROP CHECK `buyer_order_event_lifecycle_check`,
  MODIFY `event` ENUM(
    'CREATED',
    'PAYMENT_CONFIRMED',
    'PAYMENT_UNKNOWN',
    'PAYMENT_CANCELLED',
    'REMITTANCE_SUBMITTED',
    'REMITTANCE_CONFIRMED',
    'REMITTANCE_REJECTED'
  ) NOT NULL;

ALTER TABLE `buyer_order_event`
  ADD CONSTRAINT `buyer_order_event_lifecycle_check` CHECK (
    (`event` = 'CREATED' AND `from_status` IS NULL AND `to_status` = 'PENDING_PAYMENT' AND `version` = 0)
    OR (`event` = 'PAYMENT_CONFIRMED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PAID' AND `version` > 0)
    OR (`event` = 'PAYMENT_UNKNOWN' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PENDING_PAYMENT' AND `version` > 0)
    OR (`event` = 'PAYMENT_CANCELLED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'CANCELLED' AND `version` > 0)
    OR (`event` = 'REMITTANCE_SUBMITTED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PENDING_PAYMENT' AND `version` > 0)
    OR (`event` = 'REMITTANCE_CONFIRMED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PAID' AND `version` > 0)
    OR (`event` = 'REMITTANCE_REJECTED' AND `from_status` = 'PENDING_PAYMENT' AND `to_status` = 'PENDING_PAYMENT' AND `version` > 0)
  );
