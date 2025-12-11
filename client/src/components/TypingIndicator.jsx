import React from "react";

const TypingIndicator = ({ typingUsers }) => {
  if (!typingUsers || typingUsers.length === 0) {
    return null;
  }

  const getTypingText = () => {
    const count = typingUsers.length;
    
    if (count === 1) {
      return `${typingUsers[0]} is typing`;
    } else if (count === 2) {
      return `${typingUsers[0]} and ${typingUsers[1]} are typing`;
    } else if (count === 3) {
      return `${typingUsers[0]}, ${typingUsers[1]}, and ${typingUsers[2]} are typing`;
    } else {
      return `${typingUsers[0]}, ${typingUsers[1]}, and ${count - 2} others are typing`;
    }
  };

  return (
    <div className="px-6 py-2 text-sm text-gray-400">
      <div className="flex items-center gap-2">
        <span>{getTypingText()}</span>
        <div className="flex gap-1">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
        </div>
      </div>
    </div>
  );
};

export default TypingIndicator;
