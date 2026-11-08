export type BodyNode = { type: string; text?: string; attrs?: Record<string, unknown>; marks?: { type: string; attrs?: Record<string, unknown> }[]; content?: BodyNode[] };
export const imageSource = (id: string) => `workspace-image://managed/${id}.png`;
export const imageId = (src: unknown) => typeof src === 'string' ? /^workspace-image:\/\/managed\/([0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\.png$/i.exec(src)?.[1] : undefined;
export const safeLink = (href: unknown) => typeof href === 'string' && /^(https?:\/\/|mailto:)/i.test(href) && !/[\u0000-\u0020]/.test(href);
export function plainBody(text: string): BodyNode {
  return { type: 'doc', content: text.split('\n').map(line => ({ type: 'paragraph', ...(line ? { content: [{ type: 'text', text: line }] } : {}) })) };
}
export function bodyText(node: BodyNode): string {
  if (node.type === 'text') return node.text ?? '';
  if (node.type === 'hardBreak') return '\n';
  if (node.type === 'image') return '';
  return (node.content ?? []).map(bodyText).join(['doc', 'bulletList', 'orderedList', 'taskList', 'listItem', 'taskItem'].includes(node.type) ? '\n' : '');
}
export function parseBody(json: string, limits = true): BodyNode {
  if (limits && json.length > 4 * 1024 * 1024) throw Error('本文が大きすぎます。ページを分けて保存してください。入力は保持しています。');
  const root = JSON.parse(json) as BodyNode;
  let count = 0;
  const allowed = new Set(['doc','paragraph','heading','bulletList','orderedList','listItem','taskList','taskItem','text','hardBreak','image']);
  function visit(node: BodyNode, depth: number) {
    if (limits && (++count>100000 || depth>64)) throw Error('本文の入れ子や項目数が多すぎます。ページを分けて保存してください。入力は保持しています。');
    if (!node || typeof node !== 'object' || Array.isArray(node) || !allowed.has(node.type) || Object.keys(node).some(key=>!['type','text','attrs','marks','content'].includes(key))) throw Error('本文の形式を確認してください。');
    if (node.type === 'text' && (typeof node.text !== 'string' || !node.text || node.text.includes('\0'))) throw Error('本文の文字を確認してください。');
    const attrs: Record<string,string[]> = {heading:['level'],orderedList:['start','type'],taskItem:['checked'],image:['src','alt','title','width','height']};
    if (node.attrs && (typeof node.attrs !== 'object' || Array.isArray(node.attrs) || Object.keys(node.attrs).some(key=>!attrs[node.type]?.includes(key)))) throw Error('本文の属性を確認してください。');
    if (node.type === 'heading' && (!Number.isInteger(node.attrs?.level) || Number(node.attrs?.level)<1 || Number(node.attrs?.level)>6)) throw Error('見出しの段階を確認してください。');
    if (node.type === 'orderedList' && node.attrs?.start !== undefined && (!Number.isSafeInteger(node.attrs.start)||Number(node.attrs.start)<1)) throw Error('番号を確認してください。');
    if (node.type === 'taskItem' && typeof node.attrs?.checked !== 'boolean') throw Error('チェック状態を確認してください。');
    if (node.type === 'image' && (!imageId(node.attrs?.src) || ['alt','title'].some(key=>node.attrs?.[key]!=null&&typeof node.attrs[key]!=='string') || ['width','height'].some(key=>node.attrs?.[key]!=null&&(!Number.isInteger(node.attrs[key])||Number(node.attrs[key])<1||Number(node.attrs[key])>24000000)))) throw Error('管理画像の参照を確認してください。');
    if (node.marks) {
      if (!Array.isArray(node.marks)) throw Error('装飾を確認してください。');
      for (const mark of node.marks) {
        if (!mark || !['bold','italic','code','link'].includes(mark.type) || Object.keys(mark).some(key=>!['type','attrs'].includes(key))) throw Error('装飾を確認してください。');
        if (mark.type === 'link' && (!safeLink(mark.attrs?.href) || Object.keys(mark.attrs??{}).some(key=>!['href','target','rel','class','title'].includes(key)) || Object.values(mark.attrs??{}).some(value=>value!==null&&typeof value!=='string'))) throw Error('リンクを確認してください。');
        if (mark.type!=='link'&&mark.attrs&&Object.keys(mark.attrs).length) throw Error('装飾属性を確認してください。');
      }
    }
    if (node.content) { if (!Array.isArray(node.content)) throw Error('本文の内容を確認してください。'); node.content.forEach(child=>visit(child,depth+1)); }
    const blocks=['paragraph','heading','bulletList','orderedList','taskList','image'];
    const children:Record<string,string[]>={doc:blocks,paragraph:['text','hardBreak'],heading:['text','hardBreak'],listItem:blocks,taskItem:blocks,bulletList:['listItem'],orderedList:['listItem'],taskList:['taskItem']};
    if(node.content?.some(child=>!children[node.type]?.includes(child.type)))throw Error('本文の入れ子を確認してください。');
    if(['listItem','taskItem'].includes(node.type)&&node.content?.[0]?.type!=='paragraph')throw Error('リストの内容を確認してください。');
    if(node.type!=='text'&&node.text!==undefined||node.type!=='text'&&node.marks?.length)throw Error('本文の装飾位置を確認してください。');
  }
  if (root?.type !== 'doc') throw Error('本文を確認してください。');
  visit(root,0); return root;
}
// Quotas apply when staging/committing, while an oversized local buffer stays editable.
export const itemBody = (item: { body: string; bodyJson?: string | null }): BodyNode => item.bodyJson ? parseBody(item.bodyJson, false) : plainBody(item.body);
