/**
 * `<WebShell>` requires an ancestor `<DaemonWorkspaceProvider>` and
 * `<DaemonSessionProvider>` from `@qwen-code/webui/daemon-react-sdk`.
 *
 * @example
 * ```tsx
 * import { DaemonWorkspaceProvider, DaemonSessionProvider } from '@qwen-code/webui/daemon-react-sdk';
 * import { WebShell } from '@qwen-code/web-shell';
 *
 * <DaemonWorkspaceProvider baseUrl={baseUrl} token={token}>
 *   <DaemonSessionProvider baseUrl={baseUrl} token={token} initialSessionId={id}>
 *     <WebShell />
 *   </DaemonSessionProvider>
 * </DaemonWorkspaceProvider>
 * ```
 */
export { App as WebShell } from './App';
export type { WebShellProps } from './App';
export type { WebShellLanguage } from './i18n';
