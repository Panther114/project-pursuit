# Design

## Foundation

Project Pursuit uses a restrained monochrome opportunity index. The cover page is an image-led, full-screen introduction; working pages are compact, source-first boards that split the catalog from the selected record's detail.

## Color Tokens

Use black, off-white, and a neutral gray scale only. Theme tokens must invert cleanly between light and dark modes: `--bg`, `--surface`, `--ink`, `--muted`, `--line`, and `--reverse`.

## Typography

Use IBM Plex Sans with IBM Plex Mono for source metadata. Keep product UI compact: 10-11px metadata, 12-14px controls and body text, and tightly tracked large headings. Avoid wide display faces.

## Components

Core components include the persistent brand/nav, full-screen lander, board controls, wide selectable record rows, selected-record detail panel, fit-profile controls, source trace, review queue, and compact footer. Competition and Program boards share the same interaction and detail pattern.

## Motion

Use 180-420ms transitions for theme inversion, hover, focus, selected rows, save state, and panel changes. The cover visual may have one quiet entrance sequence. Motion must communicate state and ship for all users; do not disable visual effects through `prefers-reduced-motion`. Critical UI must remain visible if animations are unavailable.

## Accessibility

All controls need labels, visible focus rings, 44px minimum touch targets where possible, and color-independent status labels.
