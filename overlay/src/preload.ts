import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("api", {
  version: process.versions.electron,
  onDraftEvent: (callback: (event: any) => void) => 
    ipcRenderer.on("draft-event", (_event, value) => callback(value)),
  sendMockRequest: () => ipcRenderer.send("request-mock"),
  loadArtifact: (setName: string) => ipcRenderer.invoke("load-artifact", setName)
});
