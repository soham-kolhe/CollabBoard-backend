import React, { useState, useRef, useEffect } from "react";
import Login from "./components/Login";
import Toolbar from "./components/Toolbar";
import Board from "./components/Board";
import { io } from "socket.io-client";
import { useUndoRedo } from "./hooks/useUndoRedo";

const socket = io("http://localhost:5001");

function App() {
  const [user, setUser] = useState(null);
  const [tool, setTool] = useState("pencil");
  const [color, setColor] = useState("#000000");
  const [lineWidth, setLineWidth] = useState(4);

  // Reference to the canvas to call clear methods
  const canvasRef = useRef(null);

  const { undo, redo, pushUndoState } = useUndoRedo(canvasRef);

  useEffect(() => {
    if (user && socket) {
      socket.emit("join-room", {
        userName: user.userName,
        roomId: user.roomId,
      });
    }
  }, [user]);

  useEffect(() => {
    socket.on("joined", (data) => {
      setUser((prev) => ({
        ...prev,
        role: data.role,
      }));
    });

    return () => socket.off("joined");
  }, []);

  const handleToolChange = (newTool) => {
    setTool(newTool);
    if (newTool === "text") {
      setLineWidth(15);
    } else if (newTool === "eraser") {
      setLineWidth(40);
    } else if (newTool === "pencil") {
      setLineWidth(4);
    } else {
      setLineWidth(3);
    }
  };

  if (!user) {
    return <Login onJoin={(userData) => setUser(userData)} />;
  }

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    // Clear locally
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    pushUndoState();
    // Emit to others in the room
    socket.emit("clear_canvas", { roomId: user.roomId });
  };

  const handleDownload = () => {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "whiteboard.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  };

  

  return (
    <div className="relative w-screen h-screen bg-white overflow-hidden">
      <Toolbar
        activeTool={tool}
        setTool={handleToolChange}
        color={color}
        setColor={setColor}
        lineWidth={lineWidth}
        setLineWidth={setLineWidth}
        onUndo={undo}
        onRedo={redo}
        onClear={handleClear}
        onDownload={handleDownload}
      />

      {/* We pass the ref to Board so App.js can "talk" to the canvas */}
      <Board
        canvasRef={canvasRef}
        onDrawEnd={pushUndoState}
        tool={tool}
        color={color}
        lineWidth={lineWidth}
        socket={socket}
        roomId={user.roomId}
        userName={user.userName}
        currentUserRole={user.role}
      />
    </div>
  );
}

export default App;
