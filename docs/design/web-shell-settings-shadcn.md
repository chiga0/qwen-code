# Web Shell settings page refresh

## Goal

Refresh the Web Shell settings page with shadcn primitives while preserving
the existing daemon settings model, workspace/user scope behavior, local chat
width setting, translations, and host-provided theme tokens.

## Layout

- Keep the page inside the existing full-page settings surface.
- Use a compact header row for workspace/user scope selection and status.
- Keep categories in a left navigation rail on desktop and a horizontally
  scrollable rail on narrow screens.
- Present the active category as one grouped settings surface rather than a
  stack of visually disconnected cards.
- Align controls in a stable right column while allowing long descriptions to
  wrap without shrinking controls.

## Component mapping

- Scope selection: shadcn Tabs.
- Boolean settings: shadcn Switch.
- Enum, language, theme, and chat width: shadcn Select.
- String and number editing: shadcn Input and Button.
- Scope metadata: shadcn Badge.
- Category rows and setting rows: local UI wrappers built from shadcn tokens,
  because shadcn does not provide a settings-specific information layout.
- Loading and feedback: semantic status region using shadcn colors.

## Compatibility

- Do not change setting keys, update calls, scope resolution, or restart
  behavior.
- Tailwind classes use the `ws:` prefix.
- New surfaces use shadcn semantic colors only. Existing surrounding CSS
  Modules keep their current variables.
- Controls remain keyboard accessible and retain their current labels.
- The embedded settings page must work in both light and dark themes and in
  English and Chinese.
