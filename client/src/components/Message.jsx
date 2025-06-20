import React from "react";

const Message = ({ message, isOwnMessage }) => {
  const { user, text, createdAt } = message;
  
  // Format time from timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Helper function to add more padding around single emoji messages
  const isSingleEmoji = (text) => {
    // Check if the message is just a single emoji (or very few)
    const emojiRegex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff]){1,3}$/;
    return emojiRegex.test(text);
  };

  return (
    <div 
      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
    >
      <div 
        className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 ${
          isOwnMessage 
            ? 'bg-indigo-600 text-white rounded-br-none' 
            : 'bg-gray-800 text-gray-100 border border-gray-700 rounded-bl-none'
        } ${isSingleEmoji(text) ? 'px-4 py-2.5' : ''}`}
      >
        {!isOwnMessage && (
          <div className="font-medium text-xs text-indigo-300 mb-0.5 sm:mb-1">{user}</div>
        )}
        
        <div className={`break-words message-text ${
          isSingleEmoji(text) ? 'text-2xl sm:text-3xl' : 'text-sm'
        }`}>
          {text}
        </div>
        
        <div 
          className={`text-[10px] sm:text-xs mt-1 text-right ${
            isOwnMessage ? 'text-indigo-200' : 'text-gray-400'
          }`}
        >
          {formatTime(createdAt)}
        </div>
      </div>
    </div>
  );
};

export default Message;