const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("api", {
  loginWithGoogle: () => ipcRenderer.invoke("oauth-google"),
  loginWithMicrosoft: () => ipcRenderer.invoke("oauth-microsoft"),
});
