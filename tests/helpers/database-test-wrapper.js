export {
  adjustStock,
  dashboard,
  listHistory,
  saveProduct
} from '../../server/database.js';

export function migrateForTest(db) {
  db.exec(`
    CREATE TABLE products (
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
    CREATE TABLE history (
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
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE list_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(type, value)
    );
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);
}
