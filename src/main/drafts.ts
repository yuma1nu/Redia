import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { validateDraft } from '../shared/validation.ts';
import { draftKey } from '../shared/model.ts';
import type { Draft, DraftInput, DraftRef } from '../shared/model.ts';

export class DraftJournal {
  private directory: string;
  constructor(directory: string) { this.directory = directory; mkdirSync(directory, { recursive: true }); }
  private path(ref: DraftRef) { return join(this.directory, `${draftKey(ref).replace(':', '-')}.json`); }
  stage(input: DraftInput): Draft {
    const draft = { ...validateDraft(input), savedAt: new Date().toISOString() };
    const path = this.path(draft.ref);
    // An acknowledgement is sent only after a flushed temporary file has been renamed.
    writeFileSync(`${path}.pending`, JSON.stringify(draft), { encoding: 'utf8', flush: true });
    renameSync(`${path}.pending`, path);
    return draft;
  }
  read(ref: DraftRef): Draft | undefined {
    const path = this.path(ref);
    return existsSync(path) ? this.parse(readFileSync(path, 'utf8')) : undefined;
  }
  list(): Draft[] {
    return readdirSync(this.directory).filter(name => name.endsWith('.json')).map(name => this.parse(readFileSync(join(this.directory, name), 'utf8')));
  }
  clear(ref: DraftRef, token: string) {
    if (this.read(ref)?.token === token) unlinkSync(this.path(ref));
  }
  private parse(json: string): Draft {
    const raw = JSON.parse(json);
    const { savedAt, ...input } = raw;
    if (typeof savedAt !== 'string' || !Number.isFinite(Date.parse(savedAt))) throw new Error('復旧下書きを読み取れません。');
    return { ...validateDraft(input), savedAt };
  }
}
