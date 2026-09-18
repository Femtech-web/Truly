# How to use Truly

Truly connects a learner’s phone, Nimiq wallet and Mac so learning can stay beside the real work. This is the product-facing guide. For implementation details, see the [architecture](ARCHITECTURE.md).

> Paid NIM Paths use Nimiq Mainnet. Nimiq Pay shows the real-NIM amount and recipient before approval; USDT is not available.

## Connect your wallet

1. On your phone, open **Nimiq Pay**.
2. Open **Mini Apps**, then open **Truly**.
3. Tap **Connect** in the top-right.
4. Tap **Connect through Nimiq Pay**.
5. Approve the primary signing account shown by Nimiq Pay.

Truly receives the public address. It never asks for recovery words or private keys, and it does not treat a pasted address as proof of ownership.

## Pair your Mac

1. Launch Truly on the Mac.
2. Click the Truly ring-and-dot icon in the macOS menu bar.
3. Click **Settings…**.
4. Open **Connection**.
5. Click **Pair this Mac** and leave the six-character code visible. The code expires after five minutes.
6. On the phone, open Truly and tap **Devices** in the bottom navigation.
7. Type the same six-character code and tap **Verify code**.
8. Check the Mac name and system shown in the preview.
9. Tap **Approve and pair Mac**.
10. Approve the pairing signature in Nimiq Pay. This cannot move funds.
11. Return to Truly and confirm the Mac appears under **Connected Macs**.

## Start a private Task

1. On the phone, tap **Learn**.
2. Select **My Tasks** and tap **New Task**.
3. Describe one clear thing you want to learn or finish.
4. Review the suggested plan. Open the Task and choose **Edit plan** if any step should change.
5. Tap **Start on my Mac**.
6. Select the paired Mac that should receive the Task.
7. Wait for **Loaded in Truly on [Mac name]** before leaving the page.

## Start a creator Path

1. On the phone, tap **Learn**.
2. Select **Explore Paths** and open a Path.
3. Read the outcome, requirements, steps, creator and access terms.
4. Complete the NIM checkout first if the Path is paid.
5. Tap **Start or continue on my Mac**.
6. Select a paired Mac and wait for **Loaded in Truly on [Mac name]**.

A Path contains ordered steps, explanations, resources, practice challenges and visible completion criteria. Starting one creates the learner’s own progress-bearing Task without changing the approved creator version.

## Ask Truly with text

1. On the Mac, click the Truly menu-bar icon.
2. Set **Input** to **Text**.
3. Choose **Show companion** if the companion is hidden.
4. Drag the companion near the code, page, design or control you mean.
5. Click the companion, or click **Ask Truly** in the menu.
6. Type into **Ask about what you shared…** and press Return or click **Ask**.
7. Truly captures one fresh screen and writes the answer in the companion.

Text mode does not listen to the microphone. Truly does not keep watching the screen after the requested capture.

## Ask Truly with voice

1. Click the Truly menu-bar icon and set **Input** to **Voice**.
2. Allow Microphone and Speech Recognition if macOS asks.
3. Set **Reply** to **Text** for an on-screen answer or **Spoken** to hear it aloud.
4. If the menu says **Voice paused**, click **Resume**. The status changes to **Say ‘Hey Truly’**.
5. Say **“Hey Truly”**, wait for the listening cue, then say the full question.
6. Stop speaking. Truly finishes after the brief silence, writes down the question and sends one fresh screen with it.
7. Click **Pause** whenever wake listening should stop. Hiding the companion also stops it.

For one deliberate recording without the wake phrase, click **Record a question**, speak, then finish. Only that requested recording is sent for transcription.

## Check your work

Asking a question never completes a step. Assessment is a separate, deliberate action.

1. Complete the practice in your own browser, editor or application.
2. Keep the result readable on screen. Show your work, not only the instructions or a tutorial.
3. Click the Truly menu-bar icon and choose **Open Task**.
4. Read the current **Practice goal** and every visible completion criterion.
5. Arrange the screen so the evidence is visible, then click **Check my work**.
6. If Truly identifies missing evidence, correct the work and check again.
7. After a pass, open **Progress** on the phone and refresh if needed.
8. Confirm that the completed-step count increased.

AI-checked progress is useful feedback, not certification.

## Unlock a paid Path

1. Open the Path from **Learn → Explore Paths**.
2. Scroll to **Unlock this Path**.
3. Tap **Approve purchase access** and approve the short sign-in. This does not send NIM.
4. Tap **Review purchase**.
5. Check the Path version, seller, exact NIM amount, Mainnet network and recipient.
6. Tick the Mainnet confirmation and tap **Pay [amount] NIM**.
7. Approve the same amount and recipient in Nimiq Pay.
8. Return to Truly. If the transfer is pending, tap **Check payment**; do not pay again.
9. Continue after Truly shows **Path unlocked**.

Nimiq Pay remains the source of truth for the complete balance and transaction history. Truly records only the Path payments and access it independently validates.

## Create and publish a Path

1. Open **Learn → Explore Paths → Create Path**.
2. Tap **Approve Creator Studio** and approve the sign-in in Nimiq Pay. It is not a payment.
3. Add a public creator name and bio, then tap **Save profile**.
4. Tap **New Path**.
5. Complete the title, public Path link, summary, description, subject, language, duration, outcomes and tools or environments.
6. Tap **Add step**. Give every step instructions, a concrete practice challenge and visible completion criteria.
7. Add resources where useful. Use the arrow buttons to reorder steps or resources.
8. Select **Free** or **Paid with NIM**. Paid proceeds go to the verified wallet shown on the creator profile.
9. Tap **Save draft**, then **Preview**. Follow the whole route yourself.
10. Tap **Back to editor** to correct anything unclear.
11. Tap **Submit for review**. Fix any missing fields shown beside the action.
12. Confirm the Path changes to **In review**. The submitted revision stays private and locked until a reviewer approves it or requests changes.

A private or rejected draft can be deleted from its editor. An approved update creates a new version; learners already using the Path keep the version they started.

## What Truly can see

- A screen is captured only when the learner deliberately asks a screen-aware question, completes an enabled voice question or chooses **Check my work**.
- Truly does not keep a screenshot or microphone-recording history.
- Wake listening runs locally after **Resume** and stops with **Pause** or **Hide companion**.
- Pairing, identity and payments remain explicit Nimiq Pay confirmations.
- Truly never asks for private keys or recovery words.

## Fix common problems

### The pairing code was not found

Create a fresh code from **Mac menu icon → Settings… → Connection → Pair this Mac** and enter it within five minutes. If Settings says **Local development Core**, that code works only with a local Mini App using the same Core. The public Mini App needs the production Mac build.

### The Mac does not appear on the phone

Open **Devices** and tap **Approve Truly access** or **Refresh devices**. If needed, remove the old connection and pair again with a fresh code.

### The Mac did not show the Task

Return to the Task or Path on the phone, tap **Start or continue on my Mac**, select the Mac and wait for **Loaded in Truly on [Mac name]**. On the Mac, click the menu icon and choose **Open Task** or **Show companion**.

### Voice is listening but does not answer

Open the Truly menu and read the status under Voice. Confirm that a Task is active, the Mac is paired and **Settings… → Privacy → AI help** is allowed. Use **Record a question** to test transcription separately from the wake phrase. If Text mode also fails, the AI service is unavailable rather than the microphone.

### The wrong wallet signs an approval

Truly uses Nimiq Pay’s primary signing account. Open **Wallet & access → Reconnect wallet → Disconnect and reconnect**. Change the primary signer inside Nimiq Pay first if it still returns the old account.

### A payment remains pending

Return to the Path and tap **Check payment**. Do not create a second payment.

### Progress did not change

Questions do not complete steps. On the Mac, choose **Open Task → Check my work**, pass every visible criterion, then refresh **Progress** on the phone.
