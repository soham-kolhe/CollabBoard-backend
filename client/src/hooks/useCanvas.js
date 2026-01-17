import { useEffect, useRef } from "react";
import { drawActualShape } from "../utils/drawUtils";

export const useCanvas = ({
  canvasRef,
  tool,
  color,
  lineWidth,
  socket,
  roomId,
  canDraw,
  onDrawEnd, // callback (save snapshot / undo)
}) => {
  const isDrawing = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const snapshot = useRef(null);

  /* ---------- Canvas Init ---------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
  }, [canvasRef]);

  const getPos = (e) => {
    const rect = canvasRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  /* ---------- Mouse Down ---------- */
  const handleMouseDown = (e) => {
    if (!canDraw) return;

    const ctx = canvasRef.current.getContext("2d", {
      willReadFrequently: true,
    });

    const pos = getPos(e);
    startPos.current = pos;
    isDrawing.current = true;

    snapshot.current = ctx.getImageData(
      0,
      0,
      canvasRef.current.width,
      canvasRef.current.height
    );

    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.globalCompositeOperation =
      tool === "eraser" ? "destination-out" : "source-over";
  };

  /* ---------- Mouse Move ---------- */
  const handleMouseMove = (e) => {
    if (!isDrawing.current) return;

    const ctx = canvasRef.current.getContext("2d");
    const pos = getPos(e);

    if (tool === "pencil" || tool === "eraser") {
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();

      socket.emit("draw", {
        x: pos.x,
        y: pos.y,
        prevX: startPos.current.x,
        prevY: startPos.current.y,
        tool,
        color,
        lineWidth,
        roomId,
      });

      startPos.current = pos;
      return;
    }

    ctx.putImageData(snapshot.current, 0, 0);
    drawActualShape(ctx, tool, startPos.current, pos);
  };

  /* ---------- Mouse Up ---------- */
  const handleMouseUp = (e) => {
    if (!isDrawing.current) return;

    const pos = getPos(e);
    const ctx = canvasRef.current.getContext("2d");

    if (tool !== "pencil" && tool !== "eraser") {
      drawActualShape(ctx, tool, startPos.current, pos);

      socket.emit("draw_shape", {
        startPos: startPos.current,
        endPos: pos,
        tool,
        color,
        lineWidth,
        roomId,
      });
    }

    isDrawing.current = false;
    onDrawEnd?.(); // snapshot / undo handled by Board
  };

  const stopDrawing = () => {
    isDrawing.current = false;
  };

  return {
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    stopDrawing,
  };
};
