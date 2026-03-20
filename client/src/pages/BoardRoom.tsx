import { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { io, Socket } from 'socket.io-client';
import TldrawBoard from '../components/TldrawBoard';
import type { AppUser, RoomUser } from '../types';

interface BoardRoomProps {
  user: AppUser;
}

let socket: Socket | null = null;

function getSocket(token: string) {
  if (!socket) {
    socket = io('http://localhost:5001', { auth: { token } });
  }
  return socket;
}

export default function BoardRoom({ user }: BoardRoomProps) {
  const { boardId } = useParams<{ boardId: string }>();
  const navigate = useNavigate();
  const [usersInRoom, setUsersInRoom] = useState<RoomUser[]>([]);
  const [canDraw, setCanDraw] = useState(true);
  const [myRole, setMyRole] = useState<'Admin' | 'User'>('User');
  const [copyLabel, setCopyLabel] = useState('Copy Invite Link');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const sock = getSocket(user.token);

  useEffect(() => {
    if (!boardId) return;

    sock.emit('join-room', { userName: user.userName, roomId: boardId });

    sock.on('joined', (data: { role: 'Admin' | 'User' }) => {
      setMyRole(data.role);
    });

    sock.on('user_list', (users: RoomUser[]) => {
      setUsersInRoom(users);
    });

    sock.on('permission-changed', (status: boolean) => {
      setCanDraw(status);
    });

    sock.on('role-changed', (role: 'Admin' | 'User') => {
      setMyRole(role);
    });

    return () => {
      sock.off('joined');
      sock.off('user_list');
      sock.off('permission-changed');
      sock.off('role-changed');
    };
  }, [boardId, user.userName, sock]);

  const handleCopyLink = useCallback(() => {
    navigator.clipboard.writeText(window.location.href);
    setCopyLabel('Copied!');
    setTimeout(() => setCopyLabel('Copy Invite Link'), 2000);
  }, []);

  const handleTogglePermission = useCallback((targetSocketId: string) => {
    sock.emit('toggle-permission', { targetSocketId, roomId: boardId });
  }, [sock, boardId]);

  const handleClearCanvas = useCallback(() => {
    if (myRole !== 'Admin') return;
    if (!window.confirm('Clear the entire board? All drawings will be lost.')) return;
    sock.emit('clear_canvas', { roomId: boardId });
  }, [sock, boardId, myRole]);

  if (!boardId) return null;

  return (
    <div className="relative w-screen h-screen bg-slate-50 overflow-hidden">
      {/* ─── Top Bar ─────────────────────────────────────────── */}
      <header className="absolute top-0 left-0 right-0 z-[3000] flex items-center justify-between px-4 py-2 bg-white/80 backdrop-blur-xl border-b border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 transition-colors text-sm font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
            </svg>
            Boards
          </button>
          <div className="w-px h-4 bg-slate-300" />
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.53 16.122a3 3 0 0 0-5.78 1.128 2.25 2.25 0 0 1-2.4 2.245 4.5 4.5 0 0 0 8.4-2.245c0-.399-.078-.78-.22-1.128Zm0 0a15.998 15.998 0 0 0 3.388-1.62m-5.043-.025a15.994 15.994 0 0 1 1.622-3.395m3.42 3.42a15.995 15.995 0 0 0 4.764-4.648l3.876-5.814a1.151 1.151 0 0 0-1.597-1.597L14.146 6.32a15.996 15.996 0 0 0-4.649 4.763m3.42 3.42a6.776 6.776 0 0 0-3.42-3.42" />
              </svg>
            </div>
            <code className="text-xs text-slate-500 font-mono bg-slate-100 px-2 py-0.5 rounded-lg">{boardId}</code>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!canDraw && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
              </svg>
              View only
            </div>
          )}
          {myRole === 'Admin' && (
            <button
              onClick={handleClearCanvas}
              className="text-xs text-slate-500 hover:text-red-500 hover:bg-red-50 border border-slate-200 hover:border-red-200 rounded-lg px-2.5 py-1 transition-all"
            >
              Clear Board
            </button>
          )}
          <button
            onClick={handleCopyLink}
            className="flex items-center gap-1.5 text-xs text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-lg px-3 py-1.5 font-semibold transition-all"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
            </svg>
            {copyLabel}
          </button>
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-all"
            title="Toggle collaborators"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
            </svg>
            {usersInRoom.length > 0 && (
              <span className="sr-only">{usersInRoom.length} online</span>
            )}
          </button>
        </div>
      </header>

      {/* ─── Collaborators Sidebar ───────────────────────────── */}
      {sidebarOpen && (
        <aside className="absolute top-12 left-4 z-[3000] w-60 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-2xl shadow-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                Online · {usersInRoom.length}
              </span>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto">
            {usersInRoom.map((u) => (
              <div
                key={u.socketId}
                className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-slate-50 transition-colors group"
              >
                <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                  {u.name[0].toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-700 font-medium truncate">
                    {u.name}
                    {u.name === user.userName && <span className="text-slate-400 ml-1">(you)</span>}
                  </p>
                  <p className="text-[10px] text-slate-400">{u.role} · {u.canDraw ? 'can draw' : 'view only'}</p>
                </div>
                {myRole === 'Admin' && u.name !== user.userName && (
                  <button
                    onClick={() => handleTogglePermission(u.socketId)}
                    className="opacity-0 group-hover:opacity-100 text-[10px] font-semibold px-2 py-0.5 rounded-lg border transition-all"
                    style={{
                      color: u.canDraw ? '#ef4444' : '#22c55e',
                      borderColor: u.canDraw ? '#fca5a5' : '#86efac',
                      background: u.canDraw ? '#fef2f2' : '#f0fdf4',
                    }}
                  >
                    {u.canDraw ? 'Revoke' : 'Allow'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      )}

      {/* ─── tldraw Canvas ──────────────────────────────────── */}
      <div className="absolute inset-0 pt-12">
        <TldrawBoard
          boardId={boardId}
          user={user}
          socket={sock}
          usersInRoom={usersInRoom}
          canDraw={canDraw}
        />
      </div>
    </div>
  );
}
