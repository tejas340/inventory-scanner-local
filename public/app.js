const state = {
  view: 'dashboard',
  options: {},
  templateColumns: [],
  demo: localStorage.getItem('inventory-demo-mode') === '1',
  scanner: {
    stream: null,
    detector: null,
    zxingReader: null,
    zxingControls: null,
    zxingPromise: null,
    active: false,
    handling: false,
    lastCode: '',
    rapid: false,
    countMode: false,
    product: null,
    barcode: ''
  }
};

const app = document.querySelector('#app');
const toast = document.querySelector('#toast');
const demoToggle = document.querySelector('#demoToggle');
const connectionText = document.querySelector('#connectionText');

init();

async function init() {
  demoToggle.checked = state.demo;
  demoToggle.closest('.demo-switch').classList.toggle('active', state.demo);
  demoToggle.addEventListener('change', async () => {
    state.demo = demoToggle.checked;
    localStorage.setItem('inventory-demo-mode', state.demo ? '1' : '0');
    demoToggle.closest('.demo-switch').classList.toggle('active', state.demo);
    toastMessage(state.demo ? 'Demo mode is on. Real inventory is safe.' : 'Real inventory mode is on.');
    await loadOptions();
    render();
  });

  document.querySelectorAll('.tab').forEach((button) => {
    button.addEventListener('click', () => setView(button.dataset.view));
  });

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  await loadOptions();
  await healthCheck();
  render();
}

async function healthCheck() {
  try {
    const health = await api('/api/health');
    const iphone = health.addresses?.[0];
    connectionText.textContent = iphone ? `Mac ready at ${iphone}` : 'Local Mac storage';
  } catch {
    connectionText.textContent = 'Trying to connect';
  }
}

function setView(view) {
  stopScanner();
  state.view = view;
  document.querySelectorAll('.tab').forEach((button) => {
    button.classList.toggle('active', button.dataset.view === view);
  });
  render();
  app.focus({ preventScroll: true });
}

async function loadOptions() {
  const data = await api('/api/options');
  state.options = data.options || {};
  state.templateColumns = data.templateColumns || [];
}

function render() {
  if (state.view === 'dashboard') renderDashboard();
  if (state.view === 'scan') renderScan();
  if (state.view === 'inventory') renderInventory();
  if (state.view === 'history') renderHistory();
  if (state.view === 'export') renderExport();
  if (state.view === 'lists') renderLists();
}

async function renderDashboard() {
  app.innerHTML = screenShell('Dashboard', 'Quick view of stock, alerts, and the latest changes.', `
    <div class="grid four" id="statsSkeleton">
      ${['Products', 'Units', 'Low stock', 'Need attention'].map((label) => `
        <div class="stat"><span>${label}</span><strong>...</strong></div>
      `).join('')}
    </div>
    <section class="quick-actions">
      ${button('Scan Bottle', 'primary', 'data-go="scan"')}
      ${button('Stock Count', 'teal', 'data-go="scan-count"')}
      ${button('Search Inventory', '', 'data-go="inventory"')}
      ${button('Export Excel', 'warning', 'data-go="export"')}
    </section>
    <section class="grid two">
      <div class="panel">
        <h2>Low Stock</h2>
        <div id="lowStockList" class="table-list"></div>
      </div>
      <div class="panel">
        <h2>Recent Changes</h2>
        <div id="recentHistoryList" class="table-list"></div>
      </div>
    </section>
  `);

  app.querySelector('[data-go="scan"]').addEventListener('click', () => setView('scan'));
  app.querySelector('[data-go="scan-count"]').addEventListener('click', () => {
    state.scanner.countMode = true;
    setView('scan');
  });
  app.querySelector('[data-go="inventory"]').addEventListener('click', () => setView('inventory'));
  app.querySelector('[data-go="export"]').addEventListener('click', () => setView('export'));

  try {
    const data = await api('/api/dashboard');
    const stats = data.stats || {};
    app.querySelector('#statsSkeleton').innerHTML = `
      ${stat('Products', stats.total_products || 0)}
      ${stat('Units in Stock', prettyNumber(stats.total_units || 0))}
      ${stat('Low Stock', stats.low_stock_count || 0)}
      ${stat('Need Attention', stats.attention_count || 0)}
    `;
    renderProductList(app.querySelector('#lowStockList'), data.lowStock || [], { compact: true });
    renderHistoryList(app.querySelector('#recentHistoryList'), data.recentHistory || []);
  } catch (error) {
    showError(error);
  }
}

function renderScan() {
  state.scanner.product = null;
  state.scanner.barcode = '';
  app.innerHTML = screenShell('Scan', 'Scan a barcode, check the linked bottle details, then save stock in, stock out, or stock count.', `
    <div class="scanner-layout">
      <section class="panel">
        <div class="mode-line">
          ${button('Start Camera', 'primary', 'id="startCamera"')}
          ${button('Take Barcode Photo', '', 'id="photoScan" type="button"')}
          ${button('Stop', 'ghost', 'id="stopCamera"')}
          <label class="checkbox-line"><input type="checkbox" id="rapidToggle" ${state.scanner.rapid ? 'checked' : ''}> Rapid scan</label>
          <label class="checkbox-line"><input type="checkbox" id="countToggle" ${state.scanner.countMode ? 'checked' : ''}> Stock count</label>
        </div>
        <input class="visually-hidden" id="barcodePhoto" type="file" accept="image/*" capture="environment">
        <div class="scanner-box" id="scannerBox">
          <div class="scanner-placeholder">
            <div>
              <h2>Ready to scan</h2>
              <p>Use live camera, take a barcode photo, or type the number manually.</p>
            </div>
          </div>
          <div class="scanner-frame" aria-hidden="true"></div>
        </div>
        <form id="manualScan" class="inline-form" autocomplete="off">
          <div class="field">
            <label for="manualBarcode">Manual barcode</label>
            <input class="input" id="manualBarcode" name="barcode" inputmode="text" placeholder="Type or paste barcode">
          </div>
          <div class="button-row">
            ${button('Use Barcode', 'primary', 'type="submit"')}
            ${button('Try Demo Barcode', '', 'type="button" id="demoBarcode"')}
          </div>
        </form>
      </section>
      <section class="panel" id="scanResult">
        ${scanWaitingHtml()}
      </section>
    </div>
  `);

  app.querySelector('#startCamera').addEventListener('click', startScanner);
  app.querySelector('#photoScan').addEventListener('click', () => app.querySelector('#barcodePhoto').click());
  app.querySelector('#barcodePhoto').addEventListener('change', scanBarcodePhoto);
  app.querySelector('#stopCamera').addEventListener('click', stopScanner);
  app.querySelector('#rapidToggle').addEventListener('change', (event) => {
    state.scanner.rapid = event.target.checked;
  });
  app.querySelector('#countToggle').addEventListener('change', (event) => {
    state.scanner.countMode = event.target.checked;
  });
  app.querySelector('#manualScan').addEventListener('submit', (event) => {
    event.preventDefault();
    const code = new FormData(event.target).get('barcode');
    handleBarcode(code);
  });
  app.querySelector('#demoBarcode').addEventListener('click', () => {
    if (!state.demo) {
      state.demo = true;
      demoToggle.checked = true;
      demoToggle.dispatchEvent(new Event('change'));
    }
    handleBarcode('DEMO-750-001');
  });
}

function scanWaitingHtml() {
  return `
    <h2>Waiting for barcode</h2>
    <p class="muted">Known bottles will prefill bottle name, size, vendor, quality, and location. If something important is blank, you can fill it now or keep moving.</p>
  `;
}

async function startScanner() {
  const resultBox = app.querySelector('#scanResult');
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error(cameraAccessMessage());
    }

    stopScanner();
    state.scanner.active = true;

    const scannerBox = app.querySelector('#scannerBox');
    scannerBox.innerHTML = '<video id="video" playsinline muted></video><div class="scanner-frame" aria-hidden="true"></div>';
    const video = scannerBox.querySelector('video');

    if ('BarcodeDetector' in window) {
      await startNativeScanner(video);
    } else {
      await startZxingScanner(video);
    }

    resultBox.innerHTML = '<div class="notice success">Camera is on. Point it at the barcode.</div>';
  } catch (error) {
    stopScanner();
    resultBox.innerHTML = `<div class="notice warning">${escapeHtml(error.message)}</div>`;
  }
}

async function startNativeScanner(video) {
  state.scanner.detector = new BarcodeDetector({
    formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
  });
  state.scanner.stream = await navigator.mediaDevices.getUserMedia({
    video: cameraConstraints(),
    audio: false
  });
  video.srcObject = state.scanner.stream;
  await video.play();
  scanLoop(video);
}

async function startZxingScanner(video) {
  const ZXingBrowser = await loadZxingLibrary();
  state.scanner.zxingReader = new ZXingBrowser.BrowserMultiFormatReader();
  state.scanner.zxingControls = await state.scanner.zxingReader.decodeFromConstraints(
    { video: cameraConstraints(), audio: false },
    video,
    async (result) => {
      const value = barcodeText(result);
      if (value) await onDetectedBarcode(value);
    }
  );
}

async function scanLoop(video) {
  if (!state.scanner.active || !state.scanner.detector) return;
  try {
    const codes = await state.scanner.detector.detect(video);
    const value = codes?.[0]?.rawValue;
    if (value) await onDetectedBarcode(value);
  } catch {
    // A camera frame can fail while focus adjusts; the next frame usually succeeds.
  }
  requestAnimationFrame(() => scanLoop(video));
}

async function onDetectedBarcode(value) {
  if (!state.scanner.active || state.scanner.handling || value === state.scanner.lastCode) return;
  state.scanner.handling = true;
  state.scanner.lastCode = value;
  try {
    await handleBarcode(value);
    if (!state.scanner.rapid) {
      stopScanner();
    }
  } finally {
    state.scanner.handling = false;
  }
}

function stopScanner() {
  state.scanner.active = false;
  state.scanner.handling = false;
  state.scanner.lastCode = '';
  if (state.scanner.zxingControls) {
    try {
      state.scanner.zxingControls.stop();
    } catch {}
  }
  if (state.scanner.zxingReader?.reset) {
    state.scanner.zxingReader.reset();
  }
  state.scanner.zxingControls = null;
  state.scanner.zxingReader = null;
  state.scanner.detector = null;
  if (state.scanner.stream) {
    state.scanner.stream.getTracks().forEach((track) => track.stop());
  }
  state.scanner.stream = null;
}

async function scanBarcodePhoto(event) {
  const file = event.target.files?.[0];
  event.target.value = '';
  if (!file) return;

  const resultBox = app.querySelector('#scanResult');
  resultBox.innerHTML = '<div class="notice">Reading barcode photo...</div>';

  try {
    const value = await decodeBarcodeImage(file);
    if (!value) {
      throw new Error('No barcode found in that photo. Try again with the barcode closer and brighter.');
    }
    await handleBarcode(value);
  } catch (error) {
    resultBox.innerHTML = `<div class="notice warning">${escapeHtml(error.message)}</div>`;
  }
}

async function decodeBarcodeImage(file) {
  const imageUrl = URL.createObjectURL(file);
  const image = new Image();
  image.decoding = 'async';
  try {
    await new Promise((resolve, reject) => {
      image.onload = resolve;
      image.onerror = () => reject(new Error('Could not read that photo. Try taking it again.'));
      image.src = imageUrl;
    });

    if ('BarcodeDetector' in window) {
      const detector = new BarcodeDetector({
        formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'qr_code']
      });
      const codes = await detector.detect(image);
      const value = codes?.[0]?.rawValue;
      if (value) return value;
    }

    const ZXingBrowser = await loadZxingLibrary();
    const reader = new ZXingBrowser.BrowserMultiFormatReader();
    const result = await reader.decodeFromImageElement(image);
    return barcodeText(result);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function cameraConstraints() {
  return {
    facingMode: { ideal: 'environment' },
    width: { ideal: 1280 },
    height: { ideal: 720 }
  };
}

function cameraAccessMessage() {
  if (!window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
    return 'Live camera needs a secure local address on iPhone. Tap Take Barcode Photo or use manual barcode entry for now.';
  }
  return 'Camera is not available in this browser. Tap Take Barcode Photo or use manual barcode entry.';
}

function barcodeText(result) {
  if (!result) return '';
  if (typeof result.getText === 'function') return result.getText();
  return result.text || result.rawValue || '';
}

async function loadZxingLibrary() {
  if (window.ZXingBrowser) return Promise.resolve(window.ZXingBrowser);
  if (state.scanner.zxingPromise) return state.scanner.zxingPromise;

  const urls = [
    'https://unpkg.com/@zxing/browser@0.2.1',
    'https://cdn.jsdelivr.net/npm/@zxing/browser@0.2.1/umd/zxing-browser.min.js'
  ];

  state.scanner.zxingPromise = loadFirstScript(urls).then(() => window.ZXingBrowser);

  return state.scanner.zxingPromise;
}

async function loadFirstScript(urls) {
  for (const url of urls) {
    try {
      await loadScript(url);
      if (window.ZXingBrowser) return;
    } catch {}
  }
  state.scanner.zxingPromise = null;
  throw new Error('Could not load the barcode scanner helper. Check internet once, then try again, or use manual entry.');
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

async function handleBarcode(rawCode) {
  const barcode = String(rawCode || '').trim();
  if (!barcode) {
    toastMessage('Enter a barcode first.');
    return;
  }

  state.scanner.barcode = barcode;
  const resultBox = app.querySelector('#scanResult');
  resultBox.innerHTML = '<div class="notice">Checking barcode...</div>';

  try {
    const data = await api(`/api/products/barcode/${encodeURIComponent(barcode)}`);
    if (!data.found) {
      resultBox.innerHTML = unknownProductHtml(barcode);
      bindProductForm(resultBox.querySelector('form'), null, barcode, async (product) => {
        await showScannedProduct(product);
      });
      return;
    }
    await showScannedProduct(data.product);
  } catch (error) {
    showError(error);
  }
}

async function showScannedProduct(product) {
  state.scanner.product = product;
  const missing = missingFields(product);
  const resultBox = app.querySelector('#scanResult');

  if (missing.length) {
    resultBox.innerHTML = `
      <div class="notice warning">
        <strong>Some details are blank</strong>
        <p>${missing.map(labelForField).join(', ')} not filled. You can fill it now or tap Next.</p>
        <div class="button-row">
          ${button('Fill Now', 'primary', 'id="fillNow"')}
          ${button('Next', '', 'id="skipMissing"')}
        </div>
      </div>
      ${productSummaryHtml(product)}
    `;
    resultBox.querySelector('#fillNow').addEventListener('click', () => {
      resultBox.innerHTML = productFormHtml(product, product.barcode);
      bindProductForm(resultBox.querySelector('form'), product, product.barcode, showScannedProduct);
    });
    resultBox.querySelector('#skipMissing').addEventListener('click', () => showStockForm(product));
    return;
  }

  showStockForm(product);
}

function showStockForm(product) {
  const action = state.scanner.countMode ? 'set' : 'stock_in';
  const resultBox = app.querySelector('#scanResult');
  resultBox.innerHTML = `
    ${productSummaryHtml(product)}
    ${stockFormHtml(product, action)}
  `;
  bindStockForm(resultBox.querySelector('form'));
}

function unknownProductHtml(barcode) {
  return `
    <div class="notice warning">
      <strong>New barcode</strong>
      <p>This bottle is not linked yet. Save what you know now. Only barcode is required.</p>
    </div>
    ${productFormHtml(null, barcode)}
  `;
}

function productSummaryHtml(product) {
  return `
    <div class="product-card">
      <div>
        <h3>${escapeHtml(product.product_name || 'Bottle name not filled')}</h3>
        <div class="meta">
          <span>${escapeHtml(product.barcode)}</span>
          <span>${escapeHtml(product.bottle_size || 'Size not filled')}</span>
          <span>${escapeHtml(product.vendor || 'Vendor not filled')}</span>
          <span>${escapeHtml(product.location || 'No location')}</span>
        </div>
      </div>
      <div class="quantity">
        <span class="pill ${stockPillClass(product)}">${stockLabel(product)}</span>
        <strong>${prettyNumber(product.quantity)}</strong>
      </div>
    </div>
  `;
}

function productFormHtml(product, barcode) {
  return `
    <form class="inline-form product-form" autocomplete="off">
      ${product?.id ? `<input type="hidden" name="id" value="${product.id}">` : ''}
      <div class="grid two">
        ${field('Barcode', 'barcode', product?.barcode || barcode || '', { required: true })}
        ${field('Bottle/Product Name', 'product_name', product?.product_name || '')}
        ${field('Bottle Size', 'bottle_size', product?.bottle_size || '', { list: 'bottle_size' })}
        ${field('Vendor Name', 'vendor', product?.vendor || '', { list: 'vendor' })}
        ${field('Category', 'category', product?.category || '', { list: 'category' })}
        ${field('Storage Location', 'location', product?.location || '', { list: 'location' })}
        ${field('Quality/Condition', 'quality', product?.quality || 'Good', { list: 'quality' })}
        ${field('Current Quantity', 'quantity', product?.quantity ?? 0, { type: 'number', step: '0.01' })}
        ${field('Low Stock Level', 'low_stock_level', product?.low_stock_level ?? 0, { type: 'number', step: '0.01' })}
      </div>
      <div class="field">
        <label for="notes">Notes</label>
        <textarea class="textarea" id="notes" name="notes">${escapeHtml(product?.notes || '')}</textarea>
      </div>
      ${datalists()}
      <div class="button-row">
        ${button('Save Bottle', 'primary', 'type="submit"')}
      </div>
    </form>
  `;
}

function bindProductForm(form, product, barcode, afterSave) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    payload.id = payload.id || product?.id;
    payload.barcode = payload.barcode || barcode;
    try {
      const result = await api('/api/products', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      await loadOptions();
      toastMessage('Bottle saved.');
      afterSave(result.product);
    } catch (error) {
      showError(error);
    }
  });
}

function stockFormHtml(product, selectedAction = 'stock_in') {
  return `
    <form class="inline-form stock-form" autocomplete="off">
      <input type="hidden" name="product_id" value="${product.id}">
      <input type="hidden" name="action" value="${selectedAction}">
      <div class="field">
        <label>Action</label>
        <div class="segmented">
          <button type="button" data-action="stock_in" class="${selectedAction === 'stock_in' ? 'active' : ''}">Stock In</button>
          <button type="button" data-action="stock_out" class="${selectedAction === 'stock_out' ? 'active' : ''}">Stock Out</button>
          <button type="button" data-action="set" class="${selectedAction === 'set' ? 'active' : ''}">Set Quantity</button>
        </div>
      </div>
      <div class="grid two">
        ${field(selectedAction === 'set' ? 'Actual Quantity' : 'Quantity', 'quantity', '', { type: 'number', step: '0.01', required: true })}
        ${field('Quality/Condition', 'quality', product.quality || 'Good', { list: 'quality' })}
        ${field('Reason', 'reason', state.scanner.countMode ? 'Physical Count' : '', { list: 'reason' })}
        ${field('Location', 'location', product.location || '', { list: 'location' })}
      </div>
      <div class="field">
        <label for="stockNotes">Notes</label>
        <textarea class="textarea" id="stockNotes" name="notes" placeholder="Optional"></textarea>
      </div>
      ${datalists()}
      <div class="button-row">
        ${button('Save', 'primary', 'type="submit"')}
        ${button('Edit Bottle Details', '', 'type="button" id="editScannedProduct"')}
      </div>
    </form>
  `;
}

function bindStockForm(form) {
  form.querySelectorAll('[data-action]').forEach((buttonEl) => {
    buttonEl.addEventListener('click', () => {
      form.action.value = buttonEl.dataset.action;
      form.querySelectorAll('[data-action]').forEach((item) => item.classList.toggle('active', item === buttonEl));
      form.querySelector('label[for="quantity"]').textContent = buttonEl.dataset.action === 'set' ? 'Actual Quantity' : 'Quantity';
    });
  });

  form.querySelector('#editScannedProduct').addEventListener('click', () => {
    const resultBox = app.querySelector('#scanResult');
    resultBox.innerHTML = productFormHtml(state.scanner.product, state.scanner.product.barcode);
    bindProductForm(resultBox.querySelector('form'), state.scanner.product, state.scanner.product.barcode, showScannedProduct);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());
    try {
      const result = await api('/api/stock', {
        method: 'POST',
        body: JSON.stringify(payload)
      });
      state.scanner.product = result.product;
      toastMessage('Stock saved.');
      if (state.scanner.rapid) {
        app.querySelector('#scanResult').innerHTML = scanWaitingHtml();
        app.querySelector('#manualBarcode').value = '';
        app.querySelector('#manualBarcode').focus();
        if (!state.scanner.active) startScanner();
      } else {
        await showScannedProduct(result.product);
      }
    } catch (error) {
      showError(error);
    }
  });
}

async function renderInventory() {
  app.innerHTML = screenShell('Inventory', 'Search by bottle name, barcode, vendor, size, category, or location.', `
    <section class="panel flat">
      <form id="inventorySearch" class="toolbar" autocomplete="off">
        <input class="input" name="search" placeholder="Search inventory" style="max-width: 520px">
        ${button('Search', 'primary', 'type="submit"')}
        ${button('Add Bottle', '', 'type="button" id="addProduct"')}
      </form>
    </section>
    <section id="inventoryList" class="table-list"></section>
  `);

  app.querySelector('#inventorySearch').addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadInventory(new FormData(event.target).get('search'));
  });
  app.querySelector('#addProduct').addEventListener('click', () => {
    app.querySelector('#inventoryList').innerHTML = productFormHtml(null, '');
    bindProductForm(app.querySelector('.product-form'), null, '', async () => loadInventory());
  });
  await loadInventory();
}

async function loadInventory(search = '') {
  const container = app.querySelector('#inventoryList');
  container.innerHTML = '<div class="notice">Loading inventory...</div>';
  try {
    const data = await api(`/api/products?search=${encodeURIComponent(search)}`);
    renderProductList(container, data.products || [], { editable: true });
  } catch (error) {
    showError(error);
  }
}

function renderProductList(container, products, { editable = false, compact = false } = {}) {
  if (!products.length) {
    container.innerHTML = emptyHtml();
    return;
  }
  container.innerHTML = products.map((product) => `
    <article class="product-card">
      <div>
        <h3>${escapeHtml(product.product_name || 'Bottle name not filled')}</h3>
        <div class="meta">
          <span class="pill">${escapeHtml(product.barcode)}</span>
          <span>${escapeHtml(product.bottle_size || 'No size')}</span>
          <span>${escapeHtml(product.vendor || 'No vendor')}</span>
          <span>${escapeHtml(product.category || 'No category')}</span>
          <span>${escapeHtml(product.location || 'No location')}</span>
          <span class="pill ${qualityClass(product.quality)}">${escapeHtml(product.quality || 'No quality')}</span>
        </div>
      </div>
      <div class="quantity">
        <span class="pill ${stockPillClass(product)}">${stockLabel(product)}</span>
        <strong>${prettyNumber(product.quantity)}</strong>
        ${editable && !compact ? `<button class="button" data-edit-product="${product.id}">Edit</button>` : ''}
      </div>
    </article>
  `).join('');

  container.querySelectorAll('[data-edit-product]').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async () => {
      const product = products.find((item) => String(item.id) === buttonEl.dataset.editProduct);
      container.innerHTML = `
        ${productFormHtml(product, product.barcode)}
        <div class="button-row">
          ${button('Archive Bottle', 'danger', `type="button" data-archive-product="${product.id}"`)}
          ${button('Back to List', '', 'type="button" id="backToInventory"')}
        </div>
      `;
      bindProductForm(container.querySelector('.product-form'), product, product.barcode, async () => loadInventory());
      container.querySelector('#backToInventory').addEventListener('click', () => loadInventory());
      container.querySelector('[data-archive-product]').addEventListener('click', async () => {
        if (!confirm('Archive this bottle? It will disappear from the active inventory list.')) return;
        await api(`/api/products/${product.id}`, { method: 'DELETE' });
        toastMessage('Bottle archived.');
        loadInventory();
      });
    });
  });
}

async function renderHistory() {
  app.innerHTML = screenShell('History', 'Every stock change is saved here so mistakes can be checked later.', `
    <section class="panel flat">
      <form id="historySearch" class="toolbar" autocomplete="off">
        <input class="input" name="search" placeholder="Search history" style="max-width: 520px">
        ${button('Search', 'primary', 'type="submit"')}
      </form>
    </section>
    <section id="historyList" class="table-list"></section>
  `);
  app.querySelector('#historySearch').addEventListener('submit', async (event) => {
    event.preventDefault();
    await loadHistory(new FormData(event.target).get('search'));
  });
  await loadHistory();
}

async function loadHistory(search = '') {
  const container = app.querySelector('#historyList');
  container.innerHTML = '<div class="notice">Loading history...</div>';
  try {
    const data = await api(`/api/history?limit=200&search=${encodeURIComponent(search)}`);
    renderHistoryList(container, data.history || []);
  } catch (error) {
    showError(error);
  }
}

function renderHistoryList(container, history) {
  if (!history.length) {
    container.innerHTML = emptyHtml();
    return;
  }
  container.innerHTML = history.map((item) => `
    <article class="history-row">
      <div>
        <h3>${escapeHtml(item.product_name || item.barcode)}</h3>
        <div class="meta">
          <span>${formatDate(item.created_at)}</span>
          <span>${escapeHtml(item.barcode)}</span>
          <span class="pill">${humanAction(item.action)}</span>
          <span>${prettyNumber(item.previous_quantity)} to ${prettyNumber(item.new_quantity)}</span>
          ${item.reason ? `<span>${escapeHtml(item.reason)}</span>` : ''}
          ${item.location ? `<span>${escapeHtml(item.location)}</span>` : ''}
        </div>
      </div>
      ${item.notes ? `<p>${escapeHtml(item.notes)}</p>` : ''}
    </article>
  `).join('');
}

async function renderExport() {
  app.innerHTML = screenShell('Export & Backups', 'Download Excel, make backups, and restore from a backup if needed.', `
    <section class="grid two">
      <div class="panel">
        <h2>Excel</h2>
        <p class="muted">The export follows the column order saved in Lists. It includes current inventory, history, low stock, and products tabs.</p>
        <div class="button-row">
          <a class="button primary" id="exportExcel" href="${apiUrl('/api/export.xlsx')}">Download Excel</a>
        </div>
      </div>
      <div class="panel">
        <h2>Demo/Test Mode</h2>
        <p class="muted">Demo mode uses sample inventory so you can practice scanning and saving without touching the real database.</p>
        <div class="button-row">
          ${button('Reset Demo Data', 'warning', 'id="resetDemo"')}
        </div>
      </div>
    </section>
    <section class="panel">
      <div class="screen-title">
        <div>
          <h2>Backups</h2>
          <p>Make a backup before big inventory counts or when handing the app to someone else.</p>
        </div>
        ${button('Make Backup', 'primary', 'id="createBackup"')}
      </div>
      <div id="backupList" class="table-list"></div>
    </section>
  `);

  app.querySelector('#createBackup').addEventListener('click', async () => {
    try {
      await api('/api/backups', { method: 'POST' });
      toastMessage('Backup created.');
      await loadBackups();
    } catch (error) {
      showError(error);
    }
  });

  app.querySelector('#resetDemo').addEventListener('click', async () => {
    try {
      await api('/api/demo/reset', { method: 'POST' });
      toastMessage('Demo data reset.');
    } catch (error) {
      showError(error);
    }
  });

  await loadBackups();
}

async function loadBackups() {
  const container = app.querySelector('#backupList');
  try {
    const data = await api('/api/backups');
    if (!data.backups?.length) {
      container.innerHTML = emptyHtml('No backups yet', 'Tap Make Backup when you are ready.');
      return;
    }

    container.innerHTML = data.backups.map((backup) => `
      <article class="backup-row">
        <div>
          <strong>${escapeHtml(backup.file)}</strong>
          <div class="meta">
            <span>${formatBytes(backup.size)}</span>
            <span>${formatDate(backup.modified_at)}</span>
          </div>
        </div>
        <div class="button-row">
          <a class="button" href="${apiUrl(`/api/backups/${encodeURIComponent(backup.file)}`)}">Download</a>
          ${button('Restore', 'danger', `data-restore="${escapeHtml(backup.file)}"`)}
        </div>
      </article>
    `).join('');

    container.querySelectorAll('[data-restore]').forEach((buttonEl) => {
      buttonEl.addEventListener('click', async () => {
        if (!confirm('Restore this backup? Current inventory will be replaced by the backup.')) return;
        await api(`/api/backups/${encodeURIComponent(buttonEl.dataset.restore)}/restore`, { method: 'POST' });
        toastMessage('Backup restored.');
        setView('dashboard');
      });
    });
  } catch (error) {
    showError(error);
  }
}

function renderLists() {
  const optionTypes = [
    ['bottle_size', 'Bottle Sizes & Units'],
    ['vendor', 'Vendors'],
    ['quality', 'Quality / Condition'],
    ['category', 'Categories'],
    ['location', 'Locations'],
    ['reason', 'Reasons']
  ];

  app.innerHTML = screenShell('Lists & Excel Columns', 'Control the words that appear while scanning and match your Excel or Google Sheet column order.', `
    <section class="grid two">
      ${optionTypes.map(([type, title]) => `
        <div class="panel">
          <h2>${title}</h2>
          <form class="toolbar option-form" data-type="${type}" autocomplete="off">
            <input class="input" name="value" placeholder="Add ${title.toLowerCase()}" style="max-width: 360px">
            ${button('Add', 'primary', 'type="submit"')}
          </form>
          <div class="table-list" id="options-${type}">
            ${optionRows(type)}
          </div>
        </div>
      `).join('')}
    </section>
    <section class="panel">
      <h2>Excel Column Order</h2>
      <p class="muted">Put one column name per line. When you share your formatted sheet later, match these names and order to your sheet.</p>
      <form id="templateColumnsForm" class="inline-form">
        <textarea class="textarea" name="columns" rows="10">${escapeHtml(state.templateColumns.join('\n'))}</textarea>
        <div class="button-row">
          ${button('Save Excel Columns', 'primary', 'type="submit"')}
        </div>
      </form>
    </section>
  `);

  app.querySelectorAll('.option-form').forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const value = new FormData(form).get('value');
      if (!String(value || '').trim()) return;
      try {
        const data = await api('/api/options', {
          method: 'POST',
          body: JSON.stringify({ type: form.dataset.type, value })
        });
        state.options = data.options;
        form.reset();
        renderLists();
      } catch (error) {
        showError(error);
      }
    });
  });

  app.querySelectorAll('[data-delete-option]').forEach((buttonEl) => {
    buttonEl.addEventListener('click', async () => {
      const [type, value] = buttonEl.dataset.deleteOption.split('|');
      try {
        const data = await api('/api/options', {
          method: 'DELETE',
          body: JSON.stringify({ type, value })
        });
        state.options = data.options;
        renderLists();
      } catch (error) {
        showError(error);
      }
    });
  });

  app.querySelector('#templateColumnsForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const columns = new FormData(event.target).get('columns').split('\n').map((line) => line.trim()).filter(Boolean);
    try {
      const data = await api('/api/template-columns', {
        method: 'POST',
        body: JSON.stringify({ columns })
      });
      state.templateColumns = data.templateColumns;
      toastMessage('Excel columns saved.');
    } catch (error) {
      showError(error);
    }
  });
}

function optionRows(type) {
  const values = state.options[type] || [];
  if (!values.length) return emptyHtml('Nothing saved yet', 'Add the first option above.');
  return values.map((value) => `
    <div class="option-row">
      <div class="button-row" style="justify-content: space-between">
        <span>${escapeHtml(value)}</span>
        <button class="button ghost" data-delete-option="${escapeHtml(type)}|${escapeHtml(value)}">Remove</button>
      </div>
    </div>
  `).join('');
}

async function api(path, options = {}) {
  const response = await fetch(apiUrl(path), {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-Demo-Mode': state.demo ? '1' : '0',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    let message = 'Something went wrong.';
    try {
      const data = await response.json();
      message = data.error || message;
    } catch {}
    throw new Error(message);
  }

  return response.json();
}

function apiUrl(path) {
  const url = new URL(path, window.location.origin);
  if (state.demo) url.searchParams.set('demo', '1');
  return url.toString();
}

function screenShell(title, subtitle, body) {
  return `
    <div class="screen">
      <div class="screen-title">
        <div>
          <h1>${title}</h1>
          <p>${subtitle}</p>
        </div>
      </div>
      ${body}
    </div>
  `;
}

function stat(label, value) {
  return `<div class="stat"><span>${label}</span><strong>${value}</strong></div>`;
}

function button(label, variant = '', attrs = '') {
  return `<button class="button ${variant}" ${attrs}>${label}</button>`;
}

function field(labelText, name, value = '', options = {}) {
  const type = options.type || 'text';
  const id = name;
  const attrs = [
    `id="${id}"`,
    `name="${name}"`,
    `type="${type}"`,
    `value="${escapeHtml(value)}"`,
    options.required ? 'required' : '',
    options.step ? `step="${options.step}"` : '',
    options.list ? `list="${options.list}-list"` : ''
  ].filter(Boolean).join(' ');

  return `
    <div class="field">
      <label for="${id}">${labelText}</label>
      <input class="input" ${attrs}>
    </div>
  `;
}

function datalists() {
  return Object.entries(state.options).map(([type, values]) => `
    <datalist id="${type}-list">
      ${(values || []).map((value) => `<option value="${escapeHtml(value)}"></option>`).join('')}
    </datalist>
  `).join('');
}

function missingFields(product) {
  return ['product_name', 'bottle_size', 'vendor'].filter((fieldName) => !String(product[fieldName] || '').trim());
}

function labelForField(fieldName) {
  return {
    product_name: 'Bottle name',
    bottle_size: 'Bottle size',
    vendor: 'Vendor'
  }[fieldName] || fieldName;
}

function stockPillClass(product) {
  if (Number(product.quantity) === 0) return 'bad';
  if (Number(product.low_stock_level) > 0 && Number(product.quantity) <= Number(product.low_stock_level)) return 'warn';
  return 'good';
}

function stockLabel(product) {
  if (Number(product.quantity) === 0) return 'Out';
  if (Number(product.low_stock_level) > 0 && Number(product.quantity) <= Number(product.low_stock_level)) return 'Low';
  return 'In Stock';
}

function qualityClass(quality = '') {
  const lowered = quality.toLowerCase();
  if (lowered.includes('damaged') || lowered.includes('expired')) return 'bad';
  if (lowered.includes('check')) return 'warn';
  return 'good';
}

function humanAction(action) {
  return {
    stock_in: 'Stock In',
    stock_out: 'Stock Out',
    set: 'Set Quantity'
  }[action] || action;
}

function prettyNumber(value) {
  const number = Number(value || 0);
  return Number.isInteger(number) ? String(number) : number.toFixed(2).replace(/\.?0+$/, '');
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value.replace(' ', 'T'));
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(date);
}

function formatBytes(bytes) {
  const number = Number(bytes || 0);
  if (number < 1024) return `${number} B`;
  if (number < 1024 * 1024) return `${(number / 1024).toFixed(1)} KB`;
  return `${(number / 1024 / 1024).toFixed(1)} MB`;
}

function emptyHtml(title = 'No results yet', subtitle = 'Try scanning a bottle or changing the search.') {
  return `<div class="empty"><strong>${title}</strong><span>${subtitle}</span></div>`;
}

function toastMessage(message) {
  toast.textContent = message;
  toast.classList.add('show');
  window.clearTimeout(toast.hideTimer);
  toast.hideTimer = window.setTimeout(() => toast.classList.remove('show'), 2800);
}

function showError(error) {
  toastMessage(error.message || 'Something went wrong.');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
