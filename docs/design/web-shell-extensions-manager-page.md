# Web Shell Extensions Manager Page

## Goal

Replace the `/extensions manage` dialog with an in-place management page that
matches the navigation model established by the MCP manager. Preserve loading,
update checks, session refresh, scoped enable/disable, update, uninstall, and
all extension detail fields.

## Layout

- A full-width sticky breadcrumb bar owns page-level navigation.
- Page content is centered and capped at 800px.
- The first level is a searchable card list. Cards summarize identity, state,
  update availability, and capability counts.
- Selecting a card opens a second-level detail page without a modal.
- Detail content uses tabs for overview, commands, skills, agents, MCP servers,
  and context files. Empty capabilities use the shared Empty component.
- Secondary actions live in a dropdown beside the selected extension. Uninstall
  uses AlertDialog.

## Visual direction

The page is a quiet package inventory for developers. Existing semantic theme
tokens, typography, and shadcn primitives remain the visual system. The
signature element is the capability strip on each package card: it provides a
compact, scannable inventory without turning the page into a dashboard.

## Behavior

- `/extensions` and `/extensions manage` open the page.
- Refresh reloads active sessions and then reloads extension/update state.
- Extension change events reload the list and preserve detail selection when
  the extension still exists.
- User and workspace enable/disable actions retain their existing daemon calls.
- Update and uninstall continue to require an active session client ID.
- The old dialog component remains available during migration but is no longer
  opened by the slash command.
