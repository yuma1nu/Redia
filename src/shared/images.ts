export type ManagedImage = { id: string; src: string; width: number; height: number };
export type ImageRequest = { action: 'import'; bytes: Uint8Array } | { action: 'pick' } | { action: 'open-link'; href: string };
export type ImageResponse = ManagedImage | null;
export const IMAGE_BYTES = 20 * 1024 * 1024;
export function imageDimensions(bytes: Uint8Array) {
  const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength);
  if(bytes.length>=24&&[137,80,78,71,13,10,26,10].every((n,i)=>bytes[i]===n)) {
    for(let pos=8;pos+12<=bytes.length;) {const len=v.getUint32(pos);if(String.fromCharCode(...bytes.subarray(pos+4,pos+8))==='acTL')throw Error('アニメーション画像は取り込めません。');if(len>bytes.length-pos-12)throw Error('PNGを読み取れません。');pos+=len+12;}
    return {width:v.getUint32(16),height:v.getUint32(20)};
  }
  if(bytes[0]===255&&bytes[1]===216) {
    let pos=2;
    while(pos+4<=bytes.length) {
      if(bytes[pos++]!==255)break;while(bytes[pos]===255)pos++;const marker=bytes[pos++]!;
      if(marker===217||marker===218)break;
      if(marker===1||marker>=208&&marker<=215)continue;
      const len=v.getUint16(pos);if(len<2||pos+len>bytes.length)break;
      if([192,193,194].includes(marker)&&len>=7)return {height:v.getUint16(pos+3),width:v.getUint16(pos+5)};
      pos+=len;
    }
  }
  throw Error('PNGまたはJPEG画像を選択してください。');
}
