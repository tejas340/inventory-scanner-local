// Fast live barcode detector for iPhone/Safari.
// Safari may provide camera access without the BarcodeDetector API. This polyfill
// gives app.js a BarcodeDetector-compatible interface backed by ZXing and scans
// the live video continuously without requiring a capture button.

(() => {
  if ('BarcodeDetector' in window) return;

  const ZXING_URLS = [
    'https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/umd/zxing-browser.min.js',
    'https://unpkg.com/@zxing/browser@0.2.1'
  ];

  let zxingPromise = null;
  let reader = null;
  let busy = false;
  let lastAttempt = 0;
  let lastValue = '';
  let lastValueAt = 0;

  class FastBarcodeDetector {
    constructor(options = {}) {
      this.formats = options.formats || [];
      this.canvas = document.createElement('canvas');
      this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
      this.centerCanvas = document.createElement('canvas');
      this.centerCtx = this.centerCanvas.getContext('2d', { willReadFrequently: true });
    }

    static async getSupportedFormats() {
      return ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code'];
    }

    async detect(source) {
      const now = performance.now();

      // About 8 decoding attempts/second is fast enough for instant-feeling scans
      // while leaving Safari enough time to keep the camera preview smooth.
      if (busy || now - lastAttempt < 120) return [];
      if (!source || !source.videoWidth || !source.videoHeight || source.readyState < 2) return [];

      lastAttempt = now;
      busy = true;

      try {
        const ZXingBrowser = await loadZXing();
        if (!reader) reader = new ZXingBrowser.BrowserMultiFormatReader();

        const value = this.decodeVideoFrame(source);
        if (!value) return [];

        // Ignore the same visible barcode for 1.5 seconds so one bottle does not
        // register repeatedly while the camera remains pointed at it.
        if (value === lastValue && now - lastValueAt < 1500) return [];
        lastValue = value;
        lastValueAt = now;

        try {
          navigator.vibrate?.(70);
        } catch {}

        return [{ rawValue: value, format: 'unknown' }];
      } catch {
        return [];
      } finally {
        busy = false;
      }
    }

    decodeVideoFrame(video) {
      // Decode a moderately sized frame. Enlarging beyond this tends to slow
      // iPhones down without improving normal UPC/EAN recognition.
      const maxWidth = 1280;
      const scale = Math.min(1, maxWidth / video.videoWidth);
      const width = Math.max(320, Math.round(video.videoWidth * scale));
      const height = Math.max(240, Math.round(video.videoHeight * scale));

      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width;
        this.canvas.height = height;
      }
      this.ctx.drawImage(video, 0, 0, width, height);

      // First try the center band where the orange scan frame is shown. This is
      // faster and works especially well for horizontal bottle UPC/EAN labels.
      const cropX = Math.round(width * 0.05);
      const cropY = Math.round(height * 0.18);
      const cropW = Math.round(width * 0.90);
      const cropH = Math.round(height * 0.64);

      if (this.centerCanvas.width !== cropW || this.centerCanvas.height !== cropH) {
        this.centerCanvas.width = cropW;
        this.centerCanvas.height = cropH;
      }
      this.centerCtx.drawImage(this.canvas, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);

      const center = tryDecodeCanvas(reader, this.centerCanvas);
      if (center) return center;

      // Fall back to the whole camera frame for angled or off-center labels.
      return tryDecodeCanvas(reader, this.canvas);
    }
  }

  function tryDecodeCanvas(activeReader, canvas) {
    try {
      const result = activeReader.decodeFromCanvas(canvas);
      if (!result) return '';
      if (typeof result.getText === 'function') return String(result.getText()).trim();
      return String(result.text || result.rawValue || '').trim();
    } catch {
      return '';
    }
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
      throw new Error('Barcode helper could not load.');
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
      const existing = [...document.scripts].find((script) => script.src === src);
      if (existing) {
        if (window.ZXingBrowser) return resolve();
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  window.BarcodeDetector = FastBarcodeDetector;
})();
