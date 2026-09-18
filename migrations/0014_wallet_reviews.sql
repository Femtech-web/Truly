-- Existing operator receipts remain intact; new wallet reviews record their actor.
ALTER TABLE creator_reviews ADD COLUMN reviewer_wallet TEXT;
