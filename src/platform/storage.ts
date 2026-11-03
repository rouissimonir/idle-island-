export const SAVE_KEY = 'island-idle-save-v1';

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface SaveAdapter {
  load(): string | null;
  save(serialized: string): void;
}

export function createSaveAdapter(store: KeyValueStore, key = SAVE_KEY): SaveAdapter {
  return {
    load: () => store.getItem(key),
    save: (serialized) => {
      store.setItem(key, serialized);
    },
  };
}
