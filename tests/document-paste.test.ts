import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync,mkdtempSync } from 'node:fs';
import { join,resolve } from 'node:path';
import { clipboardName,clipboardUrl,documentEntries } from '../src/shared/document-paste.ts';
import { WorkspaceDatabase } from '../src/main/db/workspace.ts';
import { DocumentRepository } from '../src/main/documents.ts';
import type { DocumentBatch } from '../src/shared/documents.ts';

test('clipboard titles are bounded plain text and match only the same HTTP URL without changing sharing tokens',()=>{
  const url='https://TENANT.sharepoint.com/:x:/s/lab/EXAMPLE?e=AbC#view';
  assert.equal(clipboardUrl(url),'https://tenant.sharepoint.com/:x:/s/lab/EXAMPLE?e=AbC#view');
  for(const input of ['javascript:alert(1)','file:///C:/file.docx','https://user:secret@example.com','/relative','data:text/html,hi','https://example.com/\npath'])assert.equal(clipboardUrl(input),undefined);
  assert.equal(clipboardName(' \n試験\t計画書.xlsx  '),'試験 計画書.xlsx');assert.equal(clipboardName('https://example.com/'),undefined);assert.equal(clipboardName('長'.repeat(513)),undefined);
  const names=new Map([[clipboardUrl(url)!,'試験計画書.xlsx']]);
  assert.deepEqual(documentEntries(url+'\nC:\\Lab\\manual.txt\nhttps://tenant.sharepoint.com/other',names),[{reference:url,name:'試験計画書.xlsx'},{reference:'C:\\Lab\\manual.txt'},{reference:'https://tenant.sharepoint.com/other'}]);
});
test('a clipboard name is applied on first URL registration, retained on retry, and never overwrites an existing document name',async()=>{
  mkdirSync('test-artifacts',{recursive:true});const root=mkdtempSync(resolve('test-artifacts/clipboard-db-')),db=new WorkspaceDatabase(join(root,'workspace.sqlite')),docs=new DocumentRepository(db);
  const entry={reference:'https://tenant.sharepoint.com/:w:/s/lab/shared?e=Token',name:'試験計画書.docx'};
  db.db.exec('PRAGMA query_only=ON');const failed=await docs.request({action:'register',entries:[entry],context:null}) as DocumentBatch;assert.equal(failed.failed[0].name,entry.name);assert.equal(failed.registered.length,0);db.db.exec('PRAGMA query_only=OFF');
  const result=await docs.request({action:'register',entries:failed.failed.map(({message:_message,...entry})=>entry),context:null}) as DocumentBatch;const id=result.registered[0];assert.equal(docs.get(id).name,entry.name);
  const doc=docs.get(id);await docs.request({action:'edit',id,revision:doc.revision,kind:'url',reference:doc.reference,name:'自分で付けた名前',description:''});
  const duplicate=await docs.request({action:'register',entries:[{...entry,name:'別の貼り付け名'}],context:null}) as DocumentBatch;assert.equal(duplicate.registered[0],id);assert.deepEqual(duplicate.reused,[id]);assert.equal(docs.get(id).name,'自分で付けた名前');
  for(const name of [42,'長'.repeat(513),'悪い\0名前'])await assert.rejects(docs.request({action:'register',entries:[{...entry,name}],context:null}));
  const fallback=await docs.request({action:'register',entries:[{reference:'https://example.com/plain'},{reference:'C:\\Lab\\manual.txt',name:'変更しない',kind:'file'}],context:null}) as DocumentBatch;assert.equal(docs.get(fallback.registered[0]).name,'plain');assert.equal(docs.get(fallback.registered[1]).name,'変更しない');
  db.close();const reopened=new WorkspaceDatabase(join(root,'workspace.sqlite'));assert.equal(new DocumentRepository(reopened).get(id).name,'自分で付けた名前');reopened.close();
});
