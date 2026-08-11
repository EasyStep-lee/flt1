-- MIG-008 / M2-P014: enable FRESH as a new immutable template profile without rewriting history.
ALTER TABLE `category_template`
  DROP CHECK `category_template_profile_check`,
  ADD CONSTRAINT `category_template_profile_check`
    CHECK (`profile` IN ('GENERIC', 'FOOD', 'FRESH'));
