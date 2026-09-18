# How Truly works

Truly connects your phone, Nimiq wallet and Mac so learning can stay beside the real work. This guide explains the product as a learner or creator sees it. For implementation details, see the [architecture](ARCHITECTURE.md).

> The current competition build is a working testnet preview. Test NIM has no real-world value, and the macOS app is not yet a public signed download.

## Start a learning session

1. **Connect through Nimiq Pay.** Create or import a wallet inside Nimiq Pay, then choose the account you want Truly to use. Truly never asks for recovery words and does not accept a pasted address as proof of ownership.
2. **Pair your Mac.** Open Truly on the Mac, enter its short code from the Devices screen and approve the exact pairing request with your wallet.
3. **Choose what to learn.** Start a private Task from your own goal, or choose a creator-made Path.
4. **Continue on the Mac.** Select the paired Mac. If the companion is hidden, it stays hidden and a compact Task-ready notice appears instead.
5. **Learn beside the work.** Place the companion near anything visible. Type or speak a question; Truly can answer on screen or speak back.
6. **Check your work.** For a practice step, open the Task and choose **Check my work**. Truly assesses a fresh view against the saved visible criteria and updates progress only when every criterion is met.

## Tasks and Paths

### A Task starts with you

Describe an immediate goal, review the suggested steps and edit the plan before starting. The Task is private, free and owned by your connected wallet. Saved progress is available from the phone and paired Mac.

### A Path starts with a creator

A Path contains ordered steps, explanations, useful links, challenges and visible completion criteria. A creator can make it free or set a NIM price. Starting a Path creates your own progress-bearing Task while keeping the approved creator version unchanged.

## Paid Paths

Truly shows the Path version, exact NIM amount, network, creator and recipient before Nimiq Pay asks for approval. Nimiq Pay sends the transaction; Truly never handles wallet keys. Access is granted only after Truly Core independently verifies the settled transfer.

Nimiq Pay remains the source of truth for the complete wallet balance and transaction history. Truly shows only the Path payments and access it has validated itself.

## Create a Path

Any non-suspended Nimiq wallet can approve Creator Studio and create a public creator profile.

1. Open **Learn → Explore Paths → Create Path**.
2. Approve the creator sign-in. It cannot send money or publish without review.
3. Build a private draft with outcomes, requirements, tools, ordered steps, resources, practice goals and completion criteria.
4. Choose **Free** or **Paid with NIM**. NIM payments go to the creator’s verified wallet identity.
5. Preview the learner view, save, then submit the exact version for review.
6. An authorized reviewer exercises the Path and either publishes it or returns notes.

A private or rejected draft can be deleted from its editor. Submitted snapshots stay locked during review. An approved update creates a new version; learners already using the Path keep the version they started.

## What Truly can see

- A screen is captured only when you deliberately ask, complete an enabled voice question or choose **Check my work**.
- Truly does not keep a screenshot or microphone-recording history.
- Voice input is separately optional. Local wake listening pauses during spoken replies and starts paused after a restart.
- AI-checked progress is useful feedback, not certification. Hidden behavior or an unsupported claim is not enough to pass a visible practice step.
- Pairing, identity and payments remain explicit Nimiq Pay confirmations. Truly never asks for private keys or recovery words.

## Quick answers

**Can I connect by pasting an address?**  
No. Anyone can copy a public address. Truly lists only accounts shared by Nimiq Pay and requires wallet signatures when authority matters.

**Why is Truly’s wallet activity different from Nimiq Pay?**  
Nimiq Pay shows the complete wallet portfolio. Truly intentionally shows only its own validated Path payments and unlocks.

**Why can’t I edit or delete a submitted Path?**  
The reviewer must see the exact snapshot that could become public. If changes are requested, the creator can revise or delete the private draft.

**Does Truly control my Mac?**  
No. It can point to a visible area and suggest the next action, but you operate the keyboard, pointer, application and wallet.
