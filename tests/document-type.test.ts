import {test} from 'node:test';
import assert from 'node:assert/strict';
import {documentType,matchesDocumentType,referenceTitle,validDocumentFilter} from '../src/shared/document-type.ts';
import {selectDocuments} from '../src/shared/document-list.ts';
import type {WorkspaceDocument,DocumentKind} from '../src/shared/documents.ts';
const doc=(reference:string,name='',kind:DocumentKind='file'):WorkspaceDocument=>({id:reference,name,reference,kind,normalized:reference,description:'',revision:1,createdAt:'',updatedAt:''});
test('document icons infer from file extensions, URL paths and Office link names without altering references',()=>{
  for(const [reference,name,kind,type] of [
    ['C:\\Lab\\report.PPTX','名前を変更','file','powerpoint'],['\\\\server\\share\\manual.pdf','','file','pdf'],
    ['https://example.com/%E8%B3%87%E6%96%99.pdf?token=Keep#view','report.pptx','url','pdf'],
    ['https://tenant.sharepoint.com/:w:/s/lab/token?e=Keep','計画書.docx','url','word'],
    ['https://tenant.sharepoint.com/Doc.aspx?file=table.XLSX','table','url','excel'],
    ['https://tenant.sharepoint.com/view?id=%2Fsites%2Flab%2Freport.pptm','','url','powerpoint'],
    ['https://example.com/download?token=secret.pdf','Webリンク','url','url'],
    ['https://example.com/%ZZ','image.png','url','image'],['C:\\Lab\\record.txt','','file','text'],
    ['C:\\Lab\\archive.zip','','file','archive'],['C:\\Lab\\unknown.constructor','','file','file'],
    ['C:\\Lab\\folder.pdf','folder.pdf','folder','folder'],
  ] as const){const input=doc(reference,name,kind),before=JSON.stringify(input);assert.equal(documentType(input),type);assert.equal(JSON.stringify(input),before);}
  assert.equal(referenceTitle('https://example.com/%E8%B3%87%E6%96%99.pdf?token=X'),'資料.pdf');
  assert.equal(referenceTitle('"C:\\Lab\\手順書.docx"'),'手順書.docx');
});
test('derived type filters work across URLs and files and preserve the previous transport filters',()=>{
  const a=doc('C:\\report.pdf'),b=doc('https://example.com/report.pdf','','url'),c=doc('C:\\report.pptx');
  const data={documents:[a,b,c],uses:[]};
  assert.deepEqual(selectDocuments(data,[],{query:'',kind:'pdf',theme:'all',sort:'name-asc'}).map(d=>d.id).sort(),[a.id,b.id].sort());
  assert.ok(matchesDocumentType(a,'file'));assert.ok(!matchesDocumentType(b,'file'));assert.ok(matchesDocumentType(b,'url'));
  for(const value of ['pdf','powerpoint','file','all'])assert.ok(validDocumentFilter(value));
  for(const value of ['__proto__','constructor','unknown',42])assert.ok(!validDocumentFilter(value));
});
