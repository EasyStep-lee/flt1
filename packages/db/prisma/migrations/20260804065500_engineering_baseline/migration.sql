-- MIG-001 establishes the product database encoding baseline.
-- Application and business timestamps remain UTC by explicit runtime convention.
ALTER DATABASE CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
