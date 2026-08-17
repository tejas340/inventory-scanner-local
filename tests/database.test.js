import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { DatabaseSync } from 'node:sqlite';
import { adjustStock, dashboard, listHistory, migrateForTest, saveProduct } from './helpers/database-test-wrapper.js';

test('saves a barcode-linked product and adjusts stock', () => {
  const dbPath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'inventory-test-')), 'test.db');
  const db = new DatabaseSync(dbPath);
  migrateForTest(db);

  const product = saveProduct(db, {
    barcode: 'ABC123',
    product_name: 'Test Bottle',
    bottle_size: '750 ml',
    vendor: 'Test Vendor',
    quantity: 5,
    low_stock_level: 3
  });

  assert.equal(product.barcode, 'ABC123');
  assert.equal(product.quantity, 5);

  const adjusted = adjustStock(db, {
    product_id: product.id,
    action: 'stock_out',
    quantity: 2,
    quality: 'Good',
    reason: 'Stock Out'
  });

  assert.equal(adjusted.quantity, 3);
  assert.equal(listHistory(db).length, 1);
  assert.equal(dashboard(db).stats.low_stock_count, 1);
  db.close();
});
