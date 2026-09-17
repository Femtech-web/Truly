# Truly Mini App

The mobile-first companion hosted inside Nimiq Pay. It owns wallet identity, the Core-backed Skill catalog, signed Mac pairing/control and the learner's explicit Skill-to-Mac handoff.

## Run locally

```bash
cd apps/miniapp
npm install
npm run dev -- --host
```

Open the terminal's **Network** URL inside Nimiq Pay on a phone connected to the same Wi-Fi network. Do not use `localhost` from the phone.

An ordinary browser can preview the read-only catalog and layout, but it cannot create a wallet identity. Account access, signatures, pairing and future payments require the real provider injected by Nimiq Pay; there is no demo-wallet route.

## Current behavior

- Initializes the Nimiq provider with `@nimiq/mini-app-sdk` and checks consensus readiness.
- Requests accounts only after the learner presses **Connect Nimiq wallet**.
- Keeps the app usable when the provider is unavailable or a request is rejected.
- Provides Home, Skills, full Skill detail, Devices, and an honest not-yet-connected Progress surface.
- Loads versioned curricula from Core with creator, tags, outcomes, prerequisites, supported environments, estimate and steps—not fixture activity.
- Looks up the Mac's expiring code and requests a real Nimiq signature for server approval. Preview wallets cannot sign.
- Uses a separate, explicit 15-minute Nimiq signature grant for device listing/revocation and learning-session activation; the grant cannot move funds and stays only in memory.
- Lets a learner start or continue a free executable Skill on one selected active Mac. Core validates ownership, device status, immutable version and entitlement, then creates/resumes the authoritative session for that desktop.
- NIM and USDT checkout remain disabled. Progress shows an empty state until verified learning exists.

Run Truly Core separately following `worker/README.md`. Set `VITE_TRULY_CORE_URL` in an ignored `.env` to the Mac's LAN API URL and allow the exact Vite origin on Core. Restart Vite when this configuration changes. Stop servers with Control–C after testing.

## Verify

```bash
npm run build
```

Phase 5B is accepted only after the LAN build is opened inside Nimiq Pay, a free Skill is activated on a real paired Mac, the selected Xcode app announces the same Skill/step without restart, and another or revoked device cannot receive it.
