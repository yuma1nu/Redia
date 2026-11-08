import type { WorkspaceApi } from '../shared/api.ts';
import type { ListView } from '../shared/model.ts';
import { defaultView } from '../shared/lists.ts';

export class ViewStore {
  private api: Pick<WorkspaceApi, 'saveListView'>;
  private state: { views: Record<string, ListView>; initialized: boolean; errors: Record<string, string>; saving: boolean } = { views: {}, initialized: false, errors: {}, saving: false };
  private defaults = defaultView();
  private listeners = new Set<() => void>();
  private dirty = new Set<string>();
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private running = new Map<string, Promise<boolean>>();
  constructor(api: Pick<WorkspaceApi, 'saveListView'>) { this.api = api; }
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit(patch: Partial<typeof this.state>) { this.state = { ...this.state, ...patch }; this.listeners.forEach(listener => listener()); }
  initialize(views: Record<string, ListView>) { if (!this.state.initialized) this.emit({ views, initialized: true }); }
  get(key: string) { return this.state.views[key] ?? this.defaults; }
  patch(key: string, patch: Partial<ListView>) {
    this.emit({ views: { ...this.state.views, [key]: { ...this.get(key), ...patch } } });
    this.dirty.add(key);
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => { void this.save(key); }, 200));
  }
  private save(key: string): Promise<boolean> {
    clearTimeout(this.timers.get(key));
    if (this.running.has(key)) return this.running.get(key)!;
    const work = this.saveLoop(key).finally(() => { this.running.delete(key); this.emit({ saving: this.running.size > 0 }); });
    this.running.set(key, work); return work;
  }
  private async saveLoop(key: string): Promise<boolean> {
    while (this.dirty.has(key)) {
      const view = this.get(key); this.emit({ saving: true });
      try {
        const result = await this.api.saveListView({ key, view });
        if (!result.ok) throw new Error(result.error.message);
        const errors = { ...this.state.errors }; delete errors[key]; this.emit({ errors });
        if (this.get(key) === view) this.dirty.delete(key);
      } catch {
        this.emit({ errors: { ...this.state.errors, [key]: '表示設定を保存できませんでした。現在の条件は画面に保持しています。' } });
        return false;
      }
    }
    return true;
  }
  async flush() { return (await Promise.all([...this.dirty].map(key => this.save(key)))).every(Boolean); }
  dispose() { this.timers.forEach(clearTimeout); this.listeners.clear(); }
}
