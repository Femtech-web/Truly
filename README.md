# Truly

**Learn anything. By doing it.**

Truly is a screen-aware AI learning companion that explains visible work, guides one action at a time, and checks the learner's attempt. Nimiq Pay connects wallet identity, desktop pairing, paid Skills, and synchronized progress.

## Product surfaces

- **Desktop companion:** the macOS learning experience beside the cursor.
- **Nimiq Pay Mini App:** wallet identity, pairing, Skill purchase, devices, and progress.
- **Website:** the public story, desktop download, privacy explanation, and Mini App deep link.
- **Truly Core:** the API for AI proxying, pairing, entitlements, and progress.

The website is a supporting distribution surface. The competition's core product remains the end-to-end Desktop + Mini App learning loop.

## Status

- Phase 0: repository foundation established.
- Website foundation: implemented, interaction-tested, and production-build verified.
- Desktop: the original Truly capture → response → pointer slice is implemented and ready for its first Xcode permission run.
- Mini App: the Phase 3 Nimiq provider tracer bullet and product shell are implemented; real Nimiq Pay phone verification remains.
- A real Nimiq Pay account approval and one signed Mac pairing have passed on the user's devices; rejection, restart persistence and revocation still need acceptance. Core/D1 pairing, catalog, device ownership and abuse controls are implemented. Phase 5A connects desktop Ask to an authenticated, per-frame-consent, bounded Groq vision endpoint with validated pointer targets, but live-model Xcode acceptance, rubric evaluation and durable progress remain open. NIM/USDT checkout and Creator Studio publishing remain unimplemented. This is not yet the completed first release.

The roadmap supports both NIM and USDT and reviewed creator publishing across subjects. See [product vision](docs/PRODUCT-VISION.md) and [Core setup](worker/README.md).

## Repository map

```text
apps/
  desktop/       macOS Truly companion
  miniapp/       React + TypeScript Mini App for Nimiq Pay
  site/          public desktop landing and download website
worker/          Cloudflare Worker and Truly Core API
packages/
  contracts/     shared API schemas and generated types
  design-tokens/ shared brand colors, type, spacing, and motion values
  skill-schema/  versioned interactive Skill format
migrations/      durable data migrations
docs/            public architecture, privacy, and setup guides
```

Private product and delivery notes live in the ignored `private-notes/` directory on the development machine.

## License

Truly is released under the [MIT License](LICENSE).
