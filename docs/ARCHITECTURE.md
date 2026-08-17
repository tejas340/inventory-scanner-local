# Architecture

```text
iPhone Safari / PWA
        |
        | same Wi-Fi
        v
Mac local Node server
        |
        v
SQLite database on the Mac
        |
        +-- Excel exports
        +-- Backups
```

The app keeps Excel as an output, not the live database. This avoids broken spreadsheets becoming broken inventory.

## Local Data

Real inventory:

```text
data/inventory.db
```

Demo inventory:

```text
data/demo/inventory-demo.db
```

Exports:

```text
exports/
```

Backups:

```text
backups/
```

Those paths are ignored by GitHub.
