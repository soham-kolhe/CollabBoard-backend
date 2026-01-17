import { useEffect, useState } from "react";

export const useCursors = (socket, roomId) => {
  const [remoteCursors, setRemoteCursors] = useState({});

  useEffect(() => {
    socket.on("cursor-update", ({ socketId, x, y }) => {
      setRemoteCursors((prev) => ({
        ...prev,
        [socketId]: {
          x,
          y,
          lastActive: Date.now(),
        },
      }));
    });

    return () => socket.off("cursor-update");
  }, [socket]);

  // hide idle cursors
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();

      setRemoteCursors((prev) => {
        const filtered = Object.entries(prev).filter((entry) => {
          const cursor = entry[1];
          return (
            cursor &&
            typeof cursor.lastActive === "number" &&
            now - cursor.lastActive < 3000
          );
        });

        return Object.fromEntries(filtered);
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const syncCursorsWithUsers = (users) => {
    setRemoteCursors((prev) => {
      const updated = {};
      users.forEach((u) => {
        if (prev[u.socketId]) {
          updated[u.socketId] = prev[u.socketId];
        }
      });
      return updated;
    });
  };

  const emitCursor = (x, y) => {
    socket.emit("cursor-move", { roomId, x, y });
  };

  return { remoteCursors, emitCursor, syncCursorsWithUsers };
};
