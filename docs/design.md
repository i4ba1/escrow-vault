# EscrowVault — Design System v2

> Status: **approved spec pending implementation** · replaces the v1 look
> (stone/emerald, dark hero + light portal) · grounded in 2026 B2B/SaaS UI
> practice: calm density (Linear), quiet chrome (Vercel/Stripe), color
> reserved for meaning, token-based theming (shadcn convention).

## 1. Why the current UI reads "templated"

An honest diagnosis of what reviewers saw in the v1 screenshots:

1. **Two apps in one product.** The dark stone-950 landing plus light stone
   portal felt stitched together. The landing read "marketing template", the
   portal read "admin template", and nothing tied them except a green.
2. **Muddy neutrals.** `stone` walls + white cards + emerald buttons + orange
   chart slices = four competing palettes. Nothing felt deliberate.
3. **Card-heavy, chrome-heavy.** Every block wrapped in a bordered white card
   with shadows; padding everywhere; density near zero. 2026 dashboards flip
   this: thin 1px dividers, tight rows, hierarchy from type and spacing.
4. **Decoration where data should be.** Colored stat cards, a doughnut for
   four numbers, rainbow badges for every status. Color should *mean* things
   (fail/pass/draft), not *fill* space.
5. **Default-shaped everything.** Rounded-xl cards, mid-gray borders,
   center-aligned hero — the visually neutral "AI-generated dashboard" look.

## 2. Direction

**"Calm density" — the Linear/Vercel look, adapted for escrow.** One dark
surface, near-monochrome, one accent, status colors only where they carry
meaning, tables first, charts last. The trust story of escrow is precision —
the UI should feel like a vault terminal, not a startup landing page.

Three pillars:

| Pillar | Rule | Killed pattern from v1 |
|---|---|---|
| **Dark-first, one world** | The portal *is* dark; the landing shares the exact same surface, so product and marketing read as one product | separate hero theme |
| **Color = state only** | Neutral zinc surfaces everywhere; emerald/amber/rose appear *only* in status pills, deltas and risk indicators | orange doughnut slices, colored stat cards |
| **Density with hierarchy** | 44–48px table rows, 12–16px card padding, borders `1px` at low contrast; scale = type weight & spacing, not borders & shadows | rounded-xl + shadow-sm card grid |

## 3. Tokens (OKLCH, shadcn semantic convention)

One palette, dark is the default, light is a later derived theme. Defined as
CSS variables in `globals.css` under `:root` (+ `.dark` reserved); utilities
come from `@theme inline` mapping so `bg-surface`, `text-muted`,
`border-line` etc. are first-class Tailwind classes.

```css
:root {
  /* surfaces — zinc-950 family, slightly blue-cool */
  --bg-app:      oklch(0.145 0.005 260);  /* app background      */
  --bg-panel:    oklch(0.185 0.006 260);  /* panels, sidebar     */
  --bg-raise:    oklch(0.225 0.007 260);  /* hover, active rows  */

  /* text */
  --tx-hi:       oklch(0.955 0.002 260);  /* primary text        */
  --tx-mid:      oklch(0.72  0.004 260);  /* secondary, labels   */
  --tx-lo:       oklch(0.52  0.004 260);  /* hints, timestamps   */

  /* lines & focus */
  --line:        oklch(0.28  0.007 260);  /* 1px borders         */
  --line-strong: oklch(0.36  0.008 260);  /* hover borders       */
  --ring:        oklch(0.80  0.13 165);   /* focus, accent links */

  /* the one accent + status trio */
  --accent:      oklch(0.80  0.13 165);   /* emerald — brand + CTA   */
  --ok:          oklch(0.78  0.15 155);
  --warn:        oklch(0.82  0.14 85);
  --bad:         oklch(0.70  0.19 15);

  /* chart palette: 2 series max per chart */
  --chart-1:     oklch(0.80  0.13 165);
  --chart-2:     oklch(0.60  0.02 260);
}
```

Usage rules (these make the palette feel intentional):

- Every surface is one of the three `--bg-*`; no white cards anywhere.
- Text is ≥ `--tx-mid` unless it's a hint (`--tx-lo`) — never mid-grays in between.
- Accent (#emerald, reused as `--ring`) appears in exactly four places:
  primary CTA (filled), active nav item, links, focus ring. Nowhere else.
- Status colors appear only inside `badge` pills and chart series. Never as
  text color on its own line, never as backgrounds larger than a pill.

## 4. Typography & rhythm

Geist stays (already loaded, and it is *the* Linear/Vercel face).

| Role | Spec | Example |
|---|---|---|
| Page title | `text-[15px] font-medium` — pages are titled like rows, not posters | "Deposits" |
| Section label | `text-xs uppercase tracking-wider text-tx-lo font-medium` | "OPEN RUNS" |
| Body/data | `text-[13px]`; secondary `text-[13px] text-tx-mid` | table cells |
| Numbers | `font-mono tabular-nums` always — ids, hashes, sizes, dates, counts | "v2", `CERT-2026-0006` |
| Stat value | mono, `text-2xl font-medium` — no 3xl poster numbers | "6" |

Rhythm: `4px` base grid. Page container `max-w-7xl`, page padding `px-6 py-5`,
section gap `16px`, in-panel gap `12px`. Radius: `6px` panels/buttons,
`999px` pills, nothing rounder.

## 5. Components (target: ~10 primitives)

Replaces `components/ui.tsx` v1 set 1:1 (same names, new specs) so the page
migration is mechanical:

| Component | Spec |
|---|---|
| `PageHeader` | title row: `15px` medium title left, `text-tx-lo` count/hint next to it, actions right; **no** `sub` paragraph under title |
| `Panel` (was Card) | `rounded-[6px] border border-line bg-panel`; header inside: `text-xs uppercase tracking-wider text-tx-lo` label + optional right action; padding `p-4` |
| `btn` variants | `default` = ghost (border line, hover raise) · `primary` = accent filled, **one per screen** · `danger`/`success` = solid status colors only for genuinely destructive/committing steps · height `32px`, radius `6px` |
| `badge` (pill) | translucent: `bg-{color}/12 text-{color} border border-{color}/25`; 11px mono; tones: emerald (active/pass), amber (pending), rose (fail), zinc (draft/neutral), sky (info) |
| Table (`data-table`) | rows `h-11`, dividers `border-line` (not 100), header row = section-label style, row hover `bg-raise`; link cells `text-tx-hi hover:text-accent` (no underline until hover) |
| `EmptyState` | centered `text-tx-lo`, one line, optional single ghost action — no dashed box |
| `StatTile` | label (section-label style) over mono value; **no border** — tiles sit inside one panel, separated by `border-line` dividers |
| `KeyValue` | two-column rows for detail pages: `KeyVal` label left `tx-lo`, value right `tx-hi`, mono when an id/hash |
| `Timeline` | audit: 24px vertical line `--line`, dots 6px, compact two-line rows |
| `Nav` | sidebar `bg-panel`: logo mark + tenant, nav rows `h-9`, active = `bg-raise` + left 2px accent bar (not a filled pill), user card bottom with plain sign-out link |

No icons except: collapsed-sidebar chevrons, external-link arrow, and the
sign-out glyph. Typography carries hierarchy; icons are not decoration.

## 6. Screen-by-screen spec

Same information architecture (proven in the flows), new presentation.

- **Landing** — same dark surface as portal (`--bg-app`), no hero gradient.
  Top: logo left, "Open portal" ghost + "Verify certificate" text link right.
  Center-left column, max-w-2xl: label `ESCROW, OPERATED LIKE SOFTWARE`
  · headline `text-3xl font-medium` one sentence · one paragraph `text-tx-mid`
  · two CTAs max. Below the fold: the three-step explanation as a plain three
  column grid of label+text (no boxes, no 01-02-03 numerals). Footer strip:
  live serial lookup input + link. Zero illustration, zero rounded Card grid.
- **Portal overview** — replaces stat cards + doughnut: one `Panel` with a
  4-column `StatTile` row (Agreements / Deposits / Certificates / Open runs,
  mono values); right beside it an activity panel (latest 8 audit events as a
  compact list). Charts drop to: *one* bar (verification outcomes by tier,
  chart-1/chart-2 colors, 1px grid lines). No doughnut.
- **Deposits / Verification / Releases (lists)** — single `Panel` per page,
  `data-table` inside, `badge` status col right-aligned, dates in mono
  `YYYY-MM-DD`. Filters omitted until asked for (calm default).
- **Deposit detail** — header row: version + status pill; body split into two
  panels: "Assets" table (mono hashes truncated, scan badge last col) and
  "Verification" as a compact ladder (each tier: badge → timestamp → serial
  link, not card list). Actions as a right-column rail: Activate / Escalate
  (primary), upload control inline in Assets panel footer.
- **Run detail** — checks as rows (label + PASS/FAIL pill + one-line detail),
  not boxes; certificate strip only when issued (serial in mono + link).
- **Release detail** — `KeyValue` master block (filing facts), evidence as
  plain text rows, then the single allowed action panel for the current
  role+state (maker-checker note as one `tx-lo` line, not a callout box).
- **Audit** — `Timeline` component; group by day (`text-tx-lo` date headers),
  rows: ACTION (semibold 13px) + entity + actor, all on one line each.
- **Public certificate** — stays dark page; content becomes a centered
  `Panel` on `--bg-app`, serial mono 20px, `KeyValue` rows; QR-code sized
  second panel optional later. No royal look, more like a Linear ticket.

## 7. Charts (Chart.js)

- Single accent for "Passed", `--chart-2` (neutral) for "Failed"; background
  transparent; grid lines `--line` at 40% opacity; ticks `--tx-lo` 11px mono.
- Tooltips restyled to panel surface. Legend hidden when self-evident.
- Chart height fixed `160px` — charts inform, they don't headline.

## 8. Motion & interaction

- Transitions only on color/background/border-color, `120ms ease-out`.
- No page transitions, no entrance animations, no pulsing skeletons — loading
  states are `animate-pulse` on text-level placeholders only.
- Focus ring everywhere via `--ring` at 2px offset 1 — keyboard-first polish.

## 9. Accessibility guardrails

- Contrast: `--tx-mid` on `--bg-panel` ≥ 4.5:1; badges pass at 12px because
  they are bold + tracked (verified per tone during implementation).
- Status is never color-only: every pill carries its text label; PASS/FAIL
  checks show the word, not just a tint.
- Hit targets ≥ 32px; tables keep row links with full-row click zone.

## 10. Implementation plan (4 commits, each verifiable)

1. **tokens** — `globals.css` v2 (palette above, `@theme inline` mapping,
   component classes rebuilt: panel/btn/badge/data-table), `components/ui.tsx`
   rewritten to the §5 spec behind the same component names.
2. **shell** — `portal/layout.tsx` + `nav.client.tsx` per §5 Nav; landing
   (`page.tsx`) + public certificate per §6.
3. **screens** — overview, lists, details, audit per §6; dashboard client per
   §7 (one bar chart, StatTiles, activity list).
4. **re-record** — seeded-data GIF against the new look; README Demo refresh.

Guardrails for the PR: no typography outside §4, no colors outside §3, no
new components outside §5. Every page must survive `pnpm lint`, unit, build,
e2e before each commit.

## 11. Rejected alternatives (and why)

- **Light Stripe-quiet theme** — beautiful, but reads "finance back-office";
  the reviewer persona (forward-deployed dev teams) sees Linear daily; dark
  is the 2026 power-tool default and makes escrow state colors pop.
- **shadcn/ui adoption now** — right long-term primitives, but importing a
  component library mid-build churns every file in one diff; the §3–5 spec
  delivers the same visual outcome with the ~10 primitives we already own.
  Revisit when components outgrow these ~10 (command palette, dialogs).
- **Glassmorphism / gradient meshes** — dates the portfolio fast; the calm
  pill from the trend research exists precisely to reject these.
