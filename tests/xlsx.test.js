import assert from 'node:assert/strict';
import test from 'node:test';
import { createInventoryWorkbook } from '../server/xlsx.js';

test('creates an Excel workbook buffer', () => {
  const workbook = createInventoryWorkbook({
    products: [
      {
        barcode: '123',
        product_name: 'Test Bottle',
        bottle_size: '750 ml',
        vendor: 'Test Vendor',
        category: 'Liquor',
        location: 'Bar',
        quality: 'Good',
        quantity: 7,
        low_stock_level: 2,
        notes: '',
        updated_at: '2026-08-17 12:00:00'
      }
    ],
    history: [],
    lowStock: [],
    templateColumns: ['Vendor', 'Bottle Name', 'Quantity']
  });

  assert.equal(workbook.subarray(0, 2).toString('utf8'), 'PK');
  assert.ok(workbook.length > 1000);
});
