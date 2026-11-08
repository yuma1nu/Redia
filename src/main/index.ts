import { app, BrowserWindow, dialog, ipcMain, shell, protocol,clipboard,ClipboardItem,nativeImage } from 'electron';
import { ImageStore } from './images';
import { popupBodyMenu } from './body-menu';
import { DocumentActions } from './document-actions';
import { DocumentRepository } from './documents';
import { DocumentDraftJournal } from './document-drafts';
import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { APP_INFO_CHANNEL, validateEmptyRequest, REQUEST_CHANNEL, CLOSE_REQUEST_CHANNEL, CLOSE_RESPONSE_CHANNEL } from '../shared/api';
import { WorkspaceService, validateRequest } from './service';
import { record, uuid } from '../shared/validation';
import { dataPaths } from './paths';
import type { AppInfo } from '../shared/api';
import {BackupManagement,applyPendingRestore} from './backup-management';

const smoke = process.argv.includes('--smoke-test');
protocol.registerSchemesAsPrivileged([{scheme:'workspace-image',privileges:{standard:true,secure:true,supportFetchAPI:true}}]);
if (smoke) app.disableHardwareAcceleration();
const environment = smoke ? 'test' : app.isPackaged ? 'production' : 'development';
const localAppData = process.env.LOCALAPPDATA;
if (!localAppData) throw new Error('LOCALAPPDATA is required on Windows.');
const paths = dataPaths(localAppData, environment, smoke ? process.env.EW_TEST_DATA_DIR : undefined);
for (const directory of [paths.root, dirname(paths.database), paths.attachments, paths.drafts, paths.logs, paths.session, paths.backups]) {
  mkdirSync(directory, { recursive: true });
}
app.setPath('userData', paths.root);
app.setPath('sessionData', paths.session);
app.setAppLogsPath(paths.logs);

function log(message: string) {
  appendFileSync(join(paths.logs, 'app.log'), `${new Date().toISOString()} ${message}\n`);
}

let window: BrowserWindow | null = null;
let service: WorkspaceService;
let closeAllowed = false;
let closeRequest: string | undefined;
let closeTimer: ReturnType<typeof setTimeout> | undefined;
const devUrl = !app.isPackaged ? process.env.EW_DEV_URL : undefined;
if (devUrl && devUrl !== 'http://127.0.0.1:5173') throw new Error('Unexpected development URL.');
const entry = pathToFileURL(join(__dirname, '../dist/index.html')).href;
const trustedUrl = devUrl ? `${devUrl}/` : entry;

app.whenReady().then(async () => {
  if (!app.requestSingleInstanceLock()) { app.exit(0); return; }
  await applyPendingRestore(paths);
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.focus(); });
  service = new WorkspaceService(paths, log);
  const backups=new BackupManagement(paths);let restoring=false;
  const images = new ImageStore(paths.attachments,async()=>{
    const result=await dialog.showOpenDialog(window!,{title:'本文に画像を追加',properties:['openFile','dontAddToRecent'],filters:[{name:'画像',extensions:['png','jpg','jpeg']}]});return result.canceled?undefined:result.filePaths[0];
  },href=>shell.openExternal(href));
  protocol.handle('workspace-image',request=>{
    try {if(request.method!=='GET')return new Response(null,{status:405});const data=images.read(request.url);return new Response(new Uint8Array(data),{headers:{'Content-Type':'image/png','X-Content-Type-Options':'nosniff'}});}
    catch{return new Response(null,{status:404});}
  });
  const documents = new DocumentActions(new DocumentRepository(service.database), {
    pick: async kind => {
      const result = await dialog.showOpenDialog(window!, { title: kind === 'file' ? '資料ファイルを選択' : '資料フォルダーを選択', properties: [kind === 'file' ? 'openFile' : 'openDirectory', 'multiSelections', 'dontAddToRecent'] });
      return result.canceled ? [] : result.filePaths.map(reference => ({ reference, kind }));
    },
    openPath: path => shell.openPath(path), openExternal: url => shell.openExternal(url),
  }, new DocumentDraftJournal(join(paths.drafts, 'documents')));
  const trusted = (event: Electron.IpcMainEvent | Electron.IpcMainInvokeEvent) => {
    if (!window || window.isDestroyed() || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame || event.senderFrame.url !== trustedUrl) throw new Error('Untrusted IPC sender.');
  };
  ipcMain.handle(APP_INFO_CHANNEL, (event, ...args: unknown[]): AppInfo => {
    trusted(event);
    validateEmptyRequest(args);
    return { version: app.getVersion(), environment };
  });
  ipcMain.handle(REQUEST_CHANNEL, (event, ...args: unknown[]) => {
    trusted(event);
    if (args.length !== 1) throw new Error('Invalid request arity.');
    const request = validateRequest(args[0]);
    if(restoring)return {ok:false,error:{code:'BUSY',message:'復元のため再起動しています。'}};
    if(request.operation==='createBackup')return (async()=>{const result=await service.request('createBackup',request.input);if(!result.ok)return result;try{return {ok:true,value:await backups.publish((result.value as {name:string}).name)};}catch(error){log('backup-publish-failed');return {ok:false,error:{code:'BACKUP_FAILED',message:error instanceof Error?error.message:'バックアップできませんでした。'}};}})();
    if(request.operation==='backups')return (async()=>{try{
      const hasName=!!request.input&&typeof request.input==='object'&&Object.hasOwn(request.input,'name');const input=record(request.input,hasName?['action','name']:['action']);
      if(input.action==='choose'&&!hasName){const result=await dialog.showOpenDialog(window!,{title:'バックアップ先を選択',properties:['openDirectory','createDirectory','dontAddToRecent']});if(!result.canceled)await backups.setDirectory(result.filePaths[0]);}
      else if(input.action==='restore'&&hasName&&typeof input.name==='string'){
        const confirm=await dialog.showMessageBox(window!,{type:'warning',title:'バックアップから復元',message:'選んだ世代へ戻してアプリを再起動します。',detail:'現在データは退避します。外部資料の原本は変更しません。',buttons:['戻る','復元して再起動'],defaultId:0,cancelId:0,noLink:true});
        if(confirm.response===1){restoring=true;try{const saved=await service.request('createBackup',null);if(!saved.ok)throw Error(saved.error.message);await backups.prepare(input.name);await service.close();app.relaunch();app.exit(0);}catch(error){restoring=false;throw error;}}
      }else if(input.action!=='list'||hasName)throw Error('操作が不正です。');return {ok:true,value:await backups.list()};
    }catch(error){return {ok:false,error:{code:'BACKUP_FAILED',message:error instanceof Error?error.message:'バックアップを操作できません。'}};}})();
    if(request.operation==='copyPlanImage')return (async()=>{try{
      const input=record(request.input,['png']);
      if(typeof input.png!=='string'||input.png.length>32*1024*1024||!/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(input.png))throw Error('画像形式を確認してください。');
      const bytes=Buffer.from(input.png.slice('data:image/png;base64,'.length),'base64');
      if(bytes.length<24||bytes.subarray(0,8).toString('hex')!=='89504e470d0a1a0a'||bytes.toString('ascii',12,16)!=='IHDR')throw Error('PNGが不正です。');
      const w=bytes.readUInt32BE(16),h=bytes.readUInt32BE(20);if(!w||!h||w>8192||h>8192||w*h>24000000)throw Error('画像が大きすぎます。');
      const image=nativeImage.createFromDataURL(input.png),size=image.getSize();
      if(image.isEmpty()||size.width>8192||size.height>8192||size.width*size.height>24000000)throw Error('画像が大きすぎます。');
      await clipboard.write([new ClipboardItem({'image/png':new Blob([new Uint8Array(image.toPNG())],{type:'image/png'})})]);return {ok:true,value:null};
    }catch{return {ok:false,error:{code:'IMAGE_FAILED',message:'画像をコピーできませんでした。画像サイズを確認して再試行してください。'}};}})();
    if (request.operation === 'bodyMenu') return popupBodyMenu(window!,request.input);
    if (request.operation === 'images') return images.request(request.input);
    if (request.operation === 'documents') return documents.request(request.input).then(result=>{
      if(result.ok){const input=request.input as {action:string;id?:string};if(input.action==='open')void service.request('search',{action:'remember',target:{kind:'document',id:input.id}});else if(!['list','pick','view','stage-edit','discard-edit'].includes(input.action))service.search.invalidate();}return result;
    });
    return service.request(request.operation, request.input);
  });

  async function closeFailed(draftsSafe: boolean) {
    const result = await dialog.showMessageBox(window!, {
      type: 'warning', title: '保存を完了できませんでした',
      message: draftsSafe ? '入力は復旧下書きに保存されています。' : '未保存の内容が残っています。入力や設定は画面に保持しています。',
      detail: draftsSafe ? '画面へ戻って修正するか、再試行できます。下書きを残して終了した場合は、次の起動で復旧できます。' : '画面へ戻り、保存先の空き容量・アクセス権を確認してください。',
      buttons: draftsSafe ? ['画面に戻る', '再試行', '下書きを残して終了'] : ['画面に戻る', '再試行'],
      defaultId: 0, cancelId: 0, noLink: true,
    });
    closeRequest = undefined;
    if (result.response === 2 && draftsSafe) { closeAllowed = true; window?.close(); }
    else if (result.response === 1) window?.close();
  }
  async function closeDeferred(reason: 'operation' | 'registration') {
    const registration=reason==='registration';
    const result=await dialog.showMessageBox(window!,{
      type:registration?'question':'info',title:registration?'登録前の入力があります':'資料の処理中です',
      message:registration?'資料の参照先がまだ登録されていません。':'資料の処理が終わってから、もう一度閉じてください。',
      detail:registration?'画面へ戻って登録するか、登録前の入力を破棄して終了できます。':'保存失敗ではありません。現在の処理と入力はそのまま保持しています。',
      buttons:registration?['画面に戻る','登録前の入力を破棄して終了']:['画面に戻る'],defaultId:0,cancelId:0,noLink:true,
    });
    closeRequest=undefined;
    if(registration&&result.response===1){closeAllowed=true;window?.close();}
  }
  ipcMain.on(CLOSE_RESPONSE_CHANNEL, (event, ...args: unknown[]) => {
    try {
      trusted(event);
      if (args.length !== 1) return;
      const hasReason=!!args[0]&&typeof args[0]==='object'&&Object.hasOwn(args[0],'reason');
      const hasBackup=!!args[0]&&typeof args[0]==='object'&&Object.hasOwn(args[0],'backupFailed');
      const input = record(args[0], ['requestId','ready','draftsSafe',...(hasReason?['reason']:[]),...(hasBackup?['backupFailed']:[])]);
      if(hasBackup&&typeof input.backupFailed!=='boolean')return;
      if (uuid(input.requestId) !== closeRequest || typeof input.ready !== 'boolean' || typeof input.draftsSafe !== 'boolean') return;
      if(hasReason&&input.reason!=='operation'&&input.reason!=='registration')return;
      clearTimeout(closeTimer);
      if(hasReason) void closeDeferred(input.reason as 'operation'|'registration');
      else if(input.ready&&input.draftsSafe&&input.backupFailed){log('automatic-close-backup-failed');closeRequest=undefined;void dialog.showMessageBox(window!,{type:'warning',title:'終了時のバックアップに失敗しました',message:'現在のデータはローカルに保存されています。',detail:'バックアップ先の接続や空き容量を確認してください。既存の完成済み世代は保持しています。',buttons:['画面に戻る','バックアップせず終了'],defaultId:0,cancelId:0,noLink:true}).then(result=>{if(result.response===1){closeAllowed=true;window?.close();}});}
      else if (input.ready && input.draftsSafe) { closeAllowed = true; window?.close(); }
      else void closeFailed(input.draftsSafe);
    } catch { log('invalid-close-response'); }
  });

  window = new BrowserWindow({
    width: 1366, height: 768, minWidth: 960, minHeight: 600,
    title: 'Redia', show: false,
    icon: join(app.getAppPath(), 'assets', 'app-icon.ico'),
    webPreferences: {
      preload: join(__dirname, 'preload.cjs'),
      nodeIntegration: false, contextIsolation: true, sandbox: true,
      webSecurity: true, webviewTag: false,
    },
  });
  window.removeMenu();
  window.on('close', event => {
    if (closeAllowed) return;
    event.preventDefault();
    if (closeRequest) return;
    closeRequest = randomUUID();
    window?.webContents.send(CLOSE_REQUEST_CHANNEL, closeRequest);
    closeTimer = setTimeout(() => { void closeFailed(false); }, 10000);
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event) => event.preventDefault());
  window.webContents.on('will-attach-webview', (event) => event.preventDefault());
  window.webContents.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
  window.webContents.session.setPermissionCheckHandler(() => false);
  window.webContents.on('preload-error', (_event, _path, error) => log(`preload-error ${error.message}`));
  window.webContents.on('render-process-gone', (_event, details) => log(`renderer-gone ${details.reason}`));
  await window.loadURL(trustedUrl);
  window.show();
  log(`started environment=${environment} electron=${process.versions.electron}`);

  if (smoke) {
    if (process.argv.includes('--phase1-test')) {
      const testEntry = pathToFileURL(join(__dirname, 'phase1-scenarios.cjs')).href;
      const { runPhase1 } = await import(testEntry);
      await runPhase1(window, service, paths.root, process.env.EW_SCENARIO ?? '');
      if (!window.isDestroyed()) window.close();
      return;
    }
    // Exercise the real renderer/preload/main boundary, not a mocked browser.
    const result = await window.webContents.executeJavaScript(`(async () => {
      const info = await window.workspace.getAppInfo();
      const workspace = await window.workspace.getWorkspace();
      const documents = await window.workspace.documents({ action: 'list' });
      await new Promise(resolve => setTimeout(resolve, 300));
      return { info, title:document.title,brand:document.querySelector('.brand')?.textContent,node: typeof process, require: typeof require,
        api: Object.keys(window.workspace), home: document.querySelector('h1')?.textContent,
        connected: (document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')),
        workspaceReady: workspace.ok && Array.isArray(workspace.value.items) && !!workspace.value.views,
        documentsReady: documents.ok && Array.isArray(documents.value.documents) && Array.isArray(documents.value.uses) };
    })()`);
    if (result.title!=='Redia'||result.brand!=='Redia'||result.info.environment !== 'test' || result.node !== 'undefined' || result.require !== 'undefined' ||
        !result.api.includes('stageDraft') || !result.api.includes('setArchived') || !result.api.includes('saveListView') || !result.workspaceReady || !result.documentsReady || result.home !== 'HOME' || !result.connected) {
      throw new Error(`Renderer smoke failed: ${JSON.stringify(result)}`);
    }
    const sqlite = service.database.db.prepare('select sqlite_version() as version').get();
    writeFileSync(join(paths.root, 'shell.png'), (await window.webContents.capturePage()).toPNG());
    console.log(`SMOKE_OK ${JSON.stringify({ ...result, sqlite, electron: process.versions.electron, nodeVersion: process.versions.node })}`);
    window.close();
  }
}).catch((error: unknown) => {
  log(`startup-error ${String(error)}`);
  if (!smoke) dialog.showErrorBox('起動できませんでした', '起動処理に失敗しました。アプリ専用領域の logs/app.log を確認してください。');
  console.error(error);
  app.exit(1);
});

app.on('window-all-closed', () => { void service?.close().finally(() => app.quit()); });
app.on('before-quit', () => log('stopping'));
