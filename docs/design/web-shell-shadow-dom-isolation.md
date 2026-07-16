# Web Shell opt-in Shadow DOM isolation

## Motivation

The Web Shell library currently isolates its generated CSS by rewriting every
selector to target the Web Shell application root or its body-level portal
root. This keeps the existing package zero-config, but the isolation contract
is spread across source CSS, the library build, portal creation, theme variable
synchronization, and artifact tests.

Add an opt-in native Shadow DOM boundary without changing existing consumers.
The current scoped Light DOM behavior remains the default.

## Public API

Both `WebShell` and `WebShellWithProviders` accept:

```ts
isolation?: 'scoped' | 'shadow-dom';
```

The default is `scoped`. Changing the value remounts the rendered Web Shell.
`StandaloneWebShell` inherits the option through its existing alias.

## Structure

`shadow-dom` mode creates two open shadow roots:

1. A main shadow root attached to a host at the consumer's render location.
2. An overlay shadow root attached to a separate host under the same document's
   `body`.

The full provider and application tree is rendered into the main root with a
React portal. The overlay root contains the portal container supplied through
the existing Web Shell portal context. Dialogs, popovers, menus, tooltips, and
other Web Shell portals therefore remain page-level overlays without escaping
the component's CSS boundary.

The existing final component CSS is copied into both shadow roots. Development
styles injected by Vite are mirrored so the standalone development application
and Playwright harness can exercise the same mode with
`?isolation=shadow-dom`. This query switch is development-only; the public
component prop is the supported integration API. The current document-level
style remains present for `scoped` instances and backwards compatibility.

## Host customization

In Shadow DOM mode, the public `className` and `style` apply to the main shadow
host. CSS custom properties therefore inherit into the main shadow tree. Theme,
language, and computed custom properties are synchronized to the overlay portal
root so body-level portals render consistently.

The existing scoped mode keeps its current root `className` and `style`
semantics.

## DOM access

Portal consumers continue to use `useWebShellPortalRoot()`. CodeMirror's
separate tooltip container uses that same root and installs its dynamic styles
in the container's own document or shadow root.

This change does not attempt a general rewrite of every `document` access.
Document-level downloads, body cursor changes, and scroll locking remain
document operations. Queries and portals that must see Web Shell descendants
must use the Web Shell root or portal context.

## Compatibility and non-goals

- Focus trap and cross-shadow-root ARIA behavior are not release blockers for
  this opt-in mode, but basic keyboard dismissal and click behavior remain
  covered.
- This change does not make the current runtime CSS delivery CSP-safe.
- This change does not replace CSS Modules or remove the existing scoped build.
- This change does not make Shadow DOM a security boundary.

## Verification

- Public type tests cover the new option on both exported components.
- Component tests cover both isolation modes, Strict Mode mounting, overlay
  cleanup, and multiple instances.
- Portal tests assert that overlay content is rendered inside the overlay
  ShadowRoot rather than the document tree.
- Browser testing verifies rendering, composer interaction, dialogs, theme
  propagation, and unmount cleanup under hostile host CSS.
- Existing scoped-mode tests remain unchanged and green.
