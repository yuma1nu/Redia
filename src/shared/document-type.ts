import type {WorkspaceDocument} from './documents.ts';

export const documentTypeLabels={pdf:'PDF',powerpoint:'PowerPoint',word:'Word',excel:'Excel',image:'画像',text:'テキスト',archive:'圧縮ファイル',video:'動画',audio:'音声',file:'ファイル',folder:'フォルダー',url:'URL'} as const;
export type DocumentType=keyof typeof documentTypeLabels;
const extensions:Record<string,DocumentType>={
  pdf:'pdf',ppt:'powerpoint',pptx:'powerpoint',pptm:'powerpoint',pps:'powerpoint',ppsx:'powerpoint',ppsm:'powerpoint',pot:'powerpoint',potx:'powerpoint',potm:'powerpoint',
  doc:'word',docx:'word',docm:'word',dot:'word',dotx:'word',dotm:'word',rtf:'word',
  xls:'excel',xlsx:'excel',xlsm:'excel',xlsb:'excel',xlt:'excel',xltx:'excel',xltm:'excel',
  png:'image',jpg:'image',jpeg:'image',gif:'image',webp:'image',bmp:'image',tif:'image',tiff:'image',svg:'image',heic:'image',
  txt:'text',md:'text',log:'text',csv:'text',tsv:'text',zip:'archive','7z':'archive',rar:'archive',tar:'archive',gz:'archive',
  mp4:'video',mov:'video',avi:'video',wmv:'video',webm:'video',mkv:'video',mp3:'audio',wav:'audio',m4a:'audio',wma:'audio',flac:'audio',ogg:'audio',
};
function decoded(value:string){try{return decodeURIComponent(value);}catch{return value;}}
function extensionType(value:string){const name=value.split(/[\\/]/).at(-1)??'',extension=/\.([a-z0-9]+)$/i.exec(name)?.[1].toLowerCase()??'';return Object.hasOwn(extensions,extension)?extensions[extension]:undefined;}
export function documentType(doc:Pick<WorkspaceDocument,'kind'|'reference'|'name'>):DocumentType{
  if(doc.kind==='folder')return 'folder';
  let fromReference:DocumentType|undefined;
  if(doc.kind==='url'){
    try{const url=new URL(doc.reference);fromReference=extensionType(decoded(url.pathname));
      if(!fromReference)for(const key of ['file','filename','id']){const value=url.searchParams.get(key);if(value&&(fromReference=extensionType(value)))break;}
    }catch{/* Invalid in-progress links retain a generic icon until corrected. */}
  }else fromReference=extensionType(doc.reference);
  return fromReference??extensionType(doc.name)??doc.kind;
}
export const documentKindFilters={all:'すべての種類',...documentTypeLabels};
export function validDocumentFilter(value:unknown):value is keyof typeof documentKindFilters{return typeof value==='string'&&Object.hasOwn(documentKindFilters,value);}
export function matchesDocumentType(doc:WorkspaceDocument,filter:string){return filter==='all'||(['file','folder','url'].includes(filter)?doc.kind===filter:documentType(doc)===filter);}

export function referenceTitle(reference:string){
  const value=reference.trim().replace(/^"(.*)"$/,'$1');
  try{const url=new URL(value);if(['http:','https:','file:'].includes(url.protocol))return decoded(url.pathname.split('/').filter(Boolean).at(-1)??url.hostname);}catch{/* Pasted local paths have no URL scheme. */}
  return value.split(/[\\/]/).filter(Boolean).at(-1)??value;
}
