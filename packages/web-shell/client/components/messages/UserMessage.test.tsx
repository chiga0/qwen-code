// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { act, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { UserMessage } from './UserMessage';

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const mounted: Array<{ root: Root; container: HTMLElement }> = [];

afterEach(() => {
  for (const { root, container } of mounted.splice(0)) {
    act(() => root.unmount());
    container.remove();
  }
});

function render(node: ReactNode): HTMLElement {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(node);
  });
  mounted.push({ root, container });
  return container;
}

describe('UserMessage', () => {
  it('renders text content', () => {
    const container = render(<UserMessage content="hello world" />);
    expect(container.textContent).toContain('hello world');
  });

  it('renders images when provided', () => {
    const images = [{ data: 'iVBORw0KGgo=', mimeType: 'image/png' }];
    const container = render(<UserMessage content="hi" images={images} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(1);
  });

  it('renders multiple images', () => {
    const images = [
      { data: 'iVBORw0KGgo=', mimeType: 'image/png' },
      { data: 'R0lGODlh', mimeType: 'image/gif' },
    ];
    const container = render(<UserMessage content="hi" images={images} />);
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(2);
  });
});
