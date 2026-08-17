import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { BACKUPS_DIR, databasePath, ensureAppFolders } from './paths.js';

const DEFAULT_TEMPLATE_COLUMNS = [
  'Vendor',
  'Bottle Name',
  'Bottle Size',
  'Barcode',
  'Quantity',
  'Quality',
  'Category',
  'Location',
  'Low Stock Level',
  'Last Updated'
];

const DEFAULT_LISTS = {
  bottle_size: [
    '1 oz',
    '1.5 oz',
    '1.7 oz / 50 ml',
    '2 oz',
    '3.4 oz / 100 ml',
    '4 oz',
    '6.3 oz / 187 ml',
    '6.8 oz / 200 ml',
    '8 oz',
    '8.45 oz / 250 ml',
    '10 oz',
    '12 oz / 355 ml',
    '12.7 oz / 375 ml',
    '16 oz',
    '16.9 oz / 500 ml',
    '22 oz / 650 ml',
    '23.7 oz / 700 ml',
    '24.3 oz / 720 ml',
    '25.4 oz / 750 ml',
    '32 oz',
    '33.8 oz / 1 L',
    '50.7 oz / 1.5 L',
    '59.2 oz / 1.75 L',
    '101.4 oz / 3 L',
    '169 oz / 5 L',
    '1 pint / 16 fl oz',
    '1 quart / 32 fl oz',
    '1 gallon / 128 fl oz',
    '5 cl / 50 ml',
    '10 cl / 100 ml',
    '18.7 cl / 187 ml',
    '20 cl / 200 ml',
    '35 cl / 350 ml',
    '37.5 cl / 375 ml',
    '50 cl / 500 ml',
    '70 cl / 700 ml',
    '75 cl / 750 ml',
    '100 cl / 1 L',
    '50 ml',
    '100 ml',
    '187 ml',
    '200 ml',
    '250 ml',
    '275 ml',
    '330 ml',
    '355 ml',
    '375 ml',
    '500 ml',
    '650 ml',
    '700 ml',
    '720 ml',
    '750 ml',
    '1 L',
    '1.5 L',
    '1.75 L',
    '3 L',
    '5 L'
  ],
  vendor: ['Main Vendor', 'Backup Vendor'],
  quality: ['Good', 'Damaged', 'Expired', 'Check Needed'],
  category: ['Liquor', 'Wine', 'Beer', 'Soft Drinks', 'Supplies'],
  location: ['Bar', 'Storage Room', 'Cooler', 'Shelf A'],
  reason: ['Delivery', 'Stock Out', 'Physical Count', 'Damage', 'Correction']
};

const dbCache = new Map();

export function openDatabase(isDemo = false) {
  ensureAppFolders();
  const key = isDemo ? 'demo' : 'real';
  const dbFile = databasePath(isDemo);

  if (dbCache.has(key)) {
    return dbCache.get(key);
  }

  fs.mkdirSync(path.dirname(dbFile), { recursive: true });
  const db = new DatabaseSync(dbFile);
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  migrate(db);
  seedDefaults(db);

  if (isDemo && productCount(db) === 0) {
    seedDemoProducts(db);
  }

  dbCache.set(key, db);
  return db;
}

export function closeDatabase(isDemo = false) {
  const key = isDemo ? 'demo' : 'real';
  const db = dbCache.get(key);
  if (db) {
    db.close();
    dbCache.delete(key);
  }
}

export function replaceDatabaseFromBackup(isDemo, backupFile) {
  closeDatabase(isDemo);
  const target = databasePath(isDemo);
  fs.copyFileSync(backupFile, target);
  return openDatabase(isDemo);
}

function migrate(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      barcode TEXT NOT NULL UNIQUE,
      product_name TEXT DEFAULT '',
      bottle_size TEXT DEFAULT '',
      vendor TEXT DEFAULT '',
      category TEXT DEFAULT '',
      location TEXT DEFAULT '',
      quality TEXT DEFAULT 'Good',
      quantity REAL NOT NULL DEFAULT 0,
      low_stock_level REAL NOT NULL DEFAULT 0,
      notes TEXT DEFAULT '',
      archived INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      product_id INTEGER,
      barcode TEXT NOT NULL,
      product_name TEXT DEFAULT '',
      action TEXT NOT NULL,
      change_quantity REAL NOT NULL DEFAULT 0,
      previous_quantity REAL NOT NULL DEFAULT 0,
      new_quantity REAL NOT NULL DEFAULT 0,
      quality TEXT DEFAULT '',
      reason TEXT DEFAULT '',
      location TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS list_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, value)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_products_search
      ON products(product_name, barcode, vendor, bottle_size, category, location);

    CREATE INDEX IF NOT EXISTS idx_history_created_at
      ON history(created_at);
  `);
}

function seedDefaults(db) {
  const insertOption = db.prepare('INSERT OR IGNORE INTO list_options (type, value) VALUES (?, ?)');
  for (const [type, values] of Object.entries(DEFAULT_LISTS)) {
    for (const value of values) {
      insertOption.run(type, value);
    }
  }

  db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)').run(
    'template_columns',
    JSON.stringify(DEFAULT_TEMPLATE_COLUMNS)
  );
}

function productCount(db) {
  return db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
}

export function seedDemoProducts(db = openDatabase(true)) {
  const demoRows = [
    {
      barcode: 'DEMO-750-001',
      product_name: 'Sample Bourbon',
      bottle_size: '750 ml',
      vendor: 'Main Vendor',
      category: 'Liquor',
      location: 'Bar',
      quality: 'Good',
      quantity: 14,
      low_stock_level: 6,
      notes: 'Demo bottle for safe testing'
    },
    {
      barcode: 'DEMO-1L-002',
      product_name: 'Sample Vodka',
      bottle_size: '1 L',
      vendor: 'Backup Vendor',
      category: 'Liquor',
      location: 'Storage Room',
      quality: 'Good',
      quantity: 4,
      low_stock_level: 5,
      notes: 'Low stock demo item'
    },
    {
      barcode: 'DEMO-MISSING-003',
      product_name: 'Needs Vendor Example',
      bottle_size: '750 ml',
      vendor: '',
      category: 'Wine',
      location: 'Shelf A',
      quality: 'Check Needed',
      quantity: 9,
      low_stock_level: 3,
      notes: 'Shows the missing-field warning'
    }
  ];

  const existing = db.prepare('SELECT COUNT(*) AS count FROM products').get().count;
  if (existing > 0) return;

  const insert = db.prepare(`
    INSERT INTO products (
      barcode, product_name, bottle_size, vendor, category, location, quality,
      quantity, low_stock_level, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const row of demoRows) {
    insert.run(
      row.barcode,
      row.product_name,
      row.bottle_size,
      row.vendor,
      row.category,
      row.location,
      row.quality,
      row.quantity,
      row.low_stock_level,
      row.notes
    );
  }
}

function normalizeText(value) {
  return String(value ?? '').trim();
}

function numberValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

export function listProducts(db, { search = '', lowOnly = false, archived = false } = {}) {
  const clauses = ['archived = ?'];
  const params = [archived ? 1 : 0];

  if (search) {
    const like = `%${search}%`;
    clauses.push(`(
      product_name LIKE ?
      OR barcode LIKE ?
      OR vendor LIKE ?
      OR bottle_size LIKE ?
      OR category LIKE ?
      OR location LIKE ?
    )`);
    params.push(like, like, like, like, like, like);
  }

  if (lowOnly) {
    clauses.push('low_stock_level > 0 AND quantity <= low_stock_level');
  }

  return db.prepare(`
    SELECT *
    FROM products
    WHERE ${clauses.join(' AND ')}
    ORDER BY product_name COLLATE NOCASE, barcode
  `).all(...params);
}

export function getProductByBarcode(db, barcode) {
  return db.prepare('SELECT * FROM products WHERE barcode = ? AND archived = 0').get(normalizeText(barcode));
}

export function getProductById(db, id) {
  return db.prepare('SELECT * FROM products WHERE id = ?').get(Number(id));
}

export function saveProduct(db, payload) {
  const id = payload.id ? Number(payload.id) : null;
  const row = {
    barcode: normalizeText(payload.barcode),
    product_name: normalizeText(payload.product_name),
    bottle_size: normalizeText(payload.bottle_size),
    vendor: normalizeText(payload.vendor),
    category: normalizeText(payload.category),
    location: normalizeText(payload.location),
    quality: normalizeText(payload.quality) || 'Good',
    quantity: numberValue(payload.quantity, 0),
    low_stock_level: numberValue(payload.low_stock_level, 0),
    notes: normalizeText(payload.notes)
  };

  if (!row.barcode) {
    const error = new Error('Barcode is required.');
    error.status = 400;
    throw error;
  }

  upsertListValue(db, 'bottle_size', row.bottle_size);
  upsertListValue(db, 'vendor', row.vendor);
  upsertListValue(db, 'quality', row.quality);
  upsertListValue(db, 'category', row.category);
  upsertListValue(db, 'location', row.location);

  if (id) {
    const existing = getProductById(db, id);
    if (!existing) {
      const error = new Error('Product not found.');
      error.status = 404;
      throw error;
    }

    const duplicate = db.prepare('SELECT id FROM products WHERE barcode = ? AND id <> ?').get(row.barcode, id);
    if (duplicate) {
      const error = new Error('That barcode is already linked to another product.');
      error.status = 409;
      throw error;
    }

    db.prepare(`
      UPDATE products
      SET barcode = ?, product_name = ?, bottle_size = ?, vendor = ?, category = ?,
          location = ?, quality = ?, quantity = ?, low_stock_level = ?, notes = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(
      row.barcode,
      row.product_name,
      row.bottle_size,
      row.vendor,
      row.category,
      row.location,
      row.quality,
      row.quantity,
      row.low_stock_level,
      row.notes,
      id
    );

    return getProductById(db, id);
  }

  const duplicate = db.prepare('SELECT id FROM products WHERE barcode = ?').get(row.barcode);
  if (duplicate) {
    const error = new Error('That barcode is already linked to another product.');
    error.status = 409;
    throw error;
  }

  const result = db.prepare(`
    INSERT INTO products (
      barcode, product_name, bottle_size, vendor, category, location, quality,
      quantity, low_stock_level, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    row.barcode,
    row.product_name,
    row.bottle_size,
    row.vendor,
    row.category,
    row.location,
    row.quality,
    row.quantity,
    row.low_stock_level,
    row.notes
  );

  return getProductById(db, result.lastInsertRowid);
}

export function archiveProduct(db, id) {
  const product = getProductById(db, id);
  if (!product) {
    const error = new Error('Product not found.');
    error.status = 404;
    throw error;
  }
  db.prepare('UPDATE products SET archived = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(Number(id));
  return { ok: true };
}

export function adjustStock(db, payload) {
  const product = getProductById(db, payload.product_id);
  if (!product || product.archived) {
    const error = new Error('Product not found.');
    error.status = 404;
    throw error;
  }

  const action = normalizeText(payload.action);
  const amount = numberValue(payload.quantity, 0);
  if (!['stock_in', 'stock_out', 'set'].includes(action)) {
    const error = new Error('Choose Stock In, Stock Out, or Set Quantity.');
    error.status = 400;
    throw error;
  }
  if (amount < 0) {
    const error = new Error('Quantity cannot be negative.');
    error.status = 400;
    throw error;
  }

  const previous = numberValue(product.quantity, 0);
  let next = previous;
  let change = amount;

  if (action === 'stock_in') {
    next = previous + amount;
  } else if (action === 'stock_out') {
    next = Math.max(0, previous - amount);
    change = -amount;
  } else if (action === 'set') {
    next = amount;
    change = next - previous;
  }

  const quality = normalizeText(payload.quality) || product.quality || 'Good';
  const reason = normalizeText(payload.reason);
  const location = normalizeText(payload.location) || product.location || '';
  const notes = normalizeText(payload.notes);

  upsertListValue(db, 'quality', quality);
  upsertListValue(db, 'reason', reason);
  upsertListValue(db, 'location', location);

  db.prepare(`
    UPDATE products
    SET quantity = ?, quality = ?, location = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(next, quality, location, product.id);

  db.prepare(`
    INSERT INTO history (
      product_id, barcode, product_name, action, change_quantity, previous_quantity,
      new_quantity, quality, reason, location, notes
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    product.id,
    product.barcode,
    product.product_name,
    action,
    change,
    previous,
    next,
    quality,
    reason,
    location,
    notes
  );

  return getProductById(db, product.id);
}

export function listHistory(db, { limit = 100, search = '' } = {}) {
  const safeLimit = Math.min(Math.max(Number(limit) || 100, 1), 500);
  if (search) {
    const like = `%${search}%`;
    return db.prepare(`
      SELECT *
      FROM history
      WHERE product_name LIKE ? OR barcode LIKE ? OR reason LIKE ? OR location LIKE ?
      ORDER BY datetime(created_at) DESC, id DESC
      LIMIT ?
    `).all(like, like, like, like, safeLimit);
  }

  return db.prepare(`
    SELECT *
    FROM history
    ORDER BY datetime(created_at) DESC, id DESC
    LIMIT ?
  `).all(safeLimit);
}

export function dashboard(db) {
  const stats = db.prepare(`
    SELECT
      COUNT(*) AS total_products,
      COALESCE(SUM(quantity), 0) AS total_units,
      SUM(CASE WHEN low_stock_level > 0 AND quantity <= low_stock_level THEN 1 ELSE 0 END) AS low_stock_count,
      SUM(CASE WHEN quantity = 0 THEN 1 ELSE 0 END) AS out_of_stock_count,
      SUM(CASE WHEN quality IN ('Damaged', 'Expired', 'Check Needed') THEN 1 ELSE 0 END) AS attention_count
    FROM products
    WHERE archived = 0
  `).get();

  return {
    stats,
    lowStock: listProducts(db, { lowOnly: true }).slice(0, 8),
    recentHistory: listHistory(db, { limit: 8 })
  };
}

export function listOptions(db) {
  const rows = db.prepare('SELECT type, value FROM list_options ORDER BY type, value COLLATE NOCASE').all();
  return rows.reduce((acc, row) => {
    acc[row.type] ??= [];
    acc[row.type].push(row.value);
    return acc;
  }, {});
}

export function upsertListValue(db, type, value) {
  const cleanType = normalizeText(type);
  const cleanValue = normalizeText(value);
  if (!cleanType || !cleanValue) return;
  db.prepare('INSERT OR IGNORE INTO list_options (type, value) VALUES (?, ?)').run(cleanType, cleanValue);
}

export function deleteListValue(db, type, value) {
  db.prepare('DELETE FROM list_options WHERE type = ? AND value = ?').run(normalizeText(type), normalizeText(value));
  return { ok: true };
}

export function getTemplateColumns(db) {
  const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get('template_columns');
  if (!setting) return DEFAULT_TEMPLATE_COLUMNS;
  try {
    const parsed = JSON.parse(setting.value);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_TEMPLATE_COLUMNS;
  } catch {
    return DEFAULT_TEMPLATE_COLUMNS;
  }
}

export function saveTemplateColumns(db, columns) {
  const cleanColumns = Array.isArray(columns)
    ? columns.map((column) => normalizeText(column)).filter(Boolean)
    : DEFAULT_TEMPLATE_COLUMNS;

  db.prepare(`
    INSERT INTO settings (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run('template_columns', JSON.stringify(cleanColumns.length ? cleanColumns : DEFAULT_TEMPLATE_COLUMNS));

  return getTemplateColumns(db);
}

export function createBackup(isDemo = false) {
  ensureAppFolders();
  const source = databasePath(isDemo);
  if (!fs.existsSync(source)) {
    openDatabase(isDemo);
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const label = isDemo ? 'demo' : 'real';
  const backupPath = path.join(BACKUPS_DIR, `inventory-${label}-${timestamp}.db`);
  closeDatabase(isDemo);
  fs.copyFileSync(source, backupPath);
  openDatabase(isDemo);
  return backupPath;
}

export function listBackups() {
  ensureAppFolders();
  return fs.readdirSync(BACKUPS_DIR)
    .filter((file) => file.endsWith('.db'))
    .map((file) => {
      const fullPath = path.join(BACKUPS_DIR, file);
      const stats = fs.statSync(fullPath);
      return {
        file,
        size: stats.size,
        created_at: stats.birthtime.toISOString(),
        modified_at: stats.mtime.toISOString()
      };
    })
    .sort((a, b) => b.modified_at.localeCompare(a.modified_at));
}
