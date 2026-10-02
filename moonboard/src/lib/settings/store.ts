import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export interface Settings {
  /** Boardsesh layout id (1..7). null until onboarding is done. */
  layoutId: number | null;
  angle: number;
  /** Last connected LED box, re-connect automatically. */
  deviceId: string | null;
  bothLights: boolean;
  /** LED strip starts at the top of column A instead of the bottom. */
  flippedStrip: boolean;
  /** Show benchmark problems only, remembered between sessions. */
  benchmarksOnly: boolean;
}

const KEY = 'moonlight.settings.v1';

const defaults: Settings = {
  layoutId: null,
  angle: 40,
  deviceId: null,
  bothLights: false,
  flippedStrip: false,
  benchmarksOnly: false,
};

let state: Settings = defaults;
let loaded = false;
const listeners = new Set<() => void>();

async function load() {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) state = { ...defaults, ...JSON.parse(raw) };
  } catch {
    state = defaults;
  }
  loaded = true;
  listeners.forEach((l) => l());
}

const ready = load();

export function settingsReady(): Promise<void> {
  return ready;
}

export function getSettings(): Settings {
  return state;
}

export async function updateSettings(patch: Partial<Settings>): Promise<void> {
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  await AsyncStorage.setItem(KEY, JSON.stringify(state));
}

export function useSettings(): Settings & { loaded: boolean } {
  const s = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
  return { ...s, loaded };
}
