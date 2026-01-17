import { getColorFromSocketId } from "../utils/colorUtils";

const UserList = ({
  usersInRoom,
  userName,
  currentUserRole,
  roomId,
  socket,
}) => {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
      {usersInRoom.map((user, index) => (
        <div
          key={index}
          className={`flex items-center justify-between p-2.5 rounded-2xl transition-all border ${
            user?.name === userName
              ? "text-white shadow-md border-transparent"
              : "border-gray-100 hover:border-blue-200 text-gray-800"
          }`}
          style={{
            backgroundColor:
              user?.name === userName
                ? getColorFromSocketId(user.socketId)
                : `${getColorFromSocketId(user.socketId)}20`,
          }}
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
              <div className="flex items-center gap-2">
                {/* Username */}
                <p
                  className="text-xs font-semibold truncate leading-tight"
                  style={{
                    color: user?.name === userName ? "#fff" : "#111",
                  }}
                >
                  {typeof user?.name === "string" ? user.name : "User"}
                  {user?.name === userName && "(Me)"}
                </p>
              </div>
              <span
                className={`text-[8px] font-black uppercase tracking-tighter ${
                  user?.name === userName ? "text-blue-100" : "text-gray-400"
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
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
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
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
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
  );
};

export default UserList;
