import { contextBridge, ipcRenderer, webUtils } from 'electron';
import { APP_INFO_CHANNEL, REQUEST_CHANNEL, CLOSE_REQUEST_CHANNEL, CLOSE_RESPONSE_CHANNEL } from '../shared/api';
import type { WorkspaceApi } from '../shared/api';

if (!process.sandboxed || !process.contextIsolated) {
  throw new Error('The workspace bridge requires sandboxing and context isolation.');
}

const api = Object.freeze<WorkspaceApi>({
  backups: input => ipcRenderer.invoke(REQUEST_CHANNEL,{operation:'backups',input}),
  copyPlanImage: input => ipcRenderer.invoke(REQUEST_CHANNEL,{operation:'copyPlanImage',input}),
  plans: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'plans', input }),
  bodyMenu: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'bodyMenu', input }),
  images: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'images', input }),
  search: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'search', input }),
  documents: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'documents', input }),
  dropDocuments: (files, context) => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'documents', input: { action: 'register', entries: files.map(file => ({ reference: webUtils.getPathForFile(file) })), context } }),
  getAppInfo: () => ipcRenderer.invoke(APP_INFO_CHANNEL),
  getWorkspace: () => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'getWorkspace', input: null }),
  stageDraft: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'stageDraft', input }),
  commitDraft: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'commitDraft', input }),
  discardDraft: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'discardDraft', input }),
  addLink: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'addLink', input }),
  removeLink: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'removeLink', input }),
  createBackup: () => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'createBackup', input: null }),
  setArchived: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'setArchived', input }),
  saveListView: input => ipcRenderer.invoke(REQUEST_CHANNEL, { operation: 'saveListView', input }),
  onCloseRequested: callback => {
    const listener = (_event: Electron.IpcRendererEvent, requestId: string) => callback(requestId);
    ipcRenderer.on(CLOSE_REQUEST_CHANNEL, listener);
    return () => { ipcRenderer.removeListener(CLOSE_REQUEST_CHANNEL, listener); };
  },
  respondToClose: input => ipcRenderer.send(CLOSE_RESPONSE_CHANNEL, input),
});
contextBridge.exposeInMainWorld('workspace', api);
