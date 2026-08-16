# Agent Note: MagicUI-style Web client polish

Status: implemented

English | [中文](2026-08-16-magicui-style-web-client-polish.zh.md)

## Problem

The Web client shipped flat, mostly static surfaces: entrance states jumped in, interactive cards changed color with no transition, primary actions gave no tactile feedback, and the empty-state hero was plain. DeepSeek Chat's MagicUI-style treatment — ambient grid backdrops, sheen borders and light sweeps, soft glow shadows, entrance and stagger motion, number tickers — reads as a more polished product, but the repo styling contract (CSS Modules + clsx, no component library, no Tailwind, tokens-only colors) rules out porting MagicUI's Tailwind components wholesale, and animation added to presentation risks destabilizing committed aria goldens and ignoring the OS reduced-motion preference.

## Decision

**Port the MagicUI motifs into per-component CSS Modules.** Ambient grid and dot backdrops (`HeroShell`, `OnboardingModal`), sheen borders (`InputBar`) and diagonal light sweeps (`Button.primary`, `ModelsSection.rowCard`, `PluginInventorySettingsTab.card`, `SidebarRoot.newSession`, `ToolRow`), glow shadows on hover, selected, and running states (`ChatView.toBottom`, `TerminalBlock`, `TrajectoryCell`, `WorkflowRunPanel`, `GoalBar`, `Rows`, `PlanReviewPanel`), and entrance and stagger animations (`PopupSelectView`, `MessageItem`, `StatsLine`, `QueueDock`, `TodoPanel`, `ModelSelect`, `SubagentCatalogAction`) are hand-ported over shared `--dsw-*` tokens, with `color-mix()` deriving tints from existing tokens. No literal colors, no Tailwind, no new dependency — the [web-styling system](../process/2026-07-19-web-styling-system.md) ruling stays in force.

**Number ticker as a small framework hook.** `useAnimatedNumber` in `ui-primitives` animates a numeric value with rAF and cubic ease-out, resumes from the currently displayed value on each target change, renders the target immediately on first mount, and honors `prefers-reduced-motion: reduce` plus an explicit `disabled`. `ContextMeter` animates the percentage ring and reading. The stats strip renders the settled turn and step counts directly: its text is both the visual and the golden-captured content, so animating it lets an assembled-browser aria capture observe intermediate counts.

**Animation is presentation, never semantics.** Every transition and animation is gated behind `@media (prefers-reduced-motion: no-preference)` with a `reduce` override in the same sheet, and accessible output carries the settled value: `ContextMeter`'s `aria-label` and Tooltip use the provider-exact percent while only the visual ring and number animate, so an aria capture or a screen reader never observes an intermediate tick.

**New elevated surfaces rebind the scrollbar indirection.** `DetailsPanel`'s section cards paint `--dsw-alias-bg-module-platform`, so its scrolling body declares the l2 `--dsh-scrollbar-*` pair per the [pointer-revealed sidebar scrollbars](2026-08-04-pointer-revealed-sidebar-scrollbars.md) contract, which the ui-theme invariant test enforces.

## Alternatives considered

**Port MagicUI's Tailwind components directly.** Rejected because the styling contract is CSS Modules + tokens with no Tailwind; importing Tailwind for one visual pass would fork the styling system and its CSS-in-bundle isolation.

**Introduce an animation library (framer-motion or similar).** Rejected because the motion is short CSS transitions, one-off entrance keyframes, and one numeric tween; a library and its provider plumbing buy nothing the CSS plus a 40-line hook do not.

**Animate the stats strip text.** Rejected because the strip's text is both the visual and the golden-captured content; an initial port that animated it made assembled-browser captures race the ticker (`plan-review`, `question-composer`, `queue-actions` observed intermediate counts), so the strip renders settled counts.

**Animate the aria with the display.** Rejected because assembled-browser aria goldens capture the context-meter label and a screen reader must not read intermediate ticks; the settled value stays in the accessible label while visuals animate, which also keeps `lifecycle-chrome` capture-stable.

**Ship transitions without reduced-motion guards.** Rejected in review as inconsistent with every other sheet; the composer card, diff and terminal blocks, and goal bar each gained the `reduce` override.

## Consequences

The shipped surface gains the polished motion vocabulary with no new dependency, no model-visible behavior change, and one DOM addition (`EmptyHero`'s `aria-hidden` backdrop). Motion follows the OS reduced-motion preference everywhere. The context-meter aria stays capture-stable and the stats strip renders settled counts, so no captured text races the number ticker. Every new elevated scroll surface must declare the l2 scrollbar pair or the ui-theme invariant test turns red. Performance notes: the hero grid drift animates `background-position` (a paint property) at a slow 28-second cadence, and hover glows layer box-shadows — both acceptable at the shipped frequencies, and the manual visual checklist covers contrast and motion intensity.
