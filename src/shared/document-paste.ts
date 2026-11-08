import type { DocumentRegistration } from './documents.ts';

// Match the stored URL identity without decoding sharing tokens or changing path case.
export function clipboardUrl(value:string):string|undefined {
  if(/[\x00-\x1f\x7f]/.test(value))return;
  try{const url=new URL(value.trim());if(['http:','https:'].includes(url.protocol)&&url.hostname&&!url.username&&!url.password)return url.href;}catch{/* Ordinary paths/text retain their normal paste behavior. */}
}
export function clipboardName(value:string):string|undefined {
  const name=value.replace(/[\x00-\x1f\x7f]/g,' ').replace(/\s+/g,' ').trim();
  if(name&&[...name].length<=512&&!/^https?:\/\//i.test(name))return name;
}
export function documentEntries(text:string,names:ReadonlyMap<string,string>):DocumentRegistration[]{
  return text.split(/\r?\n/).filter(line=>line.trim()).map(reference=>{const name=names.get(registrationNameKey(reference));return {reference,...(name?{name}:{})};});
}
export const registrationNameKey=(reference:string)=>clipboardUrl(reference.trim().replace(/^"(.*)"$/,'$1'))??reference.trim();
// Conservative preview matching; main remains authoritative for all path normalization.
export function existingReferenceKey(reference:string){
  const value=reference.trim().replace(/^"(.*)"$/,'$1'),url=clipboardUrl(value);
  if(url)return `url:${url}`;
  if(/^(?:[a-z]:[\\/]|\\\\)/i.test(value)){let path=value.replace(/\//g,'\\');if(path.length>3)path=path.replace(/\\+$/,'');return `path:${path.toLowerCase()}`;}
}
