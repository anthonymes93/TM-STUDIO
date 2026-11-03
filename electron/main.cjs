const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs/promises');
const createWindow = () => {
  const window = new BrowserWindow({
    width: 1600, height: 980, minWidth: 1080, minHeight: 720,
    title: 'TM-STUDIO', backgroundColor: '#080b12',
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true }
  });
  window.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
};
app.whenReady().then(() => {
  ipcMain.handle('project:save', async (_event, serialized) => {
    const { canceled, filePath } = await dialog.showSaveDialog({ title: 'Save TM-STUDIO project', defaultPath: 'Untitled.tmstudio', filters: [{ name: 'TM-STUDIO Project', extensions: ['tmstudio'] }] });
    if (canceled || !filePath) return { canceled: true };
    await fs.writeFile(filePath, serialized, 'utf8');
    return { canceled: false, name: path.basename(filePath) };
  });
  ipcMain.handle('project:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ title: 'Open TM-STUDIO project', properties: ['openFile'], filters: [{ name: 'TM-STUDIO Project', extensions: ['tmstudio'] }] });
    if (canceled || !filePaths?.[0]) return { canceled: true };
    return { canceled: false, serialized: await fs.readFile(filePaths[0], 'utf8'), name: path.basename(filePaths[0]) };
  });
  ipcMain.handle('audio:import', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({ title: 'Import audio', properties: ['openFile'], filters: [{ name: 'Audio', extensions: ['wav', 'mp3', 'ogg', 'flac', 'm4a'] }] });
    if (canceled || !filePaths?.[0]) return { canceled: true };
    const filePath = filePaths[0];
    const content = await fs.readFile(filePath);
    return { canceled: false, name: path.basename(filePath), base64: content.toString('base64'), extension: path.extname(filePath).slice(1).toLowerCase() };
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
