import { isAbsolute, join } from 'node:path';

export type Environment = 'development' | 'test' | 'production';

export function dataPaths(localAppData: string, environment: Environment, testRoot?: string) {
  if (!isAbsolute(localAppData)) throw new Error('Local application data must be absolute.');
  if (environment === 'test' && (!testRoot || !isAbsolute(testRoot))) {
    throw new Error('Tests require an explicit absolute data directory.');
  }
  const root = environment === 'test' ? testRoot! : join(localAppData, 'EngineeringWorkspace', environment);
  return {
    root,
    database: join(root, 'database', 'workspace.sqlite'),
    attachments: join(root, 'attachments'),
    drafts: join(root, 'drafts'),
    logs: join(root, 'logs'),
    session: join(root, 'session'),
    backups: join(root, 'backups'),
  };
}
