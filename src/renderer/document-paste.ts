import { clipboardName,clipboardUrl } from '../shared/document-paste';
import type { DocumentRegistration } from '../shared/documents';

// Clipboard HTML is parsed in inert template content, never mounted or rendered.
export function readClipboardDocuments(html:string,plain:string,owner:Document):DocumentRegistration[]|undefined {
  if(!html||html.length>1024*1024)return;
  const template=owner.createElement('template');template.innerHTML=html;
  template.content.querySelectorAll('script,style,template,iframe,object,embed,svg,math').forEach(node=>node.remove());
  const anchors=[...template.content.querySelectorAll('a[href]')];if(!anchors.length||anchors.length>1000)return;
  const links=anchors.map(anchor=>({reference:clipboardUrl(anchor.getAttribute('href')??''),label:anchor.textContent??''}));
  const valid=links.filter((link):link is {reference:string;label:string}=>!!link.reference);
  if(!valid.length)return;
  const names=new Map(valid.flatMap(link=>{const name=clipboardName(link.label);return name?[[link.reference,name] as const]:[];}));
  const lines=plain.split(/\r?\n/).filter(line=>line.trim());
  // A text URL always wins over HTML: a conflicting hidden href cannot replace it.
  if(lines.some(line=>!!clipboardUrl(line)))return lines.map(reference=>{const url=clipboardUrl(reference),name=url?names.get(url):undefined;return {reference,...(name?{name}:{})};});
  const normalized=(text:string)=>text.replace(/\s+/g,' ').trim();
  if(plain.trim()&&normalized(plain)!==normalized(valid.map(link=>link.label).join(' '))&&normalized(plain)!==normalized(template.content.textContent??''))return;
  if(valid.length!==links.length)return;
  return valid.map(link=>({reference:link.reference,...(names.has(link.reference)?{name:names.get(link.reference)}:{})}));
}
