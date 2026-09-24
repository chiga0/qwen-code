/**
 * @license
 * Copyright 2025 Google LLC
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it, vi } from 'vitest';
import { getPty, loadPty } from './getPty.js';

// `@lydell/node-pty` is vendored in this repo's node_modules, so a plain
// import resolves on the build host and the "neither backend loaded" arm would
// never run. Fail it the way a broken prebuild does, and let the genuinely
// absent `node-pty` specifier fail on its own, so both messages in the reason
// are produced by the code under test rather than supplied by the test.
vi.mock('@lydell/node-pty', () => {
  throw new Error('native module failed to dlopen: pty.node');
});

// getPty.ts branches on `'bun' in process.versions`; this mirrors the marker
// Desktop's Bun build carries without touching the real descriptor.
function markBunRuntime(): () => void {
  const original = Object.getOwnPropertyDescriptor(process.versions, 'bun');

  Object.defineProperty(process.versions, 'bun', {
    value: '1.3.8',
    configurable: true,
  });

  return () => {
    if (original) {
      Object.defineProperty(process.versions, 'bun', original);
    } else {
      const versions = process.versions as typeof process.versions & {
        bun?: string;
      };
      delete versions.bun;
    }
  };
}

// loadPty() gates the Bun backend on the primitive itself, not on the version
// marker, so the "backend exists" arm needs a stand-in for it. Nothing here is
// called: the test only asserts which backend loadPty() resolves.
function stubBunTerminal(): () => void {
  const globalWithBun = globalThis as { Bun?: unknown };
  const original = globalWithBun.Bun;

  globalWithBun.Bun = { Terminal: class {}, spawn: () => ({}) };

  return () => {
    if (original === undefined) {
      delete globalWithBun.Bun;
    } else {
      globalWithBun.Bun = original;
    }
  };
}

function markPlatform(platform: string): () => void {
  const original = Object.getOwnPropertyDescriptor(process, 'platform')!;

  Object.defineProperty(process, 'platform', {
    value: platform,
    configurable: true,
  });

  return () => {
    Object.defineProperty(process, 'platform', original);
  };
}

describe('getPty', () => {
  it('resolves null when this Bun build has no Terminal primitive', async () => {
    const restoreBun = markBunRuntime();

    try {
      const { impl, loadError } = await loadPty();

      expect(impl).toBeNull();
      expect(loadError).toMatch(/no Bun\.Terminal primitive/);
      // The registry's contract: no rejection, no throwing arm.
      await expect(getPty()).resolves.toBeNull();
    } finally {
      restoreBun();
    }
  });

  it('returns the Bun terminal backend when the primitive exists', async () => {
    const restoreBun = markBunRuntime();
    const restoreGlobal = stubBunTerminal();

    try {
      const { impl, loadError } = await loadPty();

      expect(loadError).toBeNull();
      expect(impl?.name).toBe('bun-terminal');
      expect(typeof impl?.module.spawn).toBe('function');
    } finally {
      restoreGlobal();
      restoreBun();
    }
  });

  it('keeps the Bun runtime disabled on Windows, where ConPTY is unmeasured', async () => {
    const restoreBun = markBunRuntime();
    const restoreGlobal = stubBunTerminal();
    const restorePlatform = markPlatform('win32');

    try {
      const { impl, loadError } = await loadPty();

      expect(impl).toBeNull();
      expect(loadError).toMatch(/disabled under the Bun runtime/);
    } finally {
      restorePlatform();
      restoreGlobal();
      restoreBun();
    }
  });

  it('joins both backend failures into the reason of the call that saw them', async () => {
    const { impl, loadError } = await loadPty();

    expect(impl).toBeNull();
    // Both imports failed, both messages reported, in the order they were
    // tried, joined into one sentence — not collapsed to the first failure.
    // (vitest wraps the mocked import's rejection, so match the inner message
    // this module produced.)
    const failures = [loadError].flatMap((reason) =>
      (reason ?? '').split('; '),
    );
    expect(failures).toHaveLength(2);
    expect(failures[0]).toMatch(/native module failed to dlopen: pty\.node/);
    expect(failures[1]).toMatch(/node-pty/);
    // ...and not another arm's reason.
    expect(loadError).not.toMatch(/Bun/);
  });

  it("keeps each call's own reason when another call lands in between", async () => {
    // `failing` starts first and records a failed-both-backends reason; the
    // Bun-marker call below then lands on a different runtime before `failing`
    // is read. A reason delivered out-of-band (module state, read after the
    // call) would report the Bun cause here — the interleaving measured
    // against the previous design (#11881).
    const failing = loadPty();
    await new Promise((resolve) => setImmediate(resolve));
    const restoreBun = markBunRuntime();

    try {
      const bun = await loadPty();
      expect(bun.impl).toBeNull();
      expect(bun.loadError).toMatch(/no Bun\.Terminal primitive/);
    } finally {
      restoreBun();
    }

    const failed = await failing;

    expect(failed.impl).toBeNull();
    expect(failed.loadError).toMatch(
      /native module failed to dlopen: pty\.node/,
    );
    expect(failed.loadError).not.toMatch(/Bun/);
  });

  it("does not reuse a previous call's reason for a later failure", async () => {
    const restoreBun = markBunRuntime();

    try {
      const bun = await loadPty();
      expect(bun.loadError).toMatch(/no Bun\.Terminal primitive/);
    } finally {
      restoreBun();
    }

    const later = await loadPty();

    expect(later.impl).toBeNull();
    expect(later.loadError).toMatch(
      /native module failed to dlopen: pty\.node/,
    );
    expect(later.loadError).not.toMatch(/Bun/);
  });
});
