import { useEffect, useRef, useCallback } from 'react';
import { Tldraw, createTLStore, defaultShapeUtils, getSnapshot, loadSnapshot } from 'tldraw';
import 'tldraw/tldraw.css';
import type { Socket } from 'socket.io-client';
import type { AppUser, RoomUser } from '../types';

interface TldrawBoardProps {
  boardId: string;
  user: AppUser;
  socket: Socket;
  usersInRoom: RoomUser[];
  canDraw: boolean;
}

export default function TldrawBoard({ boardId, user, socket, usersInRoom, canDraw }: TldrawBoardProps) {
  const storeRef = useRef<ReturnType<typeof createTLStore> | null>(null);
  const isApplyingRemote = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ─── Persist state with debounce ────────────────────────────────
  const scheduleStateSave = useCallback((store: ReturnType<typeof createTLStore>) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        const snapshot = getSnapshot(store);
        const state = JSON.stringify(snapshot);
        socket.emit('save-tldraw-state', { roomId: boardId, state });
      } catch (e) {
        console.warn('Failed to serialize tldraw state', e);
      }
    }, 2000);
  }, [socket, boardId]);

  // ─── Socket event listeners ──────────────────────────────────────
  useEffect(() => {
    // Load persisted state when joining
    socket.on('load-tldraw-state', (stateStr: string) => {
      const store = storeRef.current;
      if (!store || !stateStr) return;
      try {
        const snapshot = JSON.parse(stateStr);
        loadSnapshot(store, snapshot);
      } catch (e) {
        console.warn('Failed to load tldraw state:', e);
      }
    });

    // Receive remote changes from other clients
    socket.on('tldraw-changes', ({ updates, fromSocketId }: { updates: any; fromSocketId: string }) => {
      const store = storeRef.current;
      if (!store || fromSocketId === socket.id) return;

      isApplyingRemote.current = true;
      try {
        store.mergeRemoteChanges(() => {
          store.applyDiff(updates);
        });
      } catch (e) {
        // Diff apply failed — ignore, eventual consistency will kick in
      } finally {
        isApplyingRemote.current = false;
      }
    });

    // Clear canvas from server
    socket.on('clear_canvas', () => {
      const store = storeRef.current;
      if (!store) return;
      try {
        store.clear();
      } catch { /* ignore */ }
    });

    return () => {
      socket.off('load-tldraw-state');
      socket.off('tldraw-changes');
      socket.off('clear_canvas');
    };
  }, [socket, boardId]);

  // ─── Mount tldraw and subscribe to store changes ─────────────────
  const handleMount = useCallback((editor: any) => {
    const store = editor.store;
    storeRef.current = store;

    // Subscribe to store changes and broadcast to room
    const unsub = store.listen((entry: any) => {
      if (isApplyingRemote.current) return;
      if (!entry.changes || Object.keys(entry.changes.added ?? {}).length === 0
        && Object.keys(entry.changes.updated ?? {}).length === 0
        && Object.keys(entry.changes.removed ?? {}).length === 0) return;

      socket.emit('tldraw-changes', {
        roomId: boardId,
        updates: entry.changes,
      });
      scheduleStateSave(store);
    }, { source: 'user', scope: 'document' });

    // Set editor to read-only if user cannot draw
    if (!canDraw) {
      editor.setCurrentTool('hand');
    }

    return unsub;
  }, [socket, boardId, canDraw, scheduleStateSave]);

  return (
    <div className="absolute inset-0">
      <Tldraw
        onMount={handleMount}
        shapeUtils={defaultShapeUtils}
        autoFocus
      />
    </div>
  );
}
