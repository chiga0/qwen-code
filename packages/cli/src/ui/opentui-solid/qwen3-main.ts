// qwen3 (OpenTUI-solid) runnable entry: erase-free solid session renderer.
import { SolidSessionRenderer } from './renderer.js';
import { StreamingSessionModel } from './streaming-model.js';
import type { TerminalBackend } from './types.js';

const stdoutBackend: TerminalBackend = {
  write: (data) => process.stdout.write(data),
  getSize: () => ({
    rows: process.stdout.rows ?? 24,
    cols: process.stdout.columns ?? 80,
  }),
};

const model = new StreamingSessionModel();
const renderer = new SolidSessionRenderer({
  model,
  backend: stdoutBackend,
});
void renderer;

// Demo session (real client wiring lands in later PR2 slice).
model.append({ kind: 'markdown', text: '# qwen3 (OpenTUI + Solid)\n' });
model.append({ kind: 'thinking', text: 'planning…' });
model.append({
  kind: 'markdown',
  text: 'erase-free solid renderer: row-diff + DEC 2026, no full-screen clears.\n',
});
model.append({ kind: 'tool-start', id: 't1', name: 'read_file', detail: 'README' });
model.append({ kind: 'tool-result', id: 't1', result: '# README\nhello' });
model.append({ kind: 'markdown', text: 'done.\n' });

process.on('SIGINT', () => process.exit(0));
setTimeout(() => process.exit(0), 5000);
