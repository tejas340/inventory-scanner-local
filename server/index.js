import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'node:os';
import path from 'node:path';
import { URL } from 'node:url';
import {
  adjustStock,
  archiveProduct,
  createBackup,
  dashboard,
  deleteListValue,
  getProductByBarcode,
  getProductById,
  getTemplateColumns,
  listBackups,
  listHistory,
  listOptions,
  listProducts,
  openDatabase,
  replaceDatabaseFromBackup,
  saveProduct,
  saveTemplateColumns,
  seedDemoProducts,
  upsertListValue
} from './database.js';
import { BACKUPS_DIR, CERTS_DIR, EXPORTS_DIR, PUBLIC_DIR, ensureAppFolders } from './paths.js';
import { createInventoryWorkbook } from './xlsx.js';

const PORT = Number(process.env.PORT || 3765);
const HOST = process.env.HOST || '0.0.0.0';

ensureAppFolders();

const server = createServer();

server.listen(PORT, HOST, () => {
  const protocol = server instanceof https.Server ? 'https' : 'http';
  console.log('');
  console.log('Inventory Scanner is ready.');
  console.log(`Open on this Mac: ${protocol}://localhost:${PORT}`);
  for (const address of localAddresses()) {
    console.log(`Open on iPhone:  ${protocol}://${address}:${PORT}`);
  }
  console.log('');
});

function createServer() {
  const keyPath = path.join(CERTS_DIR, 'localhost-key.pem');
  const certPath = path.join(CERTS_DIR, 'localhost.pem');
  if (fs.existsSync(keyPath) && fs.existsSync(certPath)) {
    return https.createServer(
      {
        key: fs.readFileSync(keyPath),
        cert: fs.readFileSync(certPath)
      },
      handleRequest
    );
  }
  return http.createServer(handleRequest);
}

async function handleRequest(req, res) {
  try {
    const requestUrl = new URL(req.url, `http://${req.headers.host}`);

    if (requestUrl.pathname.startsWith('/api/')) {
      await handleApi(req, res, requestUrl);
      return;
    }

    await serveStatic(req, res, requestUrl);
  } catch (error) {
    sendJson(res, error.status || 500, {
      error: error.message || 'Something went wrong.'
    });
  }
}

async function handleApi(req, res, requestUrl) {
  const isDemo = req.headers['x-demo-mode'] === '1' || requestUrl.searchParams.get('demo') === '1';
  const db = openDatabase(isDemo);
  const route = `${req.method} ${requestUrl.pathname}`;

  if (route === 'GET /api/health') {
    sendJson(res, 200, { ok: true, demo: isDemo, addresses: localAddresses() });
    return;
  }

  if (route === 'GET /api/dashboard') {
    sendJson(res, 200, dashboard(db));
    return;
  }

  if (route === 'GET /api/products') {
    sendJson(res, 200, {
      products: listProducts(db, {
        search: requestUrl.searchParams.get('search') || '',
        lowOnly: requestUrl.searchParams.get('low') === '1'
      })
    });
    return;
  }

  if (route === 'POST /api/products') {
    const body = await readJson(req);
    sendJson(res, 200, { product: saveProduct(db, body) });
    return;
  }

  if (route === 'POST /api/stock') {
    const body = await readJson(req);
    sendJson(res, 200, { product: adjustStock(db, body) });
    return;
  }

  if (route === 'GET /api/history') {
    sendJson(res, 200, {
      history: listHistory(db, {
        limit: requestUrl.searchParams.get('limit') || 100,
        search: requestUrl.searchParams.get('search') || ''
      })
    });
    return;
  }

  if (route === 'GET /api/options') {
    sendJson(res, 200, {
      options: listOptions(db),
      templateColumns: getTemplateColumns(db)
    });
    return;
  }

  if (route === 'POST /api/options') {
    const body = await readJson(req);
    upsertListValue(db, body.type, body.value);
    sendJson(res, 200, { options: listOptions(db) });
    return;
  }

  if (route === 'DELETE /api/options') {
    const body = await readJson(req);
    deleteListValue(db, body.type, body.value);
    sendJson(res, 200, { options: listOptions(db) });
    return;
  }

  if (route === 'GET /api/template-columns') {
    sendJson(res, 200, { templateColumns: getTemplateColumns(db) });
    return;
  }

  if (route === 'POST /api/template-columns') {
    const body = await readJson(req);
    sendJson(res, 200, { templateColumns: saveTemplateColumns(db, body.columns) });
    return;
  }

  if (route === 'GET /api/export.xlsx') {
    const products = listProducts(db);
    const history = listHistory(db, { limit: 500 });
    const lowStock = listProducts(db, { lowOnly: true });
    const templateColumns = getTemplateColumns(db);
    const workbook = createInventoryWorkbook({ products, history, lowStock, templateColumns });
    const filename = `Inventory-${isDemo ? 'Demo-' : ''}${dateStamp()}.xlsx`;
    const exportPath = path.join(EXPORTS_DIR, filename);
    fs.writeFileSync(exportPath, workbook);
    sendBuffer(res, workbook, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', filename);
    return;
  }

  if (route === 'POST /api/backups') {
    const backupPath = createBackup(isDemo);
    sendJson(res, 200, {
      backup: {
        file: path.basename(backupPath),
        size: fs.statSync(backupPath).size
      },
      backups: listBackups()
    });
    return;
  }

  if (route === 'GET /api/backups') {
    sendJson(res, 200, { backups: listBackups() });
    return;
  }

  if (route === 'POST /api/demo/reset') {
    const demoDb = openDatabase(true);
    demoDb.exec('DELETE FROM history; DELETE FROM products;');
    seedDemoProducts(demoDb);
    sendJson(res, 200, { ok: true, dashboard: dashboard(demoDb) });
    return;
  }

  const productMatch = requestUrl.pathname.match(/^\/api\/products\/(\d+)$/);
  if (productMatch && req.method === 'GET') {
    const product = getProductById(db, productMatch[1]);
    if (!product) throw notFound('Product not found.');
    sendJson(res, 200, { product });
    return;
  }

  if (productMatch && req.method === 'DELETE') {
    sendJson(res, 200, archiveProduct(db, productMatch[1]));
    return;
  }

  const barcodeMatch = requestUrl.pathname.match(/^\/api\/products\/barcode\/(.+)$/);
  if (barcodeMatch && req.method === 'GET') {
    const barcode = decodeURIComponent(barcodeMatch[1]);
    const product = getProductByBarcode(db, barcode);
    sendJson(res, 200, {
      found: Boolean(product),
      product: product || null,
      barcode
    });
    return;
  }

  const backupDownloadMatch = requestUrl.pathname.match(/^\/api\/backups\/([^/]+)$/);
  if (backupDownloadMatch && req.method === 'GET') {
    const file = safeBackupFile(backupDownloadMatch[1]);
    const buffer = fs.readFileSync(file);
    sendBuffer(res, buffer, 'application/octet-stream', path.basename(file));
    return;
  }

  const backupRestoreMatch = requestUrl.pathname.match(/^\/api\/backups\/([^/]+)\/restore$/);
  if (backupRestoreMatch && req.method === 'POST') {
    const file = safeBackupFile(backupRestoreMatch[1]);
    replaceDatabaseFromBackup(isDemo, file);
    sendJson(res, 200, { ok: true });
    return;
  }

  throw notFound('That action was not found.');
}

async function serveStatic(req, res, requestUrl) {
  let requestedPath = decodeURIComponent(requestUrl.pathname);
  if (requestedPath === '/') requestedPath = '/index.html';

  const filePath = path.resolve(PUBLIC_DIR, `.${requestedPath}`);
  if (!filePath.startsWith(PUBLIC_DIR)) {
    throw notFound('File not found.');
  }

  let target = filePath;
  if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
    target = path.join(PUBLIC_DIR, 'index.html');
  }

  const ext = path.extname(target).toLowerCase();
  const type = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
  }[ext] || 'application/octet-stream';

  res.writeHead(200, {
    'Content-Type': type,
    'Cache-Control': ext === '.html' ? 'no-store' : 'public, max-age=300'
  });
  fs.createReadStream(target).pipe(res);
}

function safeBackupFile(fileName) {
  const clean = path.basename(decodeURIComponent(fileName));
  const fullPath = path.resolve(BACKUPS_DIR, clean);
  if (!fullPath.startsWith(BACKUPS_DIR) || !fs.existsSync(fullPath) || !clean.endsWith('.db')) {
    throw notFound('Backup not found.');
  }
  return fullPath;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) {
        reject(Object.assign(new Error('Request is too large.'), { status: 413 }));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!data) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(data));
      } catch {
        reject(Object.assign(new Error('Please send valid JSON.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body)
  });
  res.end(body);
}

function sendBuffer(res, buffer, type, filename) {
  res.writeHead(200, {
    'Content-Type': type,
    'Content-Disposition': `attachment; filename="${filename}"`,
    'Content-Length': buffer.length
  });
  res.end(buffer);
}

function notFound(message) {
  const error = new Error(message);
  error.status = 404;
  return error;
}

function localAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries || []) {
      if (entry.family === 'IPv4' && !entry.internal) {
        addresses.push(entry.address);
      }
    }
  }
  return addresses;
}

function dateStamp() {
  return new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');
}
