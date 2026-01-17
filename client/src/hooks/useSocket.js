import { useEffect } from "react";
import { drawActualShape } from "../utils/drawUtils";

export const useSocket = (socket, canvasRef) => {
  useEffect(() => {
    if (!socket || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    // 🔹 Pencil / eraser drawing (freehand)
    socket.on("draw", (data) => {
      const { x, y, prevX, prevY, tool, color, lineWidth } = data;

      ctx.beginPath();
      ctx.globalCompositeOperation =
        tool === "eraser" ? "destination-out" : "source-over";

      ctx.strokeStyle = color;
      ctx.lineWidth = lineWidth;
      ctx.lineCap = "round";

      ctx.moveTo(prevX, prevY);
      ctx.lineTo(x, y);
      ctx.stroke();
    });

    // 🔹 Shapes: rect / ellipse / arrow
    socket.on("draw_shape", (data) => {
      const { tool, startPos, endPos } = data;

      ctx.globalCompositeOperation = "source-over";
      drawActualShape(ctx, tool, startPos, endPos);
    });

    // 🔹 Clear canvas
    socket.on("clear_canvas", () => {
      ctx.globalCompositeOperation = "source-over";
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    });

    // 🧹 Cleanup
    return () => {
      socket.off("draw");
      socket.off("draw_shape");
      socket.off("clear_canvas");
    };
  }, [socket, canvasRef]);
};
