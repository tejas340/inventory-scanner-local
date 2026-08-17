# Inventory Scanner

Inventory Scanner is a local Mac-hosted web app for scanning bottles with an iPhone browser/PWA and saving inventory into a private SQLite database on the Mac.

It is designed for a non-technical daily workflow:

1. Open the Inventory app on the iPhone.
2. Tap Scan.
3. Scan or type the barcode.
4. Bottle name, size, vendor, quality, and location fill in automatically when the barcode is known.
5. Choose Stock In, Stock Out, or Set Quantity.
6. Save and move to the next bottle.

## What V1 Includes

- Dashboard with product totals, low-stock count, attention count, low-stock list, and recent changes.
- iPhone browser/PWA scanner page using the browser camera when available.
- Manual barcode entry fallback.
- Unknown barcode setup.
- Barcode-linked bottle/product name, bottle size, vendor, category, location, quality, quantity, low-stock level, and notes.
- Optional missing-field warning for bottle name, bottle size, and vendor with Fill Now / Next.
- Stock In, Stock Out, and Set Quantity.
- Stock count mode and rapid scan mode.
- Searchable inventory list.
- Inventory history.
- Editable lists for bottle sizes, vendors, quality/condition, categories, locations, and reasons.
- Built-in bottle-size options using ml, cl, L, oz, fl oz, pint, quart, and gallon formats.
- Excel export with Current Inventory, History, Low Stock, and Products tabs.
- Excel column order control for matching a Google Sheet or Excel template.
- Local backups and restore.
- Demo/test mode with sample data separated from real inventory.
- GitHub-ready source code while excluding real inventory data.

## What Is Intentionally Not Included

- Admin mode.
- Light/dark mode.
- Real inventory data in GitHub.

## Requirements

- Mac with Node.js 24 or newer.
- iPhone on the same Wi-Fi network as the Mac.

Node.js can be installed from [nodejs.org](https://nodejs.org).

## Start On The Mac

1. Download or clone this project.
2. Move the folder to `Documents`.
3. Open `CLICK TO START - Inventory Scanner.command`.
4. Keep that small window open while using the scanner.

If macOS blocks the file, says it cannot be opened, or shows a permission error, use [Mac Install Help](MAC_INSTALL.md).

The app opens the Mac browser automatically and prints two addresses:

- One for the Mac, usually `http://localhost:3765`
- One for the iPhone, usually like `http://192.168.x.x:3765`

Open the iPhone address in Safari while the iPhone is on the same Wi-Fi.

## iPhone Home Screen

1. Open the app address in Safari.
2. Tap Share.
3. Tap Add to Home Screen.
4. Name it Inventory.

After that it opens like a regular app icon.

## Camera Notes

The scanner uses the browser camera and the browser's built-in barcode reader when available. Manual barcode entry always works.

For iPhone camera access over local Wi-Fi, Safari may require a secure address. The setup script can create a local certificate, but the iPhone may still need to trust that certificate. If camera access is blocked, use manual barcode entry first and later set up a trusted local certificate.

## Demo Mode

Use the Demo switch at the top of the app to test safely. Demo mode stores data in a separate demo database and does not touch real inventory.

The Export screen has a Reset Demo Data button.

## Excel / Google Sheet Template

Go to Lists, then edit Excel Column Order.

Put one column name per line in the same order as the formatted Google Sheet or Excel template. The Current Inventory export will use that order.

Default columns:

```text
Vendor
Bottle Name
Bottle Size
Barcode
Quantity
Quality
Category
Location
Low Stock Level
Last Updated
```

## Private Data

The app keeps real inventory data in local folders:

```text
data/
exports/
backups/
certs/
```

These folders are ignored by Git so real inventory, backups, exports, and certificates do not get uploaded to GitHub.

## Useful Commands

```bash
./"CLICK TO START - Inventory Scanner.command"
npm start
npm test
```

## Project Structure

```text
server/   Local Mac server, SQLite database, Excel export, backups
public/   Browser app and PWA files
scripts/  Mac setup/start helpers
tests/    Basic checks
docs/     Extra notes
```
