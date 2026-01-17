import { useEffect, useRef } from "react";

export const useUndoRedo = (canvasRef) => {
  const undoStack = useRef([]);
  const redoStack = useRef([]);

  /* ---------- Helpers ---------- */
  const getSnapshot = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.toDataURL("image/png");
  };

  const restoreSnapshot = (snapshot) => {
    const canvas = canvasRef.current;
    if (!canvas || !snapshot) return;

    const ctx = canvas.getContext("2d");
    const img = new Image();

    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };

    img.src = snapshot;
  };

  /* ---------- Public API ---------- */

  // Call AFTER every completed drawing action
  const pushUndoState = () => {
    const snapshot = getSnapshot();
    if (!snapshot) return;

    undoStack.current.push(snapshot);
    redoStack.current = []; // clear redo on new action
  };

  const undo = () => {
    if (undoStack.current.length === 0) return;

    const current = getSnapshot();
    const previous = undoStack.current.pop();

    if (current) redoStack.current.push(current);

    restoreSnapshot(previous);
  };

  const redo = () => {
    if (redoStack.current.length === 0) return;

    const current = getSnapshot();
    const next = redoStack.current.pop();

    if (current) {
      undoStack.current.push(current);
    }

    restoreSnapshot(next);
  };

  /* ---------- Keyboard Shortcuts ---------- */
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "z") {
        e.preventDefault();
        undo();
      }

      if (e.ctrlKey && (e.key === "y" || (e.shiftKey && e.key === "Z"))) {
        e.preventDefault();
        redo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return {
    pushUndoState,
    undo,
    redo,
  };
};
