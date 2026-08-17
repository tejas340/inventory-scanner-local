# Mac Install Help

Use these steps if the normal double-click start does not open.

## First Try

1. Install Node.js 24 or newer from https://nodejs.org.
2. Download this repo from GitHub, then unzip it.
3. Move the `inventory-scanner-local` folder to `Documents`.
4. Open the folder.
5. Double-click `CLICK TO START - Inventory Scanner.command`.

It will prepare the folders, start the scanner, and open the Mac browser automatically. Keep the small window open while using the scanner.

## If Mac Blocks The First Double-Click

Apple may block the first open because this is a GitHub download, not an Apple-signed app.

1. Control-click `CLICK TO START - Inventory Scanner.command`.
2. Choose `Open`.
3. Click `Open` again if Mac asks.

After that, normal double-click should work.

## If Mac Says The File Cannot Be Opened

1. Control-click `CLICK TO START - Inventory Scanner.command`.
2. Choose `Open`.
3. Click `Open` again if Mac asks.

If macOS still blocks it:

1. Open `System Settings`.
2. Go to `Privacy & Security`.
3. Scroll down and click `Open Anyway` for the blocked file.
4. Try opening the file again.

## If Mac Says It Is Harmful Or Cannot Verify It

This usually means the files were downloaded from GitHub and macOS marked them as unverified. Only do this if the folder came from this repo:

```text
https://github.com/tejas340/inventory-scanner-local
```

Open `Terminal`, then paste these lines one at a time:

```bash
cd ~/Documents/inventory-scanner-local
xattr -dr com.apple.quarantine .
chmod +x "CLICK TO START - Inventory Scanner.command" "Start Inventory System.command" scripts/*.command
./"CLICK TO START - Inventory Scanner.command"
```

## If It Says Permission Denied

Open `Terminal`, then paste these lines one at a time:

```bash
cd ~/Documents/inventory-scanner-local
chmod +x "CLICK TO START - Inventory Scanner.command" "Start Inventory System.command" scripts/*.command
./"CLICK TO START - Inventory Scanner.command"
```

## If It Says Node Is Not Installed

Install Node.js 24 or newer from https://nodejs.org.

Then close Terminal, open a new Terminal window, and run:

```bash
node -v
```

If the number starts with `24` or higher, open `CLICK TO START - Inventory Scanner.command` again.

## If You Used Git Instead Of Download

Open `Terminal`, then run:

```bash
cd ~/Documents
git clone https://github.com/tejas340/inventory-scanner-local.git
cd inventory-scanner-local
./"CLICK TO START - Inventory Scanner.command"
```

## When The App Starts

The window will show two addresses:

- Mac address: usually `http://localhost:3765`
- iPhone address: usually like `http://192.168.x.x:3765`

Open the iPhone address in Safari while the iPhone and Mac are on the same Wi-Fi.

## If Live Camera Scan Does Not Work On iPhone

Tap `Take Barcode Photo` on the Scan screen. That uses the iPhone camera to take one barcode photo and reads it with the scanner helper.

If the iPhone still shows the old built-in scanner message, refresh Safari once. If you saved it to the Home Screen, remove that Home Screen icon and add it again after opening the latest address in Safari.
