import React from "react";
import { FaUsers, FaSignOutAlt, FaCopy, FaMapMarkerAlt, FaKey, FaArrowLeft } from "react-icons/fa";

const ChatHeader = ({ 
  room, 
  userCount, 
  joinMethod, 
  onToggleUsers, 
  onLeaveRoom, 
  onCopyRoomId,
  isLocationBased
}) => {
  return (
    <header className="bg-gradient-to-r from-indigo-800 to-purple-900 text-white py-2 md:py-3 px-3 md:px-4 shadow-md">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center overflow-hidden">
          <h1 className="text-lg md:text-xl font-bold mr-2 md:mr-3 whitespace-nowrap">FlashChat</h1>
          <div className="flex items-center bg-black bg-opacity-20 rounded-full px-2 md:px-4 py-0.2 text-xs md:text-sm truncate max-w-[150px] sm:max-w-[250px] md:max-w-none">
            {isLocationBased || joinMethod === "location" ? (
              <FaMapMarkerAlt className="mr-1 md:mr-2 flex-shrink-0" />
            ) : (
              <FaKey className="mr-1 md:mr-2 flex-shrink-0" />
            )}
            <span className="mr-1 font-medium truncate">{room}</span>
            {!isLocationBased && joinMethod !== "location" && (
              <button 
                onClick={onCopyRoomId}
                className="ml-1 md:ml-2 p-0.2 hover:bg-gray-700 hover:bg-opacity-10  rounded transition-colors flex-shrink-0 cursor-pointer"
                title="Copy Room ID"
                aria-label="Copy Room ID"
              >
                <FaCopy size={12} className="md:hidden" />
                <FaCopy size={14} className="hidden md:block" />
              </button>
            )}
          </div>
        </div>
        
        <div className="flex items-center">
          <button 
            onClick={onToggleUsers}
            className="flex items-center mr-2 md:mr-4 bg-black bg-opacity-20 hover:bg-opacity-30 rounded-full px-2 md:px-3 py-1 transition-colors cursor-pointer"
            aria-label="Toggle users list"
          >
            <FaUsers className="mr-1" />
            <span className="font-medium">{userCount}</span>
          </button>
          
          <button 
            onClick={onLeaveRoom}
            className="flex items-center bg-black bg-opacity-30 hover:bg-opacity-40 rounded-full px-2 md:px-3 py-1 transition-colors cursor-pointer"
            title="Leave Room"
            aria-label="Leave Room"
          >
            <FaArrowLeft className="md:hidden" />
            <FaSignOutAlt className="hidden md:block mr-1" />
            <span className="hidden md:inline">Leave</span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default ChatHeader;