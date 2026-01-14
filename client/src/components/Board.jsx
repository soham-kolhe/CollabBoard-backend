import { useState, useEffect, useRef } from "react";

const Board = ({
  canvasRef,
  tool,
  color,
  lineWidth,
  socket,
  roomId,
  userName,
  currentUserRole,
}) => {
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [snapshot, setSnapshot] = useState(null);
  const [textState, setTextState] = useState({
    isTyping: false,
    x: 0,
    y: 0,
    text: "",
  });
  const [usersInRoom, setUsersInRoom] = useState([]);
  const [canDraw, setCanDraw] = useState(true);

  const textAreaRef = useRef(null);

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  useEffect(() => {
    window.addEventListener("mouseup", stopDrawing);
    return () => window.removeEventListener("mouseup", stopDrawing);
  }, []);

  useEffect(() => {
    socket.on("permission-changed", (status) => {
      setCanDraw(status);
      if (!status) {
        setIsDrawing(false); // Stop any active drawing
        alert("Admin Revoked Your Drawing Permissions.");
      }
    });

    return () => socket.off("permission-changed");
  }, [socket]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // Set size once without using State
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    // Do NOT add 'tool' or 'lineWidth' to this dependency array
  }, [canvasRef]);

  const drawArrow = (ctx, start, end) => {
    const headLength = 15; // length of head in pixels
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const angle = Math.atan2(dy, dx);

    // Draw the main line
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();

    // Draw the arrow head
    ctx.beginPath();
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle - Math.PI / 6),
      end.y - headLength * Math.sin(angle - Math.PI / 6)
    );
    ctx.moveTo(end.x, end.y);
    ctx.lineTo(
      end.x - headLength * Math.cos(angle + Math.PI / 6),
      end.y - headLength * Math.sin(angle + Math.PI / 6)
    );
    ctx.stroke();
  };

  const drawActualShape = (ctx, tool, start, end) => {
    if (tool === "rect") {
      ctx.strokeRect(start.x, start.y, end.x - start.x, end.y - start.y);
    } else if (tool === "ellipse") {
      const rx = Math.abs(end.x - start.x);
      const ry = Math.abs(end.y - start.y);
      ctx.beginPath();
      ctx.ellipse(start.x, start.y, rx, ry, 0, 0, 2 * Math.PI);
      ctx.stroke();
    } else if (tool === "arrow") {
      drawArrow(ctx, start, end);
    }
  };

  useEffect(() => {
    if (!socket) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    socket.on("user_list", (list) => {
      setUsersInRoom(list);
    });

    socket.on("draw", (data) => {
      const { x, y, prevX, prevY, tool, color, lineWidth } = data;
      ctx.beginPath();
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";
      ctx.strokeStyle = tool === "eraser" ? "white" : color;
      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    socket.on("draw_shape", (data) => {
      const { startPos, endPos, tool, color, lineWidth } = data;
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      drawActualShape(ctx, tool, startPos, endPos);
    });

    socket.on("draw_text", (data) => {
      const { text, x, y, color, lineWidth } = data;
      ctx.font = `${lineWidth * 2}px Arial`;
      ctx.fillStyle = color;
      ctx.textBaseline = "top";
      ctx.fillText(text, x, y);
    });

    socket.on("load-canvas", (strokes) => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");

      // ✅ HARD RESET CANVAS
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, ctx.canvas.height);

      // ✅ REPLAY STROKES IN ORDER
      strokes.forEach((stroke) => {
        ctx.beginPath();
        ctx.globalCompositeOperation =
          stroke.tool === "eraser" ? "destination-out" : "source-over";

        ctx.strokeStyle = stroke.color;
        ctx.lineWidth = stroke.lineWidth;
        ctx.lineCap = "round";

        ctx.moveTo(stroke.prevX, stroke.prevY);
        ctx.lineTo(stroke.x, stroke.y);
        ctx.stroke();
      });
    });

    const handleClear = () => {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    };

    socket.on("clear_canvas", handleClear);

    return () => {
      socket.off("user_list");
      socket.off("draw");
      socket.off("draw_shape");
      socket.off("draw_text");
      socket.off("load-canvas");
      socket.off("clear_canvas", handleClear);
    };
  }, [socket, canvasRef]);

  useEffect(() => {
    if (textState.isTyping && textAreaRef.current) {
      textAreaRef.current.focus();
    }
  }, [textState.isTyping]);

  const handleMouseMove = (e) => {
    if (!canDraw || !isDrawing || tool === "text") return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const rect = canvas.getBoundingClientRect();

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "rect" || tool === "ellipse" || tool === "arrow") {
      ctx.putImageData(snapshot, 0, 0);
      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      drawActualShape(ctx, tool, startPos, { x, y });
      return;
    }

    if (tool === "pencil" || tool === "eraser") {
      ctx.globalCompositeOperation =
        tool === "eraser" ? "destination-out" : "source-over";

      ctx.lineTo(x, y);
      ctx.stroke();

      socket.emit("draw", {
        x,
        y,
        prevX: startPos.x,
        prevY: startPos.y,
        tool,
        color,
        lineWidth,
        roomId,
      });

      setStartPos({ x, y });
    }
  };

  const handleMouseDown = (e) => {
    if (!canDraw) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (tool === "text") {
      // If we are already typing, bake the old text first
      if (textState.isTyping && textState.text.length > 0) {
        handleTextBake();
      }

      // Set typing to true and DON'T bake on blur for now
      setTextState({
        isTyping: true,
        x: x,
        y: y,
        text: "",
      });
      return; // Stop here so drawing logic doesn't run
    }

    // DRAWING LOGIC FOR OTHER TOOLS
    setIsDrawing(true);
    setStartPos({ x, y });
    const ctx = canvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });
    setSnapshot(
      ctx.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height)
    );
    ctx.beginPath();
    ctx.moveTo(x, y);

    // ✅ REAL ERASER FIX
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";

    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
  };

  const handleMouseUp = (e) => {
    if (!isDrawing) return;

    const rect = canvasRef.current.getBoundingClientRect();
    const endPos = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };

    if (tool === "rect" || tool === "ellipse" || tool === "arrow") {
      socket.emit("draw_shape", {
        startPos,
        endPos,
        tool,
        color,
        lineWidth,
        roomId,
      });
    }

    setIsDrawing(false);
  };

  const handleTextBake = () => {
    if (textState.text.trim() === "") return;

    const ctx = canvasRef.current.getContext("2d");
    ctx.font = `${lineWidth * 2}px Arial`;
    ctx.fillStyle = color;
    ctx.textBaseline = "top";
    ctx.fillText(textState.text, textState.x, textState.y);

    // EMIT TEXT TO OTHERS
    socket.emit("draw_text", {
      text: textState.text,
      x: textState.x,
      y: textState.y,
      color,
      lineWidth,
      roomId,
    });

    setTextState({ isTyping: false, x: 0, y: 0, text: "" });
  };

  return (
    <div className="relative w-full h-full bg-white overflow-hidden">
      {/* Floating User Sidebar */}
      <div className="fixed top-24 left-6 w-64 max-h-[70vh] bg-white/80 backdrop-blur-md text-gray-800 shadow-2xl z-50 flex flex-col border border-gray-200 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-left-4 duration-500">
        {/* Header */}
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-bold flex items-center gap-2 text-gray-700">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
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

        {/* User List Area */}
        <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
          {usersInRoom.map((user, index) => (
            <div
              key={index}
              className={`flex items-center justify-between p-2.5 rounded-2xl transition-all border ${
                user?.name === userName
                  ? "bg-blue-600 text-white shadow-md shadow-blue-200 border-transparent"
                  : "bg-white border-gray-100 hover:border-blue-200 hover:bg-blue-50/30 text-gray-800"
              }`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Avatar Icon */}
                <div
                  className={`w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-[10px] font-black border ${
                    user?.role === "Admin"
                      ? "bg-amber-100 border-amber-300 text-amber-700"
                      : user?.name === userName
                      ? "bg-white/20 border-white/40 text-white"
                      : "bg-gray-100 border-gray-200 text-gray-500"
                  }`}
                >
                  {(user?.name?.charAt(0) || "?").toUpperCase()}
                </div>

                {/* User Details */}
                <div className="overflow-hidden">
                  <p className="text-xs font-semibold truncate leading-tight">
                    {typeof user?.name === "string" ? user.name : "User"}
                    {user?.name === userName && "(Me)"}
                  </p>
                  <span
                    className={`text-[8px] font-black uppercase tracking-tighter ${
                      user?.name === userName
                        ? "text-blue-100"
                        : "text-gray-400"
                    }`}
                  >
                    {user?.role || "User"}
                  </span>
                </div>
              </div>

              {/* Action Icons */}
              <div className="flex items-center gap-1">
                {/* Admin Toggle Permission Button */}
                {currentUserRole === "Admin" && user?.name !== userName && (
                  <button
                    onClick={() =>
                      socket.emit("toggle-permission", {
                        targetSocketId: user.socketId,
                        roomId,
                      })
                    }
                    className={`p-1 rounded-lg transition-colors ${
                      user?.canDraw
                        ? "text-green-500 hover:bg-green-100"
                        : "text-red-500 hover:bg-red-100"
                    }`}
                    title={user?.canDraw ? "Revoke Access" : "Grant Access"}
                  >
                    {user?.canDraw ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          width="18"
                          height="11"
                          x="3"
                          y="11"
                          rx="2"
                          ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 9.9-1" />
                      </svg>
                    ) : (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <rect
                          width="18"
                          height="11"
                          x="3"
                          y="11"
                          rx="2"
                          ry="2"
                        />
                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      </svg>
                    )}
                  </button>
                )}

                {/* Admin Trophy */}
                {user?.role === "Admin" && (
                  <div
                    className={
                      user?.name === userName ? "text-white" : "text-amber-500"
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6" />
                      <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18" />
                      <path d="M4 22h16" />
                      <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22" />
                      <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22" />
                      <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Footer Action */}
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

      {/* Canvas Element */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={stopDrawing}
        className="block w-full h-full touch-none absolute inset-0 z-0"
        style={{ cursor: tool === "text" ? "text" : "crosshair" }}
      />

      {/* Text Input Overlay */}
      {textState.isTyping && (
        <textarea
          autoFocus
          placeholder="Type..."
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
            left: `${textState.x}px`,
            top: `${textState.y}px`,
            fontSize: `${lineWidth * 2}px`,
            color: color,
            background: "transparent",
            border: "1px dashed #3b82f6",
            zIndex: 1000,
            minWidth: "100px",
            outline: "none",
            resize: "none",
            padding: "0",
          }}
        />
      )}
    </div>
  );
};
export default Board;
