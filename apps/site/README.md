# Truly website

The public product website for Truly Desktop and its connected Nimiq Pay experience.

## Local development

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build
```

The site is intentionally honest about product availability: it demonstrates the implemented native learning loop while reserving a public download until runtime testing is complete. It contains no wallet authority or product secrets.

Verified at desktop and phone breakpoints with working navigation and Explain, Guide, and Challenge interactions. `npm run build` is the release gate for this package.

## Source structure

- `src/App.tsx` composes the page without owning section implementation.
- `src/components/` contains one component per product section and shared UI primitives.
- `src/content/` owns typed product copy and interactive-demo data.
- `src/styles.css` is an import manifest.
- `src/styles/` separates tokens, foundations, individual product surfaces, motion, and responsive rules.

Motion is progressive enhancement: content remains visible without Intersection Observer support, and `prefers-reduced-motion` collapses animation durations.
