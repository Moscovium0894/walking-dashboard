/**
 * Client-side signature image renderer.
 *
 * Why this exists
 * ---------------
 * An email signature that has already been pasted into a mail client is inert
 * HTML. Mail clients run no JavaScript and make no requests except for images,
 * so the ONLY part of a sent signature that can ever change is an image.
 *
 * That means text baked into the HTML - the book title, the author, the name,
 * the year group - freezes at the moment it is copied. To make those update by
 * themselves, they have to be pixels rather than characters.
 *
 * Rendering them needs a font rasteriser. Workers have none, and shipping one
 * (satori + resvg-wasm plus a font) would add megabytes to a bundle that is
 * deployed by pasting it into a dashboard editor. The browser, however, already
 * has fonts and a canvas. So the dashboard draws the signature and uploads the
 * PNG, and the Worker only ever stores and serves bytes.
 *
 * The layout here mirrors renderSignatureHtml in src/worker/signature.ts. The
 * two are kept in step by test/signatureImage.test.ts, which checks the shared
 * metrics below against that file.
 */

/** Layout constants shared with the HTML signature, in CSS pixels. */
export const SIGNATURE_METRICS = {
  /** Rendered width of the signature block. */
  width: 460,
  paddingLeft: 18,
  paddingTop: 2,
  paddingBottom: 6,
  /** Navy rule down the left edge. */
  barWidth: 3,
  logoWidth: 150,
  coverWidth: 58,
  coverGap: 14,
  nameSize: 19,
  nameLeading: 24,
  credentialsSize: 12,
  credentialsLeading: 16,
  credentialsTracking: 1.4,
  schoolSize: 14,
  schoolLeading: 19,
  subtitleSize: 12,
  subtitleLeading: 17,
  labelSize: 10,
  labelLeading: 13,
  labelTracking: 1.6,
  titleSize: 14,
  titleLeading: 19,
  authorSize: 12,
  authorLeading: 17,
  ruleWidth: 56,
  gapAfterLogo: 14,
  gapBeforeRule: 16,
  gapAfterRule: 14,
  /** Drawn at this multiple, then displayed at 1x, so it stays sharp on high-DPI screens. */
  pixelRatio: 2,
} as const;

export const SIGNATURE_IMAGE_JS = `(function () {
  'use strict';

  var root = document.getElementById('signature-image');
  if (!root || typeof HTMLCanvasElement === 'undefined') return;

  var M = ${JSON.stringify(SIGNATURE_METRICS)};
  var data = null;
  try {
    data = JSON.parse(root.getAttribute('data-signature') || 'null');
  } catch (error) {
    return;
  }
  if (!data) return;

  var statusEl = document.getElementById('signature-image-status');
  var previewEl = document.getElementById('signature-image-preview');
  var rebuildBtn = document.getElementById('signature-image-rebuild');

  var SERIF = "Georgia, 'Times New Roman', Times, serif";
  var SANS = "Arial, 'Helvetica Neue', Helvetica, sans-serif";

  function say(message) {
    if (statusEl) statusEl.textContent = message || '';
  }

  function loadImage(src) {
    return new Promise(function (resolve) {
      if (!src) { resolve(null); return; }
      var img = new Image();
      // Same-origin, so the canvas is never tainted and toBlob keeps working.
      img.onload = function () {
        // A placeholder pixel would be scaled into a large empty band, so treat
        // anything that small as no image at all.
        resolve(img.naturalWidth > 4 && img.naturalHeight > 4 ? img : null);
      };
      img.onerror = function () { resolve(null); };
      img.src = src;
    });
  }

  /** Draw text with letter spacing, which canvas does not support directly. */
  function trackedText(ctx, text, x, y, tracking) {
    if (!tracking) { ctx.fillText(text, x, y); return ctx.measureText(text).width; }
    var cursor = x;
    for (var i = 0; i < text.length; i += 1) {
      var ch = text.charAt(i);
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + tracking;
    }
    return cursor - x;
  }

  function measureBlockHeight(hasBook, hasCover, showSchool, showSubtitle, hasCredentials, logo) {
    var h = M.paddingTop;
    if (logo) h += Math.round(logo.height * (M.logoWidth / logo.width)) + M.gapAfterLogo;
    h += M.nameLeading;
    if (hasCredentials) h += 5 + M.credentialsLeading;
    if (showSchool) h += 5 + M.schoolLeading;
    if (showSubtitle) h += 3 + M.subtitleLeading;
    if (hasBook) {
      h += M.gapBeforeRule + 1 + M.gapAfterRule;
      var textBlock = M.labelLeading + 4 + M.titleLeading + (data.book.author ? 2 + M.authorLeading : 0);
      var coverBlock = hasCover ? Math.round(M.coverWidth * 1.5) : 0;
      h += Math.max(textBlock, coverBlock);
    }
    return h + M.paddingBottom;
  }

  function render() {
    say('Building the signature image...');

    return Promise.all([loadImage(data.logoUrl), loadImage(data.coverUrl)]).then(function (images) {
      var logo = images[0];
      var cover = images[1];

      var hasBook = !!data.book;
      var hasCover = hasBook && !!cover;
      var showSchool = !!data.school;
      var showSubtitle = !!data.subtitle;
      var hasCredentials = !!data.credentials;

      var height = measureBlockHeight(hasBook, hasCover, showSchool, showSubtitle, hasCredentials, logo);

      var canvas = document.createElement('canvas');
      canvas.width = M.width * M.pixelRatio;
      canvas.height = height * M.pixelRatio;
      var ctx = canvas.getContext('2d');
      ctx.scale(M.pixelRatio, M.pixelRatio);

      // White background: mail clients composite onto unpredictable colours, and
      // a transparent PNG would show whatever is behind it.
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, M.width, height);

      ctx.fillStyle = data.colours.navy;
      ctx.fillRect(0, 0, M.barWidth, height);

      var x = M.barWidth + M.paddingLeft;
      var y = M.paddingTop;
      ctx.textBaseline = 'top';

      if (logo) {
        var logoHeight = Math.round(logo.height * (M.logoWidth / logo.width));
        ctx.drawImage(logo, x, y, M.logoWidth, logoHeight);
        y += logoHeight + M.gapAfterLogo;
      }

      ctx.fillStyle = data.colours.navy;
      ctx.font = 'bold ' + M.nameSize + 'px ' + SERIF;
      ctx.fillText(data.name, x, y);
      y += M.nameLeading;

      if (hasCredentials) {
        y += 5;
        ctx.fillStyle = data.colours.rose;
        ctx.font = 'bold ' + M.credentialsSize + 'px ' + SANS;
        trackedText(ctx, data.credentials.toUpperCase(), x, y, M.credentialsTracking);
        y += M.credentialsLeading;
      }

      if (showSchool) {
        y += 5;
        ctx.fillStyle = data.colours.muted;
        ctx.font = M.schoolSize + 'px ' + SERIF;
        ctx.fillText(data.school, x, y);
        y += M.schoolLeading;
      }

      if (showSubtitle) {
        y += 3;
        ctx.fillStyle = data.colours.muted;
        ctx.font = 'italic ' + M.subtitleSize + 'px ' + SANS;
        ctx.fillText(data.subtitle, x, y);
        y += M.subtitleLeading;
      }

      if (hasBook) {
        y += M.gapBeforeRule;
        ctx.fillStyle = data.colours.gold;
        ctx.fillRect(x, y, M.ruleWidth, 1);
        y += 1 + M.gapAfterRule;

        var textX = x;
        if (hasCover) {
          var coverHeight = Math.round(cover.height * (M.coverWidth / cover.width));
          ctx.drawImage(cover, x, y, M.coverWidth, coverHeight);
          textX = x + M.coverWidth + M.coverGap;
        }

        var ty = y;
        ctx.fillStyle = data.colours.muted;
        ctx.font = M.labelSize + 'px ' + SANS;
        trackedText(ctx, 'CURRENTLY READING', textX, ty, M.labelTracking);
        ty += M.labelLeading + 4;

        ctx.fillStyle = data.colours.navy;
        ctx.font = 'bold italic ' + M.titleSize + 'px ' + SERIF;
        ctx.fillText(data.book.title, textX, ty);
        ty += M.titleLeading;

        if (data.book.author) {
          ty += 2;
          ctx.fillStyle = data.colours.muted;
          ctx.font = M.authorSize + 'px ' + SANS;
          ctx.fillText(data.book.author, textX, ty);
        }
      }

      return new Promise(function (resolve, reject) {
        canvas.toBlob(function (blob) {
          if (blob) resolve({ blob: blob, width: M.width, height: height });
          else reject(new Error('could not export the image'));
        }, 'image/png');
      });
    });
  }

  function upload(result) {
    var form = new FormData();
    form.append('csrf', root.getAttribute('data-csrf') || '');
    form.append('revision', String(data.revision));
    form.append('width', String(result.width));
    form.append('height', String(result.height));
    form.append('image', result.blob, 'signature.png');

    return fetch('/admin/signature/image', {
      method: 'POST',
      body: form,
      credentials: 'same-origin',
    }).then(function (response) {
      if (!response.ok) throw new Error('upload failed');
      return response;
    });
  }

  function run() {
    return render()
      .then(upload)
      .then(function () {
        say('Signature image is up to date.');
        if (previewEl) {
          // Cache-bust the preview only; the address used in email stays stable.
          previewEl.src = previewEl.getAttribute('data-src') + '?preview=' + Date.now();
        }
        root.setAttribute('data-stale', 'false');
      })
      .catch(function (error) {
        say('The signature image could not be rebuilt: ' + error.message);
      });
  }

  if (rebuildBtn) {
    rebuildBtn.hidden = false;
    rebuildBtn.addEventListener('click', function () { run(); });
  }

  // Rebuild whenever the stored image is older than the current details.
  if (root.getAttribute('data-stale') === 'true') {
    run();
  } else {
    say('Signature image is up to date.');
  }
})();
`;
