import React from "react";
import { FaTimes, FaCircle, FaArrowLeft } from "react-icons/fa";

const UsersList = ({ users, currentUser, onClose }) => {
  return (
    <div className="w-full sm:w-64 md:w-72 lg:w-80 h-full bg-gray-800 border-l border-gray-700 shadow-lg flex flex-col">
      <div className="flex items-center justify-between p-3 md:p-4 border-b border-gray-700">
        <h2 className="font-bold text-gray-200">Online Users</h2>
        <button 
          onClick={onClose}
          className="p-1 text-gray-400 hover:bg-gray-700 rounded-full transition-colors"
          aria-label="Close users list"
        >
          <FaArrowLeft className="sm:hidden" />
          <FaTimes className="hidden sm:block" />
        </button>
      </div>
      
      <div className="p-3 md:p-4 flex-1 overflow-y-auto">
        <div className="text-xs text-gray-400 mb-2">
          {users.length} {users.length === 1 ? 'user' : 'users'} online
        </div>
        
        <ul className="space-y-1 sm:space-y-2">
          {users.map((user, index) => (
            <li 
              key={index}
              className={`flex items-center p-2 rounded-lg ${
                user.username === currentUser ? 'bg-gray-700' : 'hover:bg-gray-700'
              }`}
            >
              <div className="w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center bg-indigo-900 text-indigo-100 rounded-full mr-2 sm:mr-3 text-xs sm:text-base">
                {user.username.charAt(0).toUpperCase()}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="font-medium text-gray-200 truncate">
                  {user.username} {user.username === currentUser && <span className="text-xs text-gray-400">(you)</span>}
                </div>
              </div>
              
              <div className="flex items-center">
                <FaCircle className="text-green-500" size={8} />
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
};

export default UsersList;