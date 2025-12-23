import React from "react";
import { FaUsers, FaSignOutAlt, FaCopy, FaMapMarkerAlt, FaKey, FaBolt, FaCrown, FaBell } from "react-icons/fa";

const ChatHeader = ({ 
  room, 
  userCount, 
  joinMethod, 
  onToggleUsers, 
  onLeaveRoom, 
  onCopyRoomId,
  isLocationBased,
  isAdmin,
  pendingCount,
  onTogglePending
}) => {
  return (
    <header className="bg-neutral-900/95 backdrop-blur-sm border-b border-neutral-800 text-white px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4 shadow-xl flex-shrink-0" style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}>
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2 sm:gap-4">
        {/* Left: Logo & Room Info */}
        <div className="flex items-center gap-3 md:gap-4 min-w-0 flex-1">
          {/* Logo */}
          <div className="hidden sm:flex items-center gap-2 flex-shrink-0">
            <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
              <FaBolt className="text-neutral-950 text-sm" />
            </div>
            <span className="font-bold text-lg hidden lg:block">FlashChat</span>
          </div>
          
          {/* Divider */}
          <div className="hidden sm:block h-6 w-px bg-neutral-700"></div>
          
          {/* Room Info */}
          <div className="flex flex-col min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {isLocationBased || joinMethod === "location" ? (
                <FaMapMarkerAlt className="text-white/70 flex-shrink-0 text-sm" />
              ) : (
                <FaKey className="text-white/70 flex-shrink-0 text-sm" />
              )}
              <span className="font-semibold text-sm md:text-base truncate">{room}</span>
              {isAdmin && (
                <span className="flex items-center gap-1 bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full text-xs flex-shrink-0">
                  <FaCrown className="text-[10px]" />
                  <span className="hidden sm:inline">Admin</span>
                </span>
              )}
              {!isLocationBased && joinMethod !== "location" && (
                <button 
                  onClick={onCopyRoomId}
                  className="p-1.5 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0 cursor-pointer"
                  title="Copy Room ID"
                  aria-label="Copy Room ID"
                >
                  <FaCopy className="text-white/70 text-xs" />
                </button>
              )}
            </div>
            <span className="text-xs text-white/50 hidden sm:block">
              {isLocationBased || joinMethod === "location" ? "Location-based chat" : "Private room"}
            </span>
          </div>
        </div>
        
        {/* Right: Actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Pending Requests Button (Admin only) */}
          {isAdmin && pendingCount > 0 && (
            <button 
              onClick={onTogglePending}
              className="relative flex items-center gap-2 bg-amber-500/20 hover:bg-amber-500/30 rounded-lg px-3 py-2 transition-all cursor-pointer"
              aria-label="Pending join requests"
            >
              <FaBell className="text-amber-400 text-sm" />
              <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center font-bold">
                {pendingCount}
              </span>
            </button>
          )}
          
          <button 
            onClick={onToggleUsers}
            className="flex items-center gap-2 bg-white/10 hover:bg-white/20 rounded-lg px-3 py-2 transition-all cursor-pointer"
            aria-label="Toggle users list"
          >
            <FaUsers className="text-sm" />
            <span className="font-medium text-sm hidden sm:inline">{userCount}</span>
            <span className="font-medium text-sm sm:hidden">{userCount}</span>
          </button>
          
          <button 
            onClick={onLeaveRoom}
            className="flex items-center gap-2 bg-white hover:bg-gray-100 text-neutral-950 rounded-lg px-3 py-2 transition-all cursor-pointer font-semibold"
            title="Leave Room"
            aria-label="Leave Room"
          >
            <FaSignOutAlt className="text-sm" />
            <span className="text-sm hidden md:inline">Leave</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;