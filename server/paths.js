import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const PUBLIC_DIR = path.join(ROOT_DIR, 'public');
export const DATA_DIR = path.join(ROOT_DIR, 'data');
export const DEMO_DATA_DIR = path.join(DATA_DIR, 'demo');
export const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');
export const BACKUPS_DIR = path.join(ROOT_DIR, 'backups');
export const CERTS_DIR = path.join(ROOT_DIR, 'certs');

export function ensureAppFolders() {
  for (const dir of [DATA_DIR, DEMO_DATA_DIR, EXPORTS_DIR, BACKUPS_DIR, CERTS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function databasePath(isDemo = false) {
  return isDemo ? path.join(DEMO_DATA_DIR, 'inventory-demo.db') : path.join(DATA_DIR, 'inventory.db');
}
