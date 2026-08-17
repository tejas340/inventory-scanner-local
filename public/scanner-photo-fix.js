// iPhone/photo barcode decoder patch.
// This file intercepts the photo input before app.js handles it, then uses
// multiple canvas attempts so iPhone photos are much more likely to decode.

const ZXING_URLS = [
  'https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/umd/zxing-browser.min.js',
  'https://unpkg.com/@zxing/browser@0.2.1'
];

let zxingPromise = null;

document.addEventListener('change', async (event) => {
  const input = event.target;
  if (!(input instanceof HTMLInputElement) || input.id !== 'barcodePhoto') return;

  // Stop app.js's original single-attempt decoder. This patch takes over.
  event.stopImmediatePropagation();

  const file = input.files?.[0];
  input.value = '';
  if (!file) return;

  const resultBox = document.querySelector('#scanResult');
  if (resultBox) {
    resultBox.innerHTML = '<div class="notice">Reading barcode photo…</div>';
  }

  try {
    const value = await decodePhotoRobust(file);
    if (!value) {
      throw new Error('Barcode not detected. Move closer, keep the whole barcode sharp and well lit, then try again.');
    }

    const manualInput = document.querySelector('#manualBarcode');
    const manualForm = document.querySelector('#manualScan');
    if (!manualInput || !manualForm) {
      throw new Error('Scanner screen changed. Please reopen Scan and try again.');
    }

    manualInput.value = value;
    manualForm.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  } catch (error) {
    if (resultBox) {
      resultBox.innerHTML = `<div class="notice warning">${escapeForHtml(error?.message || 'Could not read that barcode photo.')}</div>`;
    }
  }
}, true);

async function decodePhotoRobust(file) {
  const image = await loadImageFile(file);
  const canvases = buildDecodeAttempts(image);

  // Native BarcodeDetector first when the browser provides it.
  if ('BarcodeDetector' in window) {
    try {
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
      });
      for (const canvas of canvases) {
        try {
          const codes = await detector.detect(canvas);
          const value = codes?.[0]?.rawValue;
          if (value) return String(value).trim();
        } catch {}
      }
    } catch {}
  }

  const ZXingBrowser = await loadZXing();
  const reader = new ZXingBrowser.BrowserMultiFormatReader();

  for (const canvas of canvases) {
    try {
      const result = reader.decodeFromCanvas(canvas);
      const value = barcodeText(result);
      if (value) return value;
    } catch {
      // Try the next crop/rotation/contrast variant.
    }
  }

  return '';
}

async function loadImageFile(file) {
  const url = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';

  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not open that photo. Please take it again.'));
      image.src = url;
    });
    return image;
  } finally {
    // Keep the image pixels alive; revoking after load is safe in modern Safari.
    URL.revokeObjectURL(url);
  }
}

function buildDecodeAttempts(image) {
  const attempts = [];
  const base = drawScaled(image, 2400);
  attempts.push(base);

  // Rotations help with EXIF/orientation edge cases and sideways bottle photos.
  attempts.push(rotateCanvas(base, 90));
  attempts.push(rotateCanvas(base, 270));
  attempts.push(rotateCanvas(base, 180));

  // Common barcode framing: full-width horizontal bands.
  attempts.push(cropCanvas(base, 0, 0.18, 1, 0.64));
  attempts.push(cropCanvas(base, 0, 0.30, 1, 0.40));

  // Common handheld framing: centered area.
  attempts.push(cropCanvas(base, 0.08, 0.15, 0.84, 0.70));

  // Higher contrast variants can help glossy labels and dim rooms.
  const snapshot = [...attempts];
  for (const canvas of snapshot.slice(0, 4)) {
    attempts.push(highContrastCanvas(canvas));
  }

  return attempts.filter(Boolean);
}

function drawScaled(image, maxDimension) {
  const width = image.naturalWidth || image.width;
  const height = image.naturalHeight || image.height;
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function rotateCanvas(source, degrees) {
  const swap = Math.abs(degrees) % 180 === 90;
  const canvas = document.createElement('canvas');
  canvas.width = swap ? source.height : source.width;
  canvas.height = swap ? source.width : source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((degrees * Math.PI) / 180);
  ctx.drawImage(source, -source.width / 2, -source.height / 2);
  return canvas;
}

function cropCanvas(source, xRatio, yRatio, wRatio, hRatio) {
  const sx = Math.round(source.width * xRatio);
  const sy = Math.round(source.height * yRatio);
  const sw = Math.max(1, Math.round(source.width * wRatio));
  const sh = Math.max(1, Math.round(source.height * hRatio));
  const canvas = document.createElement('canvas');
  canvas.width = sw;
  canvas.height = sh;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, sx, sy, sw, sh, 0, 0, sw, sh);
  return canvas;
}

function highContrastCanvas(source) {
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;

  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    const boosted = Math.max(0, Math.min(255, (gray - 128) * 1.65 + 128));
    data[i] = boosted;
    data[i + 1] = boosted;
    data[i + 2] = boosted;
  }

  ctx.putImageData(imageData, 0, 0);
  return canvas;
}

function barcodeText(result) {
  if (!result) return '';
  if (typeof result.getText === 'function') return String(result.getText()).trim();
  return String(result.text || result.rawValue || '').trim();
}

async function loadZXing() {
  if (window.ZXingBrowser) return window.ZXingBrowser;
  if (zxingPromise) return zxingPromise;

  zxingPromise = (async () => {
    for (const src of ZXING_URLS) {
      try {
        await loadScript(src);
        if (window.ZXingBrowser) return window.ZXingBrowser;
      } catch {}
    }
    throw new Error('Barcode helper could not load. Connect to the internet once and try again, or use manual barcode entry.');
  })();

  try {
    return await zxingPromise;
  } catch (error) {
    zxingPromise = null;
    throw error;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.async = true;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function escapeForHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
