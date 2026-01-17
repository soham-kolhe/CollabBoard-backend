export const getColorFromSocketId = (socketId) => {
    let hash = 0;
    for (let i = 0; i < socketId.length; i++) {
      hash = socketId.charCodeAt(i) + ((hash << 5) - hash);
    }

    const hue = Math.abs(hash) % 360;
    return `hsl(${hue}, 75%, 55%)`;
  };