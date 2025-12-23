import React from "react";
import { FaTimes, FaCircle, FaArrowLeft, FaUserSlash } from "react-icons/fa";

const UsersList = ({ users, currentUser, onClose, isAdmin, onKickUser }) => {
  return (
    <div className="w-full sm:w-72 md:w-80 h-full bg-neutral-900/95 backdrop-blur-sm border-l border-neutral-800 shadow-2xl flex flex-col">
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <div>
          <h2 className="font-bold text-white text-base">Online</h2>
          <p className="text-xs text-gray-400 mt-0.5">
            {users.length} {users.length === 1 ? 'user' : 'users'}
          </p>
        </div>
        <button 
          onClick={onClose}
          className="p-2 text-gray-400 hover:bg-neutral-800 rounded-lg transition-colors cursor-pointer"
          aria-label="Close users list"
        >
          <FaArrowLeft className="sm:hidden" />
          <FaTimes className="hidden sm:block" />
        </button>
      </div>
      
      <div className="px-4 py-3 flex-1 overflow-y-auto">
        <ul className="space-y-2">
          {users.map((user, index) => (
            <li 
              key={index}
              className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                user.username === currentUser 
                  ? 'bg-white/10 border border-white/20' 
                  : 'hover:bg-neutral-800'
              }`}
            >
              <div className="w-10 h-10 flex items-center justify-center bg-white text-neutral-950 rounded-full flex-shrink-0 font-bold shadow-lg">
                {user.username.charAt(0).toUpperCase()}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-white text-sm truncate">
                  {user.username}
                </div>
                {user.username === currentUser && (
                  <div className="text-xs text-gray-400 mt-0.5">You</div>
                )}
              </div>
              
              <div className="flex items-center gap-2 flex-shrink-0">
                {isAdmin && user.username !== currentUser && (
                  <button
                    onClick={() => onKickUser && onKickUser(user.id)}
                    className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded-lg transition-colors cursor-pointer"
                    title="Remove user"
                  >
                    <FaUserSlash size={12} />
                  </button>
                )}
                <FaCircle className="text-green-500 animate-pulse" size={8} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UsersList;