const { app, BrowserWindow, nativeTheme, Tray, Menu, Notification, shell } = require('electron');
const path = require('path');

nativeTheme.themeSource = 'dark';

let win;
let tray;

function createWindow() {
  win = new BrowserWindow({
    width: 420,
    height: 820,
    minWidth: 380,
    minHeight: 600,
    backgroundColor: '#0a0e1a',
    title: 'LifeOS',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
    // GPU acceleration
    enableBlinkFeatures: '',
    disableBlinkFeatures: 'Auxclick',
  });

  win.loadFile(path.join(__dirname, '..', 'index.html'));

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // Tray
  try {
    tray = new Tray(path.join(__dirname, '..', 'icons', 'icon-192.png'));
    tray.setToolTip('LifeOS');
    tray.setContextMenu(Menu.buildFromTemplate([
      { label: 'Open LifeOS', click: () => win.show() },
      { type: 'separator' },
      { label: 'Quit', click: () => { app.isQuitting = true; app.quit(); } },
    ]));
    tray.on('click', () => win.isVisible() ? win.hide() : win.show());
  } catch(e) { /* tray icon optional */ }

  win.on('close', (e) => {
    if (!app.isQuitting) { e.preventDefault(); win.hide(); }
  });
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!win || win.isDestroyed()) createWindow(); else win.show(); });

// IPC: show OS notification from renderer
const { ipcMain } = require('electron');
ipcMain.handle('notify', (_e, { title, body }) => {
  new Notification({ title, body, icon: path.join(__dirname, '..', 'icons', 'icon-192.png') }).show();
});
