# Desktop app (Windows .exe)

You can run this project as a normal website (`npm run dev`) or package it as a **Windows desktop app** with Electron.

## Requirements

- Node.js 20+
- MongoDB Atlas connection in [`server/.env`](server/.env) (`MONGODB_URI`) — the `.exe` needs internet access to Atlas
- To **build** a Windows installer: a Windows PC (or CI). Building `--win` from macOS/Linux may work for portable builds but the installer is most reliable on Windows.

## Build the Windows .exe

From the project root:

```bash
npm run install:all
npm run dist:win
```

Output folder: [`release/`](release/)

| File | Use |
|------|-----|
| `Warehouse Packing System-*-portable.exe` | Double-click, no install (good for USB / quick trial) |
| `Warehouse Packing System-*-win-x64.exe` (NSIS) | Installer with Start Menu + desktop shortcut |

### Portable only

```bash
npm run dist:win:portable
```

### Test desktop window without packaging

```bash
npm run desktop
```

This builds the client + server, then opens an Electron window on your current OS.

## How it works

1. Electron starts a local API on `http://127.0.0.1:5001`
2. Express also serves the built React UI
3. The desktop window loads that URL
4. Data stays in your MongoDB Atlas database (same as the web app)

## Notes

- First run needs network access for MongoDB Atlas.
- Keep `server/.env` up to date before building — it is copied into the app resources.
- Do not commit production secrets to public repos; for distribution, inject env at build time or ship a config file next to the exe.
