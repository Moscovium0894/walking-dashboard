import { describe, expect, it } from 'vitest';
import { COPY_JS, CROPPER_JS } from '../src/worker/ui/clientScripts';

/**
 * The client scripts are held as strings, so TypeScript cannot check them.
 * These tests stand in for that: they parse the source, and assert the
 * properties that actually matter for correctness and safety.
 */

const SCRIPTS: Array<[string, string]> = [
  ['COPY_JS', COPY_JS],
  ['CROPPER_JS', CROPPER_JS],
];

describe('client scripts parse', () => {
  it.each(SCRIPTS)('%s is syntactically valid JavaScript', (_name, source) => {
    // The Function constructor parses without running, which is exactly the
    // syntax check these strings would otherwise never get. The lint rule
    // against it guards against evaluating untrusted input; this is our own
    // source, in a test, and it is never invoked.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    expect(() => new Function(source)).not.toThrow();
  });

  it.each(SCRIPTS)('%s is wrapped in an IIFE under strict mode', (_name, source) => {
    expect(source.trimStart()).toMatch(/^\(function \(\) \{/);
    expect(source).toContain("'use strict'");
  });

  it.each(SCRIPTS)('%s leaves no globals behind', (_name, source) => {
    // Every declaration should be inside the IIFE. A stray assignment without
    // var/let/const would leak onto window under sloppy mode; strict mode turns
    // it into an error, but catching it here is cheaper than at runtime.
    expect(source).not.toMatch(/^\s*(window|globalThis)\.\w+\s*=/m);
  });
});

describe('the cropper exports correctly', () => {
  it('holds the crop in natural pixels, not screen pixels', () => {
    // The guarantee the whole thing rests on: pointer coordinates are divided
    // by the display scale on the way in, so the stored rectangle is in source
    // pixels and the export is an exact region of the original.
    expect(CROPPER_JS).toContain('(event.clientX - rect.left) / scale');
    expect(CROPPER_JS).toContain('(event.clientY - rect.top) / scale');
  });

  it('draws the exact source rectangle to the canvas', () => {
    expect(CROPPER_JS).toContain('ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, outW, outH)');
  });

  it('writes PNG and never fills the canvas, so transparency survives', () => {
    expect(CROPPER_JS).toContain("'image/png'");
    expect(CROPPER_JS).not.toContain('fillRect');
    expect(CROPPER_JS).not.toContain("'image/jpeg'");
  });

  it('clamps the crop inside the image', () => {
    expect(CROPPER_JS).toContain('function normaliseCrop');
    expect(CROPPER_JS).toContain('crop.x = clamp(crop.x, 0, natural.w - crop.w)');
    expect(CROPPER_JS).toContain('crop.y = clamp(crop.y, 0, natural.h - crop.h)');
  });

  it('can only write to a known crop target', () => {
    expect(CROPPER_JS).toContain("target = next === 'logo-nav' ? 'logo-nav' : 'logo'");
  });

  it('recomputes layout when the window resizes', () => {
    // Without this the display scale would go stale and the crop box would
    // drift away from the region it represents.
    expect(CROPPER_JS).toContain("window.addEventListener('resize', layout)");
  });

  it('supports the keyboard as well as the pointer', () => {
    expect(CROPPER_JS).toContain("event.key === 'ArrowLeft'");
    expect(CROPPER_JS).toContain("boxEl.addEventListener('keydown'");
  });

  it('leaves the plain form post alone when no image is loaded', () => {
    // Progressive enhancement: with JavaScript off, or before a file is chosen,
    // the form must submit normally rather than being swallowed.
    expect(CROPPER_JS).toContain('if (panel.hidden || !originalBlob || !natural.w) return;');
  });
});

describe('the copy script is progressive enhancement', () => {
  it('reveals its button only once the script has run', () => {
    expect(COPY_JS).toContain('button.hidden = false');
  });

  it('falls back to a manual copy instruction', () => {
    expect(COPY_JS).toContain('Press Ctrl+C or Cmd+C to copy.');
  });
});
