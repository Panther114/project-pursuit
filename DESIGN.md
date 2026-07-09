# Design

## Foundation

Project Pursuit uses a restrained data-product interface. The primary working scene is a student reviewing options on a laptop in a bright classroom or study space, so the default theme is light, high-contrast, and low-decoration.

## Color Tokens

Use OKLCH tokens in CSS:

- `--bg`: pure white.
- `--surface`: cool neutral panel.
- `--surface-strong`: deeper sidebar neutral.
- `--ink`: primary text.
- `--muted`: secondary text.
- `--border`: structural dividers.
- `--primary`: amber action and brand anchor.
- `--accent`: blue analysis and recommendation emphasis.
- `--success`: verified source state.
- `--warning`: approximate or historical deadline state.
- `--danger`: missing or risky deadline state.

## Typography

Use a system sans stack. Keep product UI type fixed and compact: 12px labels, 14px table/body text, 16px controls, 20-28px screen headings. Avoid display fonts in controls and data.

## Components

Core components include app shell, navigation rail, filter bar, segmented controls, search input, table/list rows, confidence badges, deadline chips, detail panel, shortlist comparison strip, preference form, and review queue.

## Motion

Use 150-250ms transitions for hover, focus, selected states, panel changes, and shortlist feedback. Motion must communicate state and respect `prefers-reduced-motion`.

## Accessibility

All controls need labels, visible focus rings, 44px minimum touch targets where possible, and color-independent status labels.
