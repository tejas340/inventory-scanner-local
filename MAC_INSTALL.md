# Mac Install Help

Use these steps if the normal double-click install does not open.

## First Try

1. Install Node.js 24 or newer from https://nodejs.org.
2. Download this repo from GitHub, then unzip it.
3. Move the `inventory-scanner-local` folder to `Documents`.
4. Open the folder.
5. Control-click `scripts/setup-mac.command`, then choose `Open`.
6. When the setup finishes, Control-click `Start Inventory System.command`, then choose `Open`.

Keep the window open while using the scanner.

## If Mac Says The File Cannot Be Opened

1. Control-click the `.command` file.
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
chmod +x "Start Inventory System.command" scripts/*.command
./scripts/setup-mac.command
```

After setup finishes, start the app:

```bash
./"Start Inventory System.command"
```

## If It Says Permission Denied

Open `Terminal`, then paste these lines one at a time:

```bash
cd ~/Documents/inventory-scanner-local
chmod +x "Start Inventory System.command" scripts/*.command
./scripts/setup-mac.command
```

After setup finishes, start the app:

```bash
./"Start Inventory System.command"
```

## If It Says Node Is Not Installed

Install Node.js 24 or newer from https://nodejs.org.

Then close Terminal, open a new Terminal window, and run:

```bash
node -v
```

If the number starts with `24` or higher, open `Start Inventory System.command` again.

## If You Used Git Instead Of Download

Open `Terminal`, then run:

```bash
cd ~/Documents
git clone https://github.com/tejas340/inventory-scanner-local.git
cd inventory-scanner-local
./scripts/setup-mac.command
./"Start Inventory System.command"
```

## When The App Starts

The window will show two addresses:

- Mac address: usually `http://localhost:3765`
- iPhone address: usually like `http://192.168.x.x:3765`

Open the iPhone address in Safari while the iPhone and Mac are on the same Wi-Fi.
