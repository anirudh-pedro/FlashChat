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
      className={`flex items-end gap-2 ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
    >
      {/* Avatar for received messages */}
      {!isOwnMessage && (
        <div className="w-8 h-8 bg-white rounded-full flex items-center justify-center flex-shrink-0 mb-0.5 font-semibold text-neutral-950 text-sm">
          {user.charAt(0).toUpperCase()}
        </div>
      )}
      
      <div className="flex flex-col max-w-[75%] sm:max-w-[65%] md:max-w-[60%]">
        {!isOwnMessage && (
          <div className="font-medium text-xs text-gray-400 mb-1 ml-1">{user}</div>
        )}
        
        <div 
          className={`rounded-2xl px-4 py-2.5 ${
            isOwnMessage 
              ? 'bg-white text-neutral-950 rounded-br-md shadow-lg' 
              : 'bg-neutral-900 text-gray-100 border border-neutral-800 rounded-bl-md'
          } ${isSingleEmoji(text) ? 'px-5 py-3' : ''}`}
        >
          <div className={`break-words message-text ${
            isSingleEmoji(text) ? 'text-3xl md:text-4xl' : 'text-sm md:text-base leading-relaxed'
          }`}>
            {text}
          </div>
          
          <div 
            className={`text-[10px] mt-1 ${
              isOwnMessage ? 'text-neutral-600 text-right' : 'text-gray-500'
            }`}
          >
            {formatTime(createdAt)}
          </div>
        </div>
      </div>
      
      {/* Spacer for sent messages to keep alignment */}
      {isOwnMessage && <div className="w-8 flex-shrink-0"></div>}
    </div>
  );
};

export default Message;