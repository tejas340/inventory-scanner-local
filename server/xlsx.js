const TEXT_ENCODER = new TextEncoder();

const FIELD_ALIASES = {
  vendor: ['vendor', 'supplier'],
  product_name: ['bottle name', 'bottle', 'product name', 'product', 'item name', 'item'],
  bottle_size: ['bottle size', 'size', 'unit size'],
  barcode: ['barcode', 'upc', 'ean', 'code'],
  quantity: ['quantity', 'qty', 'stock', 'current quantity', 'current stock'],
  quality: ['quality', 'condition'],
  category: ['category', 'type'],
  location: ['location', 'storage location', 'where'],
  low_stock_level: ['low stock level', 'minimum stock', 'min stock', 'reorder level'],
  updated_at: ['last updated', 'updated at', 'updated'],
  notes: ['notes', 'note']
};

export function mapProductToTemplate(product, columns) {
  return columns.map((column) => {
    const key = normalizeColumn(column);
    const field = Object.entries(FIELD_ALIASES)
      .find(([, aliases]) => aliases.includes(key))?.[0];
    return field ? product[field] ?? '' : '';
  });
}

export function createInventoryWorkbook({ products, history, lowStock, templateColumns }) {
  const currentRows = [
    templateColumns,
    ...products.map((product) => mapProductToTemplate(product, templateColumns))
  ];

  const productRows = [
    ['Barcode', 'Bottle Name', 'Bottle Size', 'Vendor', 'Category', 'Location', 'Quality', 'Quantity', 'Low Stock Level', 'Notes', 'Last Updated'],
    ...products.map((product) => [
      product.barcode,
      product.product_name,
      product.bottle_size,
      product.vendor,
      product.category,
      product.location,
      product.quality,
      product.quantity,
      product.low_stock_level,
      product.notes,
      product.updated_at
    ])
  ];

  const historyRows = [
    ['Date', 'Barcode', 'Bottle Name', 'Action', 'Change', 'Previous Quantity', 'New Quantity', 'Quality', 'Reason', 'Location', 'Notes'],
    ...history.map((item) => [
      item.created_at,
      item.barcode,
      item.product_name,
      humanAction(item.action),
      item.change_quantity,
      item.previous_quantity,
      item.new_quantity,
      item.quality,
      item.reason,
      item.location,
      item.notes
    ])
  ];

  const lowRows = [
    ['Barcode', 'Bottle Name', 'Bottle Size', 'Vendor', 'Quantity', 'Low Stock Level', 'Location', 'Quality'],
    ...lowStock.map((product) => [
      product.barcode,
      product.product_name,
      product.bottle_size,
      product.vendor,
      product.quantity,
      product.low_stock_level,
      product.location,
      product.quality
    ])
  ];

  return buildXlsx([
    { name: 'Current Inventory', rows: currentRows },
    { name: 'History', rows: historyRows },
    { name: 'Low Stock', rows: lowRows },
    { name: 'Products', rows: productRows }
  ]);
}

function normalizeColumn(value) {
  return String(value ?? '').trim().toLowerCase();
}

function humanAction(action) {
  return {
    stock_in: 'Stock In',
    stock_out: 'Stock Out',
    set: 'Set Quantity'
  }[action] ?? action;
}

function buildXlsx(sheets) {
  const files = new Map();
  files.set('[Content_Types].xml', contentTypesXml(sheets.length));
  files.set('_rels/.rels', rootRelsXml());
  files.set('xl/workbook.xml', workbookXml(sheets));
  files.set('xl/_rels/workbook.xml.rels', workbookRelsXml(sheets));
  files.set('xl/styles.xml', stylesXml());

  sheets.forEach((sheet, index) => {
    files.set(`xl/worksheets/sheet${index + 1}.xml`, sheetXml(sheet.rows));
  });

  return zipStore(files);
}

function contentTypesXml(sheetCount) {
  const sheetOverrides = Array.from({ length: sheetCount }, (_, index) =>
    `<Override PartName="/xl/worksheets/sheet${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  ).join('');

  return xmlHeader(`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`);
}

function rootRelsXml() {
  return xmlHeader(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`);
}

function workbookXml(sheets) {
  const sheetNodes = sheets.map((sheet, index) =>
    `<sheet name="${escapeXml(sheet.name.slice(0, 31))}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`
  ).join('');

  return xmlHeader(`<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>${sheetNodes}</sheets>
</workbook>`);
}

function workbookRelsXml(sheets) {
  const sheetRels = sheets.map((_, index) =>
    `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index + 1}.xml"/>`
  ).join('');

  return xmlHeader(`<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${sheetRels}
  <Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`);
}

function stylesXml() {
  return xmlHeader(`<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="2">
    <font><sz val="11"/><name val="Aptos"/></font>
    <font><b/><sz val="11"/><name val="Aptos"/></font>
  </fonts>
  <fills count="2">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
  </fills>
  <borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>
  <cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
  <cellXfs count="2">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
    <xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
  <cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>
</styleSheet>`);
}

function sheetXml(rows) {
  const body = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => cellXml(value, rowIndex + 1, columnIndex + 1, rowIndex === 0)).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  return xmlHeader(`<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetViews><sheetView workbookViewId="0"/></sheetViews>
  <sheetData>${body}</sheetData>
</worksheet>`);
}

function cellXml(value, row, column, isHeader) {
  const ref = `${columnName(column)}${row}`;
  const style = isHeader ? ' s="1"' : '';
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${ref}"${style}><v>${value}</v></c>`;
  }
  return `<c r="${ref}" t="inlineStr"${style}><is><t>${escapeXml(value ?? '')}</t></is></c>`;
}

function columnName(index) {
  let name = '';
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    name = String.fromCharCode(65 + remainder) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
}

function xmlHeader(xml) {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>${xml}`;
}

function escapeXml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}

function zipStore(files) {
  const chunks = [];
  const central = [];
  let offset = 0;

  for (const [name, content] of files.entries()) {
    const nameBytes = TEXT_ENCODER.encode(name);
    const data = typeof content === 'string' ? TEXT_ENCODER.encode(content) : content;
    const crc = crc32(data);
    const localHeader = Buffer.alloc(30);

    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(data.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28);

    chunks.push(localHeader, Buffer.from(nameBytes), Buffer.from(data));

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(data.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);
    central.push(centralHeader, Buffer.from(nameBytes));

    offset += localHeader.length + nameBytes.length + data.length;
  }

  const centralStart = offset;
  const centralBuffer = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(files.size, 8);
  end.writeUInt16LE(files.size, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(centralStart, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...chunks, centralBuffer, end]);
}

function crc32(data) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();
