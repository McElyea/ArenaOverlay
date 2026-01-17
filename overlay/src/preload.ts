import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  version: process.versions.electron,
  onDraftEvent: (callback: (event: any) => void) => 
    ipcRenderer.on("draft-event", (_event, value) => callback(value)),
  sendMockRequest: (type: string) => ipcRenderer.send("request-mock", type),
  runSimulation: (setCode: string) => ipcRenderer.invoke("run-simulation", setCode),
  loadArtifact: (setName: string) => ipcRenderer.invoke("load-artifact", setName)
});
