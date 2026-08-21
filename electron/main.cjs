/**
 * Electron entry: start Express (API + static UI) then open a desktop window.
 * Packaged with electron-builder as a Windows .exe.
 */
const { app, BrowserWindow, dialog, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const http = require('http');

const PORT = Number(process.env.PORT) || 5001;
const isDev = !app.isPackaged;

let mainWindow = null;
let serverProcess = null;

function resourcePath(...parts) {
  if (isDev) {
    return path.join(__dirname, '..', ...parts);
  }
  return path.join(process.resourcesPath, ...parts);
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  const text = fs.readFileSync(filePath, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function waitForHealth(port, timeoutMs = 30000) {
  const started = Date.now();
  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (Date.now() - started > timeoutMs) reject(new Error('Server health check timed out'));
        else setTimeout(tryOnce, 250);
      });
      req.on('error', () => {
        if (Date.now() - started > timeoutMs) reject(new Error('Server failed to start'));
        else setTimeout(tryOnce, 250);
      });
    };
    tryOnce();
  });
}

function startBackend() {
  const envPath = isDev
    ? path.join(__dirname, '..', 'server', '.env')
    : path.join(process.resourcesPath, '.env');
  loadEnvFile(envPath);

  const clientDist = isDev
    ? path.join(__dirname, '..', 'client', 'dist')
    : path.join(process.resourcesPath, 'client');

  const serverEntry = isDev
    ? path.join(__dirname, '..', 'server', 'dist', 'index.js')
    : path.join(process.resourcesPath, 'server', 'index.js');

  if (!fs.existsSync(serverEntry)) {
    throw new Error(
      `Server build not found at ${serverEntry}. Run "npm run build:desktop" first.`
    );
  }

  const env = {
    ...process.env,
    ELECTRON_RUN_AS_NODE: '1',
    PORT: String(PORT),
    CLIENT_DIST: clientDist,
  };

  serverProcess = spawn(process.execPath, [serverEntry], {
    env,
    cwd: path.dirname(serverEntry),
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  serverProcess.stdout?.on('data', (d) => console.log(`[server] ${d}`));
  serverProcess.stderr?.on('data', (d) => console.error(`[server] ${d}`));
  serverProcess.on('exit', (code) => {
    console.log(`[server] exited with code ${code}`);
  });

  return waitForHealth(PORT);
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 1024,
    minHeight: 700,
    title: 'Warehouse Packing System',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.loadURL(`http://127.0.0.1:${PORT}`);

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function stopBackend() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill();
    serverProcess = null;
  }
}

app.whenReady().then(async () => {
  try {
    await startBackend();
    createWindow();
  } catch (err) {
    console.error(err);
    dialog.showErrorBox(
      'Warehouse Packing System',
      `${err.message}\n\nMake sure MongoDB Atlas is reachable and server/.env has MONGODB_URI.`
    );
    app.quit();
  }
});

app.on('window-all-closed', () => {
  stopBackend();
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  stopBackend();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
