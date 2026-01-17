import { app, BrowserWindow, screen, ipcMain } from "electron";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { LogMonitor } from "./logMonitor";

// Suppress Autofill console errors in DevTools
app.commandLine.appendSwitch('disable-features', 'Autofill');

function generateRandomPack(setName: string) {
  const artifactPath = path.join(__dirname, "../../artifacts", `cards_${setName}.json`);
  if (!fs.existsSync(artifactPath)) return [];
  
  const cards = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));
  const buckets: Record<string, string[]> = { common: [], uncommon: [], rare: [], mythic: [] };
  
  Object.entries(cards).forEach(([id, data]: [string, any]) => {
    const r = (data.rarity || "common").toLowerCase();
    if (buckets[r]) buckets[r].push(id);
    else buckets.common.push(id);
  });

  const pick = (rarity: string, count: number) => {
    const list = buckets[rarity];
    const result = [];
    for(let i=0; i<count && list.length > 0; i++) {
      const idx = Math.floor(Math.random() * list.length);
      result.push(list[idx]);
    }
    return result;
  };

  const pack = [];
  // 1 Rare/Mythic
  if (Math.random() < 0.14) pack.push(...pick("mythic", 1));
  else pack.push(...pick("rare", 1));
  
  // 3 Uncommons
  pack.push(...pick("uncommon", 3));
  
  // 10 Commons (filling to 14 cards)
  pack.push(...pick("common", 10));

  // Shuffle
  return pack.sort(() => Math.random() - 0.5);
}

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    frame: true,       // Add frame so you can move/resize it
    transparent: false, // Disable transparency to see the background
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });

  // mainWindow.setIgnoreMouseEvents(true, { forward: true }); // Keep disabled

  mainWindow.loadFile(path.join(__dirname, "../public/index.html"));
  
  // Open DevTools to help see what's happening
  mainWindow.webContents.openDevTools({ mode: 'detach' });

  const monitor = new LogMonitor();
  monitor.start((event) => {
    mainWindow.webContents.send("draft-event", event);
  });

  ipcMain.handle("run-simulation", async (_event, setCode: string) => {
    return new Promise((resolve, reject) => {
      // Pass the set code as an argument to the python script
      // Note: We'll need to update simulate_draft.py to accept arguments
      exec(`python ../python/simulate_draft.py ${setCode}`, (error, stdout, stderr) => {
        if (error) {
          console.error(`Simulation error: ${error}`);
          reject(error);
          return;
        }
        console.log(`Simulation output: ${stdout}`);
        resolve(stdout);
      });
    });
  });

  // IPC handlers
  ipcMain.on("request-mock", (_event, type: string) => {
    let mockEvent: any = {};
    
    if (type === "TLA_P1P1") {
      mockEvent = {
        expansion: "TLA",
        pick: 1,
        pack: generateRandomPack("TLA"),
        pickedCards: []
      };
    } else if (type === "ECL_P1P1") {
      mockEvent = {
        expansion: "ECL",
        pick: 1,
        pack: generateRandomPack("ECL"),
        pickedCards: []
      };
    } else {
      mockEvent = {
        expansion: "TLA",
        pick: 2,
        pack: generateRandomPack("TLA").slice(0, 13),
        pickedCards: ["98640"]
      };
    }
    
    mainWindow.webContents.send("draft-event", mockEvent);
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
