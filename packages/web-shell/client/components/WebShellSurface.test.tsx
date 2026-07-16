// @vitest-environment jsdom

import { StrictMode, act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { createPortal } from 'react-dom';
import { afterEach, describe, expect, it } from 'vitest';
import { useWebShellPortalRoot } from '../portalRoot';
import { WebShellSurface } from './WebShellSurface';

const mounted: Array<{ container: HTMLElement; root: Root }> = [];

afterEach(() => {
  for (const { container, root } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
  document
    .querySelectorAll('[data-web-shell-shadow-overlay-host]')
    .forEach((node) => node.remove());
  document
    .querySelectorAll('style[data-qwen-web-shell="component"]')
    .forEach((node) => node.remove());
});

function renderSurface(element: ReactNode) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  mounted.push({ container, root });
  act(() => root.render(element));
  return container;
}

function PortalProbe() {
  const portalRoot = useWebShellPortalRoot();
  return (
    <>
      <span data-shadow-child />
      {portalRoot && createPortal(<span data-shadow-portal />, portalRoot)}
    </>
  );
}

describe('WebShellSurface', () => {
  it('keeps scoped children in the document tree', () => {
    const container = renderSurface(
      <WebShellSurface isolation="scoped">
        <span data-scoped-child />
      </WebShellSurface>,
    );

    expect(container.querySelector('[data-scoped-child]')).not.toBeNull();
    expect(container.querySelector('[data-web-shell-shadow-host]')).toBeNull();
  });

  it('renders the app and portal into separate shadow roots', () => {
    const sourceStyle = document.createElement('style');
    sourceStyle.dataset.qwenWebShell = 'component';
    sourceStyle.textContent = '[data-shadow-child] { color: red; }';
    document.head.appendChild(sourceStyle);

    const container = renderSurface(
      <WebShellSurface
        isolation="shadow-dom"
        className="consumer-shell"
        style={{ width: 320 }}
      >
        <PortalProbe />
      </WebShellSurface>,
    );

    const host = container.querySelector<HTMLElement>(
      '[data-web-shell-shadow-host]',
    );
    const overlayHost = document.body.querySelector<HTMLElement>(
      '[data-web-shell-shadow-overlay-host]',
    );
    expect(host?.className).toBe('consumer-shell');
    expect(host?.style.width).toBe('320px');
    expect(
      host?.shadowRoot?.querySelector('[data-shadow-child]'),
    ).not.toBeNull();
    expect(
      overlayHost?.shadowRoot?.querySelector('[data-shadow-portal]'),
    ).not.toBeNull();
    expect(
      host?.shadowRoot?.querySelector('[data-web-shell-shadow-style]')
        ?.textContent,
    ).toContain('[data-shadow-child]');
    expect(
      overlayHost?.shadowRoot?.querySelector('[data-web-shell-shadow-style]')
        ?.textContent,
    ).toContain('[data-shadow-child]');
  });

  it('is Strict Mode safe and removes its overlay host on unmount', () => {
    const container = renderSurface(
      <StrictMode>
        <WebShellSurface isolation="shadow-dom">
          <PortalProbe />
        </WebShellSurface>
      </StrictMode>,
    );

    expect(
      document.body.querySelectorAll('[data-web-shell-shadow-overlay-host]'),
    ).toHaveLength(1);

    const index = mounted.findIndex((item) => item.container === container);
    const entry = mounted[index];
    expect(entry).toBeDefined();
    act(() => entry?.root.unmount());
    mounted.splice(index, 1);

    expect(
      document.body.querySelectorAll('[data-web-shell-shadow-overlay-host]'),
    ).toHaveLength(0);
  });

  it('keeps multiple shadow instances independent', () => {
    const first = renderSurface(
      <WebShellSurface isolation="shadow-dom">
        <PortalProbe />
      </WebShellSurface>,
    );
    renderSurface(
      <WebShellSurface isolation="shadow-dom">
        <PortalProbe />
      </WebShellSurface>,
    );

    expect(
      document.body.querySelectorAll('[data-web-shell-shadow-overlay-host]'),
    ).toHaveLength(2);

    const index = mounted.findIndex((item) => item.container === first);
    const entry = mounted[index];
    act(() => entry?.root.unmount());
    mounted.splice(index, 1);

    expect(
      document.body.querySelectorAll('[data-web-shell-shadow-overlay-host]'),
    ).toHaveLength(1);
  });
});
