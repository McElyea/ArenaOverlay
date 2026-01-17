import { app, BrowserWindow, screen, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import { LogMonitor } from "./logMonitor";

function createWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  const mainWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // Allows clicking through the transparent areas to the game underneath
  mainWindow.setIgnoreMouseEvents(true, { forward: true });

  mainWindow.loadFile(path.join(__dirname, "../public/index.html"));

  const monitor = new LogMonitor();
  monitor.start((event) => {
    mainWindow.webContents.send("draft-event", event);
  });

  // IPC handlers
  ipcMain.on("request-mock", () => {
    mainWindow.webContents.send("draft-event", {
      pack: ["123", "456", "789"],
      pick: 1,
      pickedCards: ["123", "456", "456", "789"] // Multiple cards for curve testing
    });
  });

  ipcMain.handle("load-artifact", async (_event, setName: string) => {
    const artifactPath = path.join(__dirname, "../../artifacts", `cards_${setName}.json`);
    if (fs.existsSync(artifactPath)) {
      const data = fs.readFileSync(artifactPath, "utf-8");
      return JSON.parse(data);
    }
    return null;
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
