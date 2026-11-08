import type { DatabaseSync } from 'node:sqlite';

export const migrations = [{ version: 1, sql: `
  CREATE TABLE themes (
    id TEXT PRIMARY KEY, name TEXT NOT NULL CHECK(length(trim(name)) > 0), description TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL,
    archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
  ) STRICT;
  CREATE TABLE items (
    id TEXT PRIMARY KEY, title TEXT NOT NULL CHECK(length(trim(title)) > 0),
    state TEXT NOT NULL CHECK(state IN ('未着手','進行中','待ち','完了','中止','いつか')),
    themeId TEXT REFERENCES themes(id), summary TEXT NOT NULL DEFAULT '', body TEXT NOT NULL DEFAULT '',
    dueDate TEXT, reviewDate TEXT, revision INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL, archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
  ) STRICT;
  CREATE TABLE item_links (
    sourceId TEXT NOT NULL REFERENCES items(id), targetId TEXT NOT NULL REFERENCES items(id),
    kind TEXT NOT NULL CHECK(kind IN ('related','derived')), CHECK(sourceId <> targetId),
    PRIMARY KEY(sourceId,targetId)
  ) STRICT;
  CREATE UNIQUE INDEX link_pair ON item_links(min(sourceId,targetId), max(sourceId,targetId));
  CREATE INDEX items_theme ON items(themeId);
  CREATE INDEX items_state ON items(state);
  CREATE TABLE applied_edits (token TEXT PRIMARY KEY, entityId TEXT NOT NULL, kind TEXT NOT NULL) STRICT;
` }, { version: 2, sql: `
  CREATE TABLE view_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;
` }, { version: 3, sql: `
  CREATE TABLE documents (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, reference TEXT NOT NULL, normalized TEXT NOT NULL UNIQUE,
    kind TEXT NOT NULL CHECK(kind IN ('file','folder','url')), description TEXT NOT NULL DEFAULT '',
    revision INTEGER NOT NULL DEFAULT 1, createdAt TEXT NOT NULL, updatedAt TEXT NOT NULL
  ) STRICT;
  CREATE TABLE document_uses (
    documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK(kind IN ('item','theme')), contextId TEXT NOT NULL,
    memo TEXT NOT NULL DEFAULT '', "group" TEXT NOT NULL DEFAULT '', position REAL NOT NULL DEFAULT 0,
    revision INTEGER NOT NULL DEFAULT 1, PRIMARY KEY(documentId,kind,contextId)
  ) STRICT;
  CREATE INDEX document_context ON document_uses(kind,contextId,position);
  CREATE TABLE document_view (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL) STRICT;
` }, { version: 4, sql: `
  CREATE TABLE document_applied_edits (token TEXT PRIMARY KEY, draftKey TEXT NOT NULL, revision INTEGER NOT NULL) STRICT;
` }, { version: 5, sql: `
  ALTER TABLE items ADD COLUMN bodyJson TEXT;
  CREATE TABLE recent_targets (kind TEXT NOT NULL CHECK(kind IN ('item','theme','document')), id TEXT NOT NULL, openedAt TEXT NOT NULL, PRIMARY KEY(kind,id)) STRICT;
` }, { version: 6, sql: `
  CREATE TABLE plan_state (id INTEGER PRIMARY KEY CHECK(id=1), revision INTEGER NOT NULL, rows TEXT NOT NULL) STRICT;
  INSERT INTO plan_state VALUES (1,0,'[]');
  CREATE TABLE plan_applied_edits (token TEXT PRIMARY KEY, revision INTEGER NOT NULL) STRICT;
  CREATE TABLE plan_view (id INTEGER PRIMARY KEY CHECK(id=1), value TEXT NOT NULL) STRICT;
` }, { version: 7, sql: `
  CREATE TABLE theme_document_order (
    themeId TEXT NOT NULL REFERENCES themes(id) ON DELETE CASCADE,
    documentId TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
    position INTEGER NOT NULL, PRIMARY KEY(themeId,documentId)
  ) STRICT;
` }];

export function migrate(db: DatabaseSync, steps = migrations) {
  const current = Number(db.prepare('PRAGMA user_version').get()!.user_version);
  const latest = steps.at(-1)?.version ?? 0;
  if (current > latest) throw new Error('このDBは新しいアプリで作成されています。新しいバージョンを使用してください。');
  for (const step of steps.filter(step => step.version > current)) {
    db.exec('BEGIN IMMEDIATE');
    try {
      db.exec(step.sql);
      db.exec(`PRAGMA user_version = ${step.version}`);
      db.exec('COMMIT');
    } catch (error) { db.exec('ROLLBACK'); throw error; }
  }
}
