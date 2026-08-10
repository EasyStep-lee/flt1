-- MIG-007 / M2-P013: classify immutable template versions without rewriting existing JSON snapshots.
ALTER TABLE `category_template`
  ADD COLUMN `profile` VARCHAR(32) NOT NULL DEFAULT 'GENERIC' AFTER `active_slot`,
  ADD CONSTRAINT `category_template_profile_check` CHECK (`profile` IN ('GENERIC', 'FOOD'));

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
      OR NEW.`profile` <> OLD.`profile`
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
