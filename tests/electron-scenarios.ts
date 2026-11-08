import {seedPhase7,runPhase7Layout} from './electron-phase7';
import {runDocumentUpdates} from './electron-document-updates';
import {runPhase6} from './electron-phase6';
import { app, nativeTheme } from 'electron';
import type { BrowserWindow } from 'electron';
import { writeFileSync,readdirSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import type { WorkspaceService } from '../src/main/service';
import { runPhase2 } from './electron-phase2';
import { runPhase3 } from './electron-phase3';
import { runPhase4 } from './electron-phase4';
import { runPhase5 } from './electron-timeline';
import { runClipboard } from './electron-clipboard';
import { runModalFocus } from './electron-focus';

// Only loaded by the explicit test entry in main, with a separate test data directory.
export async function runPhase1(window: BrowserWindow, service: WorkspaceService, root: string, stage: string) {
  window.webContents.setBackgroundThrottling(false);
  const ui = (code: string) => window.webContents.executeJavaScript(`(async () => {
    const wait = async predicate => { const start = Date.now(); while (!predicate()) { if (Date.now()-start > 6000) throw Error('UI wait timed out'); await new Promise(resolve => setTimeout(resolve, 30)); } };
    const click = text => { const button = [...(Array.from(document.querySelectorAll('dialog[open]')).at(-1) || document).querySelectorAll('button')].find(el => (el.textContent.trim() === text || el.getAttribute('aria-label') === text || el.querySelector('strong')?.textContent === text) && !el.disabled && el.getClientRects().length && el.closest('details')?.open !== false); if (!button) throw Error('Missing button: '+text); button.click(); };
    const input = async (selector, value, composing = false) => { const element = document.querySelector(selector); if (!element) throw Error('Missing input '+selector); const collapsed=element.closest('details'); if(collapsed&&!collapsed.open) collapsed.querySelector('summary').click(); if(element.isContentEditable){element.focus();const selection=getSelection(),range=document.createRange();range.selectNodeContents(element);selection.removeAllRanges();selection.addRange(range);document.execCommand('insertText',false,value);await new Promise(resolve=>setTimeout(resolve,30));return;} const prototype = element.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : element.tagName === 'SELECT' ? HTMLSelectElement.prototype : HTMLInputElement.prototype; Object.getOwnPropertyDescriptor(prototype, 'value').set.call(element, value); element.dispatchEvent(new InputEvent('input', { bubbles:true, inputType:'insertText', isComposing:composing })); if(element.tagName === 'SELECT' || element.type === 'date') element.dispatchEvent(new Event('change', {bubbles:true})); await new Promise(resolve => setTimeout(resolve, 0)); };
    try { ${code} } catch(error) { return { testError: String(error), stack: error.stack }; }
  })()`).then(result => { if (result?.testError) throw new Error(`${result.testError}\n${result.stack}`); return result; });
  const snapshot = () => service.database.items();
  await ui(`await wait(() => (document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
  if(stage.startsWith('document-updates-')){await runDocumentUpdates(window,service,root,stage,ui);return;}
  if (stage.startsWith('phase2-')) { await runPhase2(window, service, root, stage, ui); return; }
  if (stage.startsWith('phase3-')) { await runPhase3(window, service, root, stage, ui); return; }
  if (stage.startsWith('phase4-')) { await runPhase4(window, service, root, stage, ui); return; }
  if(stage==='phase6'||stage.startsWith('phase6-')){await runPhase6(window,service,root,ui,stage);return;}
  if (stage.startsWith('phase5-')) { await runPhase5(window, service, root, stage, ui); return; }
  if (stage.startsWith('clipboard-')) { await runClipboard(window, service, root, stage, ui); return; }
  if (stage==='modal-focus') { await runModalFocus(window,service,ui);return; }
  if(stage==='phase7-layout'){await runPhase7Layout(window,service,root,ui);return;}
  if(stage==='phase7-manual')await seedPhase7(window,service);
  if (stage === 'manual'||stage==='phase7-manual'||stage==='phase7-resume') {
    let readOnly = false;
    window.webContents.on('before-input-event', (event, input) => {
      if (input.type === 'keyDown' && input.control && input.shift && input.key === 'F9') {
        event.preventDefault(); readOnly = !readOnly;
        service.database.db.exec(`PRAGMA query_only=${readOnly ? 'ON' : 'OFF'}`);
        console.log(`MANUAL_STORAGE_FAILURE ${readOnly ? 'ON' : 'OFF'}`);
      }
    });
    console.log(`MANUAL_READY ${root}`);
    await new Promise<void>(resolve => window.once('closed', () => resolve()));
  } else if (stage === 'create') {
    await ui(`document.querySelector('[aria-label="テーマを作成"]').click(); await wait(() => document.querySelector('#create-title')); await input('#create-title','材料評価'); await wait(() => !document.querySelector('button[type=submit]').disabled); click('作成する'); await wait(() => !document.querySelector('dialog[open]')); if(document.querySelector('h1')?.textContent !== 'HOME') throw Error('Theme creation navigated away'); click('材料評価'); await wait(() => document.querySelector('[aria-label="テーマ名"]')); click('新規ページ'); await wait(() => document.querySelector('#create-title')); await input('#create-title','温度特性を測定する');`);
    await ui(`const field=document.querySelector('#create-title'); field.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',code:'Enter',isComposing:true,keyCode:229,bubbles:true})); await new Promise(resolve=>setTimeout(resolve,100)); if(!document.querySelector('dialog[open]')) throw Error('IME submitted unexpectedly');`);
    assert.equal(snapshot().length, 0);
    await ui(`click('作成する'); await wait(() => !document.querySelector('dialog[open]')); if(document.querySelector('#item-summary')) throw Error('Page creation navigated away'); click('新規ページ'); await wait(() => document.querySelector('#create-title')); await input('#create-title','連続追加の確認'); click('作成する'); await wait(() => !document.querySelector('dialog[open]')); if(!document.querySelector('[aria-label="テーマ名"]')) throw Error('Continuous creation changed origin'); click('温度特性を測定する'); await wait(() => document.querySelector('#item-summary')); await input('#item-summary','装置の校正が終わり次第、測定する'); await input('#item-body','測定条件を整理する。\\n次の実験へ気づきを残す。'); click('期限・確認日を設定'); await wait(() => document.querySelector('#dueDate')); await input('#dueDate','2028-02-29'); await input('#reviewDate','2027-01-01'); click('ページを追加'); await wait(() => document.querySelector('#related-page-title')); await input('#related-page-title','冷却条件を変えて再検証する'); click('作成して追加'); await wait(() => !document.querySelector('dialog[open]'));`);
    assert.equal(snapshot().find(item=>item.title==='冷却条件を変えて再検証する')!.state,'未着手');
    await ui(`await wait(() => document.body.textContent.includes('冷却条件を変えて再検証する')); click('冷却条件を変えて再検証する'); await wait(()=>document.querySelector('#item-summary')); await input('[aria-label="状態"]','いつか'); click('HOME'); await wait(() => document.querySelector('.someday-row')); await input('.someday-row .cell-input','次の測定結果を見て検討'); await input('tbody .cell-input','一覧からも直接編集できる'); await wait(() => (document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    // Poll the actual DB after renderer debounce/IPC, not only a visual status.
    await waitMain(() => snapshot().some(item => item.summary === '一覧からも直接編集できる'));
    const original = snapshot().find(item => item.title === '温度特性を測定する')!;
    const derived = snapshot().find(item => item.title === '冷却条件を変えて再検証する')!;
    assert.equal(original.state, '未着手'); assert.equal(derived.state, 'いつか');
    assert.equal(derived.themeId, original.themeId); assert.equal(original.dueDate, '2028-02-29'); assert.equal(original.reviewDate, '2027-01-01');
    assert.equal(service.database.links().length, 1);
    nativeTheme.themeSource = 'light';
    await new Promise(resolve => setTimeout(resolve, 120));
    writeFileSync(join(root, 'home-light.png'), (await window.webContents.capturePage()).toPNG());
    nativeTheme.themeSource = 'dark';
    await new Promise(resolve => setTimeout(resolve, 120));
    writeFileSync(join(root, 'home-dark.png'), (await window.webContents.capturePage()).toPNG());
    await ui(`click('温度特性を測定する'); await wait(() => document.querySelector('#item-summary'));`);
    await ui(`const trail=[...document.querySelector('[aria-label="パンくず"]').querySelectorAll('.breadcrumb-link, [aria-current="page"]')].map(el=>el.textContent); if(JSON.stringify(trail)!==JSON.stringify(['ワークスペース','材料評価','温度特性を測定する'])) throw Error('Incorrect breadcrumb: '+JSON.stringify(trail)); document.querySelectorAll('.breadcrumb-link')[1].click(); await wait(() => document.querySelector('[aria-label="テーマ名"]')); click('温度特性を測定する'); await wait(() => document.querySelector('#item-theme')); await input('#item-theme',''); await wait(() => document.querySelector('[aria-label="パンくず"]').textContent.includes('未所属'));`);
    await waitMain(() => service.database.item(original.id).themeId === null);
    await ui(`await input('#item-theme', ${JSON.stringify(original.themeId)});`);
    await waitMain(() => service.database.item(original.id).themeId === original.themeId);
    for (const state of ['進行中', '待ち', '完了', '中止', 'いつか', '未着手']) {
      await ui(`await input('[aria-label="状態"]', ${JSON.stringify(state)});`);
      await waitMain(() => service.database.item(original.id).state === state);
      assert.equal(service.database.item(original.id).summary, '一覧からも直接編集できる');
    }
    nativeTheme.themeSource = 'light';
    await new Promise(resolve => setTimeout(resolve, 120));
    await ui(`await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));`);
    writeFileSync(join(root, 'detail-light.png'), (await window.webContents.capturePage()).toPNG());
  } else if (stage === 'restart') {
    assert.equal(snapshot().length, 3);
    const original = snapshot().find(item => item.title === '温度特性を測定する')!;
    assert.equal(original.summary, '一覧からも直接編集できる');
    assert.equal(original.body, ['測定条件を整理する。', '次の実験へ気づきを残す。'].join('\n'));
    await ui(`click('冷却条件を変えて再検証する'); await wait(() => document.querySelector('#item-summary')); if(!document.querySelector('.related-section').textContent.includes('温度特性を測定する')) throw Error('Missing reverse link'); click('温度特性を測定する'); await wait(() => document.querySelector('#dueDate')); document.querySelector('[aria-label="期限を解除"]').click();`);
    await waitMain(() => service.database.item(original.id).dueDate === null);
    assert.equal(service.database.item(original.id).reviewDate, '2027-01-01');
    // Real DB storage failure while editing through React, followed by navigation and retry.
    service.database.db.exec('PRAGMA query_only=ON');
    await ui(`input('#item-summary','障害中もこの入力を残す'); click('HOME'); await wait(() => document.querySelector('.error-banner'));`);
    assert.notEqual(service.database.item(original.id).summary, '障害中もこの入力を残す');
    assert.equal(service.journal.list().length, 1);
    await ui(`click('温度特性を測定する'); await wait(() => document.querySelector('#item-summary')); if(document.querySelector('#item-summary').value !== '障害中もこの入力を残す') throw Error('Lost edit during navigation');`);
    service.database.db.exec('PRAGMA query_only=OFF');
    await ui(`click('再試行'); await wait(() => !document.querySelector('.error-banner'));`);
    await waitMain(() => service.database.item(original.id).summary === '障害中もこの入力を残す');
    const beforeBackups=readdirSync(join(root,'backups')).filter(name=>!name.endsWith('.partial')).length;
    await ui(`click('設定'); await wait(() => document.querySelector('.settings-section')); click('バックアップを作成');`);
    await waitMain(()=>readdirSync(join(root,'backups')).filter(name=>!name.endsWith('.partial')).length>beforeBackups);
    await ui(`click('材料評価'); await wait(() => document.querySelector('table')); click('温度特性を測定する'); await wait(() => document.querySelector('#item-summary')); await input('#item-summary','終了直前の入力も保存する');`);
  } else if (stage === 'crash') {
    assert.equal(snapshot().find(item => item.title === '温度特性を測定する')!.summary, '終了直前の入力も保存する');
    await ui(`click('温度特性を測定する'); await wait(() => document.querySelector('#item-body')); await input('#item-body','異常終了しても復旧するメモ',true);`);
    await waitMain(() => service.journal.list().length === 1);
    assert.notEqual(service.database.items()[0].body, '異常終了しても復旧するメモ');
    console.log('PHASE1_CRASH_DRAFT_PROTECTED');
    app.exit(17); // Simulate abnormal termination without renderer close/flush.
    return;
  } else if (stage === 'recover') {
    await ui(`await wait(() => document.querySelector('.recovery-panel')); click('復旧する'); await wait(() => document.querySelector('#item-body')); if(document.querySelector('#item-body').textContent !== '異常終了しても復旧するメモ') throw Error('Recovery missing'); await wait(() => (document.querySelector('.workspace[aria-busy="false"]')&&!document.querySelector('.save-status.error-text')));`);
    await waitMain(() => snapshot().some(item => item.body === '異常終了しても復旧するメモ'));
    assert.equal(service.journal.list().length, 0);
    await new Promise(resolve => setTimeout(resolve, 200));
    writeFileSync(join(root, 'recovered.png'), (await window.webContents.capturePage()).toPNG());
  } else throw new Error('Unexpected test stage');
  console.log(`PHASE1_OK ${stage}`);
}

async function waitMain(predicate: () => boolean) {
  const start = Date.now();
  while (!predicate()) { if (Date.now() - start > 7000) throw new Error('DB assertion timed out'); await new Promise(resolve => setTimeout(resolve, 30)); }
}
