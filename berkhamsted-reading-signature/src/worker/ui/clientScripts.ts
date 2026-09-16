/**
 * Client-side scripts, served as separate files from /js/*.
 *
 * Serving them rather than inlining them keeps the admin Content-Security-Policy
 * at a plain `script-src 'self'`, with no hashes to keep in step and no
 * 'unsafe-inline'.
 *
 * Both scripts are progressive enhancement. Every page works with JavaScript
 * disabled: the signature HTML is selectable without the copy button, and the
 * logo form uploads the file uncropped without the cropper.
 *
 * These are plain ES5-style strings rather than TypeScript, so they are syntax
 * checked by a test (see test/clientScripts.test.ts) instead of by the compiler.
 */

export const COPY_JS = `(function () {
  'use strict';
  var button = document.getElementById('copy-button');
  var source = document.getElementById('signature-html');
  var status = document.getElementById('copy-status');
  if (!button || !source) return;

  button.hidden = false;
  button.addEventListener('click', function () {
    source.focus();
    source.select();
    var done = function (ok) {
      if (status) {
        status.textContent = ok ? 'Copied to clipboard.' : 'Press Ctrl+C or Cmd+C to copy.';
      }
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(source.value).then(function () { done(true); }, function () { done(false); });
    } else {
      done(false);
    }
  });
})();
`;

/**
 * The logo cropper.
 *
 * Correctness rests on one decision: the crop rectangle is held in *natural
 * image pixels* at all times, never in screen pixels. Screen coordinates are
 * converted to natural coordinates on the way in, and back again only for
 * drawing. That means the exported image is an exact pixel region of the
 * source, unaffected by the size the image happens to be displayed at, by the
 * device pixel ratio, or by the window being resized mid-crop.
 *
 * The export preserves the alpha channel by writing PNG and never filling the
 * canvas, so a transparent logo stays transparent.
 */
export const CROPPER_JS = `(function () {
  'use strict';

  var root = document.getElementById('logo-cropper');
  if (!root || typeof HTMLCanvasElement === 'undefined') return;

  var form = document.getElementById('logo-form');
  var fileInput = document.getElementById('logo-file');
  var panel = document.getElementById('crop-panel');
  var stage = document.getElementById('crop-stage');
  var imgEl = document.getElementById('crop-image');
  var boxEl = document.getElementById('crop-box');
  var previewEl = document.getElementById('crop-preview');
  var statusEl = document.getElementById('crop-status');
  var dimsEl = document.getElementById('crop-dims');
  var saveBtn = document.getElementById('crop-save');
  var resetBtn = document.getElementById('crop-reset');
  var cancelBtn = document.getElementById('crop-cancel');
  var recropBtn = document.getElementById('crop-recrop');
  var submitBtn = document.getElementById('logo-submit');

  if (!form || !fileInput || !panel || !stage || !imgEl || !boxEl) return;

  // --- State. crop is ALWAYS in natural image pixels. ---
  var natural = { w: 0, h: 0 };
  var crop = { x: 0, y: 0, w: 0, h: 0 };
  var scale = 1;
  var originalBlob = null;
  var originalType = 'image/png';
  var drag = null;
  var anchor = null;
  /** True when the loaded image came from the stored original, not a new file. */
  var reusingOriginal = false;

  var MIN_CROP = 16;
  var MAX_OUTPUT = 1400;

  function clamp(value, low, high) {
    return value < low ? low : value > high ? high : value;
  }

  function say(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  // --- Geometry -----------------------------------------------------------

  function layout() {
    if (!natural.w || !natural.h) return;
    var available = stage.clientWidth || 480;
    scale = Math.min(1, available / natural.w);
    imgEl.style.width = Math.round(natural.w * scale) + 'px';
    imgEl.style.height = Math.round(natural.h * scale) + 'px';
    stage.style.height = Math.round(natural.h * scale) + 'px';
    drawBox();
  }

  function drawBox() {
    boxEl.style.left = Math.round(crop.x * scale) + 'px';
    boxEl.style.top = Math.round(crop.y * scale) + 'px';
    boxEl.style.width = Math.round(crop.w * scale) + 'px';
    boxEl.style.height = Math.round(crop.h * scale) + 'px';
    if (dimsEl) {
      dimsEl.textContent = Math.round(crop.w) + ' x ' + Math.round(crop.h) + ' pixels';
    }
    drawPreview();
  }

  function resetCrop() {
    crop = { x: 0, y: 0, w: natural.w, h: natural.h };
    drawBox();
  }

  /** Constrain the crop to the image and to a sane minimum size. */
  function normaliseCrop() {
    crop.w = clamp(crop.w, Math.min(MIN_CROP, natural.w), natural.w);
    crop.h = clamp(crop.h, Math.min(MIN_CROP, natural.h), natural.h);
    crop.x = clamp(crop.x, 0, natural.w - crop.w);
    crop.y = clamp(crop.y, 0, natural.h - crop.h);
  }

  // --- Rendering ----------------------------------------------------------

  /**
   * Draw the current crop to a canvas at source resolution.
   * Never fills the canvas, so transparency survives.
   */
  function renderToCanvas() {
    var sx = Math.round(crop.x);
    var sy = Math.round(crop.y);
    var sw = Math.max(1, Math.round(crop.w));
    var sh = Math.max(1, Math.round(crop.h));

    var outW = sw;
    var outH = sh;
    if (outW > MAX_OUTPUT) {
      outH = Math.max(1, Math.round((MAX_OUTPUT / outW) * outH));
      outW = MAX_OUTPUT;
    }

    var canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    var ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = true;
    if ('imageSmoothingQuality' in ctx) ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(imgEl, sx, sy, sw, sh, 0, 0, outW, outH);
    return canvas;
  }

  function drawPreview() {
    if (!natural.w) return;
    var canvas = renderToCanvas();
    try {
      if (previewEl) previewEl.src = canvas.toDataURL('image/png');
    } catch (error) {
      /* A tainted canvas cannot happen here: the image is always a local blob. */
    }
  }

  // --- Pointer interaction ------------------------------------------------

  function pointerToNatural(event) {
    var rect = imgEl.getBoundingClientRect();
    return {
      x: clamp((event.clientX - rect.left) / scale, 0, natural.w),
      y: clamp((event.clientY - rect.top) / scale, 0, natural.h),
    };
  }

  function startDrag(event, mode) {
    event.preventDefault();
    var point = pointerToNatural(event);
    drag = {
      mode: mode,
      startX: point.x,
      startY: point.y,
      origin: { x: crop.x, y: crop.y, w: crop.w, h: crop.h },
      pointerId: event.pointerId,
    };
    if (event.target.setPointerCapture) {
      try { event.target.setPointerCapture(event.pointerId); } catch (e) { /* ignore */ }
    }
  }

  function moveDrag(event) {
    if (!drag) return;
    event.preventDefault();

    var point = pointerToNatural(event);
    var dx = point.x - drag.startX;
    var dy = point.y - drag.startY;
    var o = drag.origin;

    if (drag.mode === 'draw' && anchor) {
      crop.x = Math.min(anchor.x, point.x);
      crop.y = Math.min(anchor.y, point.y);
      crop.w = Math.abs(point.x - anchor.x);
      crop.h = Math.abs(point.y - anchor.y);
    } else if (drag.mode === 'move') {
      crop.x = clamp(o.x + dx, 0, natural.w - o.w);
      crop.y = clamp(o.y + dy, 0, natural.h - o.h);
      crop.w = o.w;
      crop.h = o.h;
    } else {
      // Work out the new edges, then derive x/y/w/h. Each edge is clamped
      // against the opposite edge so the box can never invert.
      var left = o.x;
      var top = o.y;
      var right = o.x + o.w;
      var bottom = o.y + o.h;

      if (drag.mode.indexOf('w') !== -1) left = clamp(o.x + dx, 0, right - MIN_CROP);
      if (drag.mode.indexOf('e') !== -1) right = clamp(right + dx, left + MIN_CROP, natural.w);
      if (drag.mode.indexOf('n') !== -1) top = clamp(o.y + dy, 0, bottom - MIN_CROP);
      if (drag.mode.indexOf('s') !== -1) bottom = clamp(bottom + dy, top + MIN_CROP, natural.h);

      crop.x = left;
      crop.y = top;
      crop.w = right - left;
      crop.h = bottom - top;
    }

    normaliseCrop();
    drawBox();
  }

  function endDrag() {
    drag = null;
  }

  boxEl.addEventListener('pointerdown', function (event) {
    var handle = event.target.getAttribute('data-handle');
    startDrag(event, handle || 'move');
  });

  // Pressing on the image outside the box draws a fresh crop from that corner,
  // which is the conventional behaviour and avoids the box jumping under the
  // cursor on a stray click.
  imgEl.addEventListener('pointerdown', function (event) {
    var point = pointerToNatural(event);
    anchor = { x: point.x, y: point.y };
    startDrag(event, 'draw');
  });

  window.addEventListener('pointermove', moveDrag);
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', endDrag);
  window.addEventListener('resize', layout);

  // --- Keyboard control, so the cropper is usable without a pointer -------

  boxEl.addEventListener('keydown', function (event) {
    var step = event.shiftKey ? 20 : 2;
    var resizing = event.altKey;
    var handled = true;

    if (event.key === 'ArrowLeft') {
      if (resizing) crop.w -= step; else crop.x -= step;
    } else if (event.key === 'ArrowRight') {
      if (resizing) crop.w += step; else crop.x += step;
    } else if (event.key === 'ArrowUp') {
      if (resizing) crop.h -= step; else crop.y -= step;
    } else if (event.key === 'ArrowDown') {
      if (resizing) crop.h += step; else crop.y += step;
    } else {
      handled = false;
    }

    if (handled) {
      event.preventDefault();
      normaliseCrop();
      drawBox();
    }
  });

  // --- Loading ------------------------------------------------------------

  function loadFromBlob(blob, type) {
    originalBlob = blob;
    originalType = type || blob.type || 'image/png';

    var url = URL.createObjectURL(blob);
    imgEl.onload = function () {
      natural.w = imgEl.naturalWidth;
      natural.h = imgEl.naturalHeight;
      if (!natural.w || !natural.h) {
        say('That image could not be read.');
        return;
      }
      panel.hidden = false;
      if (submitBtn) submitBtn.hidden = true;
      resetCrop();
      layout();
      say('Drag inside the image to move the crop, or drag a handle to resize it.');
      URL.revokeObjectURL(url);
    };
    imgEl.onerror = function () {
      say('That file could not be opened as an image.');
      URL.revokeObjectURL(url);
    };
    imgEl.src = url;
  }

  fileInput.addEventListener('change', function () {
    var file = fileInput.files && fileInput.files[0];
    if (!file) return;
    reusingOriginal = false;
    loadFromBlob(file, file.type);
  });

  if (recropBtn) {
    recropBtn.addEventListener('click', function () {
      reusingOriginal = true;
      say('Loading your original image...');
      fetch(recropBtn.getAttribute('data-src'), { credentials: 'same-origin' })
        .then(function (response) {
          if (!response.ok) throw new Error('not ok');
          return response.blob();
        })
        .then(function (blob) { loadFromBlob(blob, blob.type); })
        .catch(function () { say('The original image could not be loaded. Upload the file again.'); });
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', function () {
      resetCrop();
      say('Crop reset to the whole image.');
    });
  }

  if (cancelBtn) {
    cancelBtn.addEventListener('click', function () {
      panel.hidden = true;
      if (submitBtn) submitBtn.hidden = false;
      fileInput.value = '';
      originalBlob = null;
      say('');
    });
  }

  // --- Saving -------------------------------------------------------------

  function canvasToBlob(canvas) {
    return new Promise(function (resolve, reject) {
      canvas.toBlob(function (blob) {
        if (blob) resolve(blob); else reject(new Error('export failed'));
      }, 'image/png');
    });
  }

  form.addEventListener('submit', function (event) {
    // Without a loaded image the plain form post still works, uncropped.
    if (panel.hidden || !originalBlob || !natural.w) return;

    event.preventDefault();
    if (saveBtn) saveBtn.disabled = true;
    say('Saving...');

    canvasToBlob(renderToCanvas())
      .then(function (cropped) {
        var data = new FormData();
        var csrf = form.querySelector('input[name=csrf]');
        data.append('csrf', csrf ? csrf.value : '');
        data.append('logo', cropped, 'logo.png');
        // Re-cropping works from the stored original, so there is no need to
        // send it back and rewrite the row with identical bytes.
        if (!reusingOriginal) data.append('logoOriginal', originalBlob, 'original');
        return fetch(form.action, { method: 'POST', body: data, credentials: 'same-origin' });
      })
      .then(function (response) {
        if (!response.ok && response.status !== 0) throw new Error('upload failed');
        window.location.href = '/profile?ok=logo-saved';
      })
      .catch(function () {
        if (saveBtn) saveBtn.disabled = false;
        say('The logo could not be saved. Please try again.');
      });
  });
})();
`;
