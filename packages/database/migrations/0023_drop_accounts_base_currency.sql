-- The product is NSE/BSE cash equity only, so every account settles in INR.
-- The column was written as 'INR' and only echoed back to the UI.

ALTER TABLE accounts DROP COLUMN IF EXISTS base_currency;
