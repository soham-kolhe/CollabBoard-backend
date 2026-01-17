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

  export const drawActualShape = (ctx, tool, start, end) => {
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
  