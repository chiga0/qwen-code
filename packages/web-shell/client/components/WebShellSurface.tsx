import {
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import type { WebShellIsolation } from '../isolation';
import { WebShellPortalRootContext } from '../portalRoot';

interface WebShellSurfaceProps {
  isolation: WebShellIsolation;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}

interface ShadowMounts {
  appRoot: HTMLElement;
  portalRoot: HTMLElement;
}

function isWebShellStyle(node: Element): node is HTMLStyleElement {
  if (node.tagName !== 'STYLE') return false;
  const style = node as HTMLStyleElement;
  if (style.dataset['qwenWebShell'] === 'component') return true;
  const viteId = style.getAttribute('data-vite-dev-id');
  if (!viteId) return false;
  return (
    viteId.includes('/packages/web-shell/client/') ||
    viteId.includes('/node_modules/@qwen-code/web-shell/') ||
    viteId.endsWith('/node_modules/katex/dist/katex.min.css')
  );
}

function mirrorStyles(
  document: Document,
  roots: readonly ShadowRoot[],
): () => void {
  const mirrors = new Map<
    ShadowRoot,
    Map<HTMLStyleElement, HTMLStyleElement>
  >();
  for (const root of roots) mirrors.set(root, new Map());

  const sync = () => {
    const sources = Array.from(document.head.querySelectorAll('style')).filter(
      isWebShellStyle,
    );
    const sourceSet = new Set(sources);

    for (const [root, rootMirrors] of mirrors) {
      for (const [source, mirror] of rootMirrors) {
        if (sourceSet.has(source)) continue;
        mirror.remove();
        rootMirrors.delete(source);
      }
      for (const source of sources) {
        let mirror = rootMirrors.get(source);
        if (!mirror) {
          mirror = document.createElement('style');
          mirror.dataset.webShellShadowStyle = '';
          rootMirrors.set(source, mirror);
        }
        if (mirror.textContent !== source.textContent) {
          mirror.textContent = source.textContent;
        }
      }
      for (const source of sources) {
        root.appendChild(rootMirrors.get(source)!);
      }
    }
  };

  sync();
  const observer = new document.defaultView!.MutationObserver(sync);
  observer.observe(document.head, {
    attributes: true,
    childList: true,
    characterData: true,
    subtree: true,
  });

  return () => {
    observer.disconnect();
    for (const rootMirrors of mirrors.values()) {
      for (const mirror of rootMirrors.values()) mirror.remove();
    }
  };
}

export function WebShellSurface({
  isolation,
  className,
  style,
  children,
}: WebShellSurfaceProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [mounts, setMounts] = useState<ShadowMounts | null>(null);

  useLayoutEffect(() => {
    if (isolation !== 'shadow-dom') return;
    const host = hostRef.current;
    if (!host) return;

    const document = host.ownerDocument;
    const mainShadowRoot =
      host.shadowRoot ??
      host.attachShadow({ mode: 'open', delegatesFocus: true });
    const appRoot = document.createElement('div');
    appRoot.dataset.webShellShadowApp = '';
    appRoot.style.display = 'contents';
    mainShadowRoot.appendChild(appRoot);

    const overlayHost = document.createElement('div');
    overlayHost.dataset.webShellShadowOverlayHost = '';
    overlayHost.style.display = 'contents';
    document.body.appendChild(overlayHost);

    const overlayShadowRoot = overlayHost.attachShadow({ mode: 'open' });
    const portalRoot = document.createElement('div');
    portalRoot.dataset.webShellPortalRoot = '';
    portalRoot.dataset.webShellShadcn = '';
    overlayShadowRoot.appendChild(portalRoot);

    const stopMirroring = mirrorStyles(document, [
      mainShadowRoot,
      overlayShadowRoot,
    ]);
    setMounts({ appRoot, portalRoot });

    return () => {
      stopMirroring();
      appRoot.remove();
      overlayHost.remove();
      setMounts(null);
    };
  }, [isolation]);

  if (isolation === 'scoped') return children;

  return (
    <div
      ref={hostRef}
      className={className}
      style={{
        display: 'block',
        width: '100%',
        height: '100%',
        minHeight: 0,
        ...style,
      }}
      data-web-shell-shadow-host
    >
      {mounts &&
        createPortal(
          <WebShellPortalRootContext.Provider value={mounts.portalRoot}>
            {children}
          </WebShellPortalRootContext.Provider>,
          mounts.appRoot,
        )}
    </div>
  );
}
