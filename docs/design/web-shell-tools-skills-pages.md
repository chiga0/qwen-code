# Web Shell Tools and Skills Pages

## Goal

Replace the `/tools desc` dialog and the `/skills detail` command response with
in-place, two-level pages matching the MCP and Extensions managers.

## Shared structure

- Full-width sticky breadcrumb navigation.
- Centered content capped at 800px.
- Searchable first-level card list.
- Second-level detail page reached by selecting a card.
- Loading uses Skeleton, errors use Alert, and empty results use Empty.

## Plugin center

The sidebar exposes a single Plugins entry below New chat. Its first level uses
Tabs to switch between Extensions, MCP, Skills, Tools, and Agents while keeping each
manager's existing data and actions. List pages omit their standalone
breadcrumb inside this container. Opening an item hides the Tabs and replaces
them with a breadcrumb rooted at the active module; selecting that root resets
the manager to its list and restores the Tabs. Direct slash-command entry points
remain standalone and keep their original back navigation.

The Agents section is a separate shadcn implementation that opens on the
management list and exposes creation as a second-level page. The existing
`/agents manage` and `/agents create` dialogs remain unchanged and continue to
use their original component.

## Tools

The list emphasizes display name, enabled state, and a short description. The
detail page shows the complete description and canonical tool name. It remains
read-only because `/tools desc` is informational.

## Skills

The list emphasizes invocation name, scope, model availability, and a short
description. The detail page exposes the invocation signature, scope, model,
and owning extension. “Run skill” places `/<skill-name>` in the composer for
review rather than submitting immediately.

## Testing

Only pure filtering and selection-retention logic is unit tested. Rendering and
interaction are verified in a real browser.
