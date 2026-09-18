# Creator Studio

Creator Studio lets a Nimiq wallet turn useful know-how into a reviewed learning Path. Any non-suspended wallet can deliberately approve creator access, create a public profile and work privately until submission.

## Creator identity

Opening Creator Studio requests a purpose-bound wallet signature. Core verifies the challenge before granting creator scopes. This approval cannot send funds, publish content or grant review authority.

The public creator profile contains:

- display name;
- bio;
- optional avatar URL;
- public wallet-linked creator identifier;
- published Path library.

The NIM recipient is the verified creator wallet, not an editable payout field. Truly never asks for private keys or recovery words.

## Build a Path

A draft can define:

- title, link and summary;
- learner outcome and prerequisites;
- estimated time, difficulty, tags and supported tools;
- ordered steps and explanations;
- primary workspace links and supporting resources;
- practice goals and visible completion criteria;
- free access or a NIM price.

Steps and resources can be added, edited, removed and reordered. Drafts remain private and can be deleted while they are editable.

Submission requires the Path’s title, link, summary, description, subject, language, at least one outcome, at least one tool or environment, and at least one complete step. Every submitted step needs a title, instructions, a concrete practice challenge and visible completion criteria. Prerequisites, starting links, resources and hints are optional.

## Preview and submit

Preview uses the learner-facing Path layout so the creator can inspect the outcome, access terms and full sequence before submission.

Submitting locks an exact saved revision. That snapshot cannot be changed during review, which ensures the reviewer evaluates the same content that could become public.

If required content is missing, Creator Studio keeps the draft editable and names the missing fields beside **Submit for review**. Successful submission is confirmed in the same place and changes the draft to **In review** before it can appear in the reviewer queue.

## Wallet-authenticated review

Review authority comes from a server-owned wallet allowlist. An authorized wallet approves a separate review challenge, then receives short-lived scopes for the review queue. Creator status alone never grants reviewer access.

A reviewer can:

1. open the exact submitted learner preview;
2. inspect the outcome, resources, instructions and completion criteria;
3. approve the revision for publication; or
4. reject it with notes for the creator.

Core checks the reviewer scope and live server allowlist for every queue read and decision. Approval publishes the locked revision and stores the public reviewer identity and decision atomically.

## Versions protect learners

Publication never mutates an existing learner’s plan. Starting a Path creates a wallet-owned Task pinned to that approved Path version and its free-or-paid access snapshot.

When a creator edits a published Path, the submitted update becomes a new version. New learners receive the latest approved version; existing learners keep the one they started.

## Free and paid access

A creator may publish for free or set a NIM price. A paid listing shows the version, amount, network, creator and recipient before Nimiq Pay requests native approval.

Publication and checkout are separate authorities. Truly Core still resolves the active approved version and creator recipient, prepares an immutable order and independently verifies the finalized NIM transfer before granting access.

Approval pins the creator’s signed Nimiq address and exact price into that Path version. NIM goes directly to the creator; there is no shared marketplace receiving wallet. A later update cannot change an already prepared order. Checkout also requires the global NIM payment switch to be enabled. USDT is not available.

## Connect or switch wallets

**Connect wallet** requests access through Nimiq Pay and immediately connects the primary returned account; there is no redundant address-list screen. The current Nimiq Mini App provider can list several addresses, but `sign(message)` has no address parameter, so Truly cannot safely present those additional addresses as separately signable identities.

**Wallet & access → Reconnect wallet** ends the current Truly session and refreshes the primary signer exposed by Nimiq Pay. It does not claim to change Nimiq Pay's active signer. Changing the primary signer requires a host capability or account change inside Nimiq Pay; Truly never substitutes a visible but non-signing address. Purchases, Tasks and paired Macs remain attached to their original wallet owner.

Related documentation:

- [Product guide](PRODUCT-GUIDE.md)
- [Architecture](ARCHITECTURE.md)
- [Privacy](PRIVACY.md)
