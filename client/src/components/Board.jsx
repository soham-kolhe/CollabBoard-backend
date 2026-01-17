import { useEffect, useRef, useState} from "react";
import UserList from "./UserList";
import { getColorFromSocketId } from "../utils/colorUtils";
import { useCanvas } from "../hooks/useCanvas";
import { useCursors } from "../hooks/useCursors";
import { useSocket } from "../hooks/useSocket";

const Board = ({
  canvasRef,
  tool,
  color,
  lineWidth,
  socket,
  roomId,
  userName,
  currentUserRole,
  onDrawEnd,
}) => {
  /* ---------- State ---------- */
  const [usersInRoom, setUsersInRoom] = useState([]);
  const [canDraw, setCanDraw] = useState(true);

  const [textState, setTextState] = useState({
    isTyping: false,
    x: 0,
    y: 0,
    text: "",
  });

  const textAreaRef = useRef(null);

  /* ---------- Hooks ---------- */
  const { remoteCursors, emitCursor, syncCursorsWithUsers } = useCursors(
    socket,
    roomId
  );

  useSocket(socket, canvasRef);

  const saveSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const snapshot = canvas.toDataURL("image/png");
    socket.emit("save-snapshot", { roomId, snapshot });
  };

  const { handleMouseDown, handleMouseMove, handleMouseUp, stopDrawing } =
    useCanvas({
      canvasRef,
      tool,
      color,
      lineWidth,
      socket,
      roomId,
      canDraw,
      onDrawEnd: () => {
        onDrawEnd(); // Handles local Undo/Redo state
        saveSnapshot(); // ✅ New: Persists the canvas to MongoDB
      },
    });

  /* ---------- Permissions ---------- */
  useEffect(() => {
    socket.on("permission-changed", (status) => {
      setCanDraw(status);
      if (!status) alert("Admin revoked your drawing permission.");
    });

    return () => socket.off("permission-changed");
  }, [socket]);

  /* ---------- User list ---------- */
  useEffect(() => {
    socket.on("user_list", (users) => {
      setUsersInRoom(users);
      syncCursorsWithUsers(users);
    });

    return () => socket.off("user_list");
  }, [socket, syncCursorsWithUsers]);

  /* ---------- Load saved canvas (IMPORTANT) ---------- */
  useEffect(() => {
    socket.on("load-canvas", (snapshot) => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      const img = new Image();

      img.onload = () => {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);
      };

      img.src = snapshot;
    });

    return () => socket.off("load-canvas");
  }, [socket, canvasRef]);

  /* ---------- Text tool focus ---------- */
  useEffect(() => {
    if (textState.isTyping && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [textState.isTyping]);

  /* ---------- Text bake ---------- */
  const handleTextBake = () => {
    if (!textState.text.trim()) return;

    const ctx = canvasRef.current.getContext("2d");
    ctx.font = `${lineWidth * 2}px Arial`;
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    ctx.fillText(textState.text, textState.x, textState.y);

    socket.emit("draw_text", {
      text: textState.text,
      x: textState.x,
      y: textState.y,
      color,
      lineWidth,
      roomId,
    });

    setTextState({ isTyping: false, x: 0, y: 0, text: "" });
    saveSnapshot();
  };

  /* ---------- Mouse wrapper (cursor emit) ---------- */
  const handleMouseMoveWrapper = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    emitCursor(x, y);
    handleMouseMove(e);
  };

  /* ---------- Mouse down wrapper (text tool) ---------- */
  const handleMouseDownWrapper = (e) => {
    if (tool === "text") {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      if (textState.isTyping && textState.text) {
        handleTextBake();
      }

      setTextState({ isTyping: true, x, y, text: "" });
      return;
    }

    handleMouseDown(e);
  };

  return (
    <div className="relative w-full h-full bg-white overflow-hidden">
      {/* Floating User Sidebar */}
      <div className="fixed top-24 left-6 w-64 max-h-[70vh] bg-white/80 backdrop-blur-md text-gray-800 shadow-2xl z-50 flex flex-col border border-gray-200 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-bold flex items-center gap-2 text-gray-700">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />{" "}
            Collaborators
          </h2>
          <div className="flex items-center gap-1.5 mt-1">
            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
              Room:
            </span>
            <code className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-mono">
              {roomId}
            </code>
          </div>
        </div>

        <UserList
          usersInRoom={usersInRoom}
          userName={userName}
          currentUserRole={currentUserRole}
          roomId={roomId}
          socket={socket}
        />

        <div className="p-3 bg-gray-50/80 border-t border-gray-100">
          <button
            onClick={() => navigator.clipboard.writeText(roomId)}
            className="w-full py-2 bg-white hover:bg-white text-gray-600 hover:text-blue-600 rounded-xl text-[10px] font-bold flex items-center justify-center gap-2 border border-gray-200 hover:border-blue-200 transition-all shadow-sm active:scale-95"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            Copy Invite Link
          </button>
        </div>
      </div>

      {/* ---------- Canvas + cursors ---------- */}
      <div className="relative w-full h-full">
        {/* Cursors */}
        <div className="absolute inset-0 pointer-events-none z-40">
          {Object.entries(remoteCursors).map(([id, pos]) => (
            <div
              key={id}
              style={{
                position: "absolute",
                left: pos.x,
                top: pos.y,
                transform: "translate(-50%, -50%)",
              }}
            >
              <div
                className="w-3 h-3 rounded-full border-2 border-white shadow-md"
                style={{ backgroundColor: getColorFromSocketId(id) }}
              />
            </div>
          ))}
        </div>

        {/* Canvas */}
        <canvas
          ref={canvasRef}
          onMouseDown={handleMouseDownWrapper}
          onMouseMove={handleMouseMoveWrapper}
          onMouseUp={handleMouseUp}
          onMouseLeave={stopDrawing}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: tool === "text" ? "text" : "crosshair" }}
        />
      </div>
      {/* ---------- Text Input ---------- */}
      {textState.isTyping && (
        <textarea
          ref={textAreaRef}
          value={textState.text}
          onChange={(e) => setTextState({ ...textState, text: e.target.value })}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              handleTextBake();
            }
          }}
          style={{
            position: "absolute",
            left: textState.x,
            top: textState.y,
            fontSize: `${lineWidth * 2}px`,
            color,
            background: "transparent",
            border: "1px dashed #3b82f6",
            outline: "none",
            resize: "none",
            zIndex: 1000,
          }}
        />
      )}
    </div>
  );
};

export default Board;
