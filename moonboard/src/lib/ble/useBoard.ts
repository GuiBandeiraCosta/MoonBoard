import { useSyncExternalStore } from 'react';
import { board } from './manager';

/** React binding for the shared board connection. */
export function useBoard() {
  const snapshot = useSyncExternalStore(
    (cb) => board.subscribe(cb),
    () => `${board.status}|${board.found.length}|${board.deviceName}|${board.lastError}`,
  );
  void snapshot;
  return board;
}
