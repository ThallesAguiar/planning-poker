export type RoomStorageKind = 'token' | 'session' | 'participant' | 'pending-join' | 'password' | 'join-request';

export function useRoomSession(accountId?: string) {
  const scope = accountId ?? 'guest';

  const storageKey = useCallback(
    (kind: RoomStorageKind, roomCode: string) => `planning-poker-${kind}:${scope}:${roomCode}`,
    [scope],
  );

  const clearJoinStorage = useCallback((roomCode: string) => {
    localStorage.removeItem(storageKey('token', roomCode));
    localStorage.removeItem(storageKey('session', roomCode));
    localStorage.removeItem(storageKey('participant', roomCode));
    localStorage.removeItem(storageKey('join-request', roomCode));
    sessionStorage.removeItem(storageKey('pending-join', roomCode));
    sessionStorage.removeItem(storageKey('password', roomCode));
  }, [storageKey]);

  return { storageKey, clearJoinStorage };
}
import { useCallback } from 'react';
