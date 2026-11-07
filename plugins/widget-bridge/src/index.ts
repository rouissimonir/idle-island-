import { registerPlugin } from '@capacitor/core';

export interface IslandWidgetPlugin {
  writeSnapshot(options: { json: string }): Promise<void>;
}

const IslandWidget = registerPlugin<IslandWidgetPlugin>('IslandWidget');

export { IslandWidget };
