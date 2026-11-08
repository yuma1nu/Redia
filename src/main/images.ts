import { nativeImage } from 'electron';
import { lstatSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { IMAGE_BYTES, imageDimensions } from '../shared/images';
import type { ImageResponse, ManagedImage } from '../shared/images';
import type { Result } from '../shared/model';
import { imageId, imageSource, safeLink } from '../shared/body';
import { record } from '../shared/validation';

export class ImageStore {
  constructor(private directory: string, private pick: () => Promise<string|undefined>, private open: (href:string)=>Promise<void>) { mkdirSync(directory,{recursive:true}); }
  import(bytes: Uint8Array): ManagedImage {
    if(!(bytes instanceof Uint8Array)||!bytes.length||bytes.length>IMAGE_BYTES)throw Error('画像は1件20MiB以内で取り込んでください。');
    const size=imageDimensions(bytes);
    if(!size.width||!size.height||size.width*size.height>24000000)throw Error('画像は2400万画素以内で取り込んでください。');
    const decoded=nativeImage.createFromBuffer(Buffer.from(bytes));
    if(decoded.isEmpty()||decoded.getSize().width!==size.width||decoded.getSize().height!==size.height)throw Error('画像を読み取れませんでした。元の画像を確認してください。');
    const png=decoded.toPNG();if(png.length>100*1024*1024)throw Error('保存用画像が大きすぎます。画像を縮小して再試行してください。');
    const id=randomUUID(),path=join(this.directory,`${id}.png`);
    writeFileSync(`${path}.pending`,png,{flag:'wx',flush:true});renameSync(`${path}.pending`,path);
    return {id,src:imageSource(id),...size};
  }
  read(src: string) {
    const id=imageId(src);if(!id)throw Error('不正な画像参照です。');
    const path=join(this.directory,`${id}.png`),stat=lstatSync(path);
    if(!stat.isFile()||stat.isSymbolicLink()||stat.size>100*1024*1024)throw Error('管理画像を読み取れません。');
    return readFileSync(path);
  }
  async request(raw:unknown):Promise<Result<ImageResponse>> {
    try {
      const action=raw&&typeof raw==='object'?(raw as {action?:unknown}).action:undefined;
      if(action==='import'){const r=record(raw,['action','bytes']);return {ok:true,value:this.import(r.bytes as Uint8Array)};}
      if(action==='pick'){record(raw,['action']);const path=await this.pick();if(!path)return {ok:true,value:null};const stat=lstatSync(path);if(!stat.isFile()||stat.size>IMAGE_BYTES)throw Error('画像は1件20MiB以内で取り込んでください。');return {ok:true,value:this.import(readFileSync(path))};}
      if(action==='open-link'){const r=record(raw,['action','href']);if(!safeLink(r.href))throw Error('http・https・mailtoのリンクを指定してください。');await this.open(r.href as string);return {ok:true,value:null};}
      throw Error('未対応の画像操作です。');
    } catch(error){return {ok:false,error:{code:'STORAGE_FAILED',message:error instanceof Error&&'code' in error?'画像を読み込み・保存できませんでした。元ファイルと保存先の空き容量・アクセス権を確認し、再試行してください。':error instanceof Error?error.message:'画像を保存できませんでした。再試行してください。'}};}
  }
}
