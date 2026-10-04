# Frontend Agent Guidelines

These rules apply to `mapua-apex-frontend`. Also follow the root `AGENTS.md` (cross-system changes) and the backend `AGENTS.md` when a change touches the backend.

## Componentization & Layout Conventions

- **Separate new additions into components.** Do not inline new UI blocks directly into an existing page. Extract them into their own component (under the existing `src/components` structure) and compose them into the page.
- **Follow the page-layout conventions already used in this project.** Before creating or editing a page/component, study sibling pages and components and match their established structure, layout patterns, naming, and styling. Reuse existing components where they fit rather than writing a new one from scratch.
- Consistency with the surrounding code takes precedence over introducing a fresh pattern.

## UI Components

- **Use coss ui components.** For interactive UI (selects, dropdowns, dialogs, menus, inputs, toggles, etc.), use the coss ui primitives vendored in `src/components/ui` (the `@coss` registry, built on Base UI). Prefer these existing exports over hand-rolled markup or another component library, and follow each primitive's documented composition/trigger hierarchy.
- **Light mode only.** This app ships a single light theme. Do not add dark-mode variants, `dark:` styling, or theme toggles; use coss components in their light-mode presentation.
