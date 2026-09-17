-- Claims bind conditional mutations to the winning request inside a D1 batch.
ALTER TABLE pairing_challenges ADD COLUMN approval_claim TEXT;
ALTER TABLE pairing_challenges ADD COLUMN exchange_claim TEXT;
