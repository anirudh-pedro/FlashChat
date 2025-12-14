import React, { useEffect, useRef } from "react";
import Message from "./Message";

const MessageList = ({ messages, currentUser, onEditMessage, onDeleteMessage, onStartEdit }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "instant", block: "end" });
  };

  // Group messages by date for date separators
  const groupMessagesByDate = () => {
    const groups = [];
    let currentDate = null;
    let prevUser = null;
    
    messages.forEach((message, idx) => {
      const messageDate = new Date(message.createdAt).toLocaleDateString();
      
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        prevUser = null; // Reset prev user on new date
        groups.push({
          type: 'date',
          date: messageDate
        });
      }
      
      // Check if this message is from the same user as the previous one
      const isSameUserAsPrev = prevUser === message.user;
      prevUser = message.user;
      
      groups.push({
        type: 'message',
        message,
        isSameUserAsPrev
      });
    });
    
    return groups;
  };

  const groupedMessages = groupMessagesByDate();

  return (
    <div className="flex-1 overflow-y-auto py-2 sm:py-4 md:py-6 bg-neutral-950">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400 px-4">
          <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mb-4">
            <div className="text-3xl">💬</div>
          </div>
          <p className="text-lg font-semibold text-white mb-1">No messages yet</p>
          <p className="text-sm text-gray-500">Start the conversation!</p>
        </div>
      ) : (
        <div className="space-y-1">
          {groupedMessages.map((item, index) => (
            item.type === 'date' ? (
              <div key={`date-${index}`} className="flex justify-center py-4">
                <div className="bg-neutral-900 text-gray-400 text-xs font-medium px-4 py-1.5 rounded-full border border-neutral-800">
                  {item.date === new Date().toLocaleDateString() ? 'Today' : item.date}
                </div>
              </div>
            ) : (
              <div 
                key={item.message.id || `msg-${index}`}
                className={item.isSameUserAsPrev ? 'pt-0.5' : 'pt-3'}
              >
                <Message
                  message={item.message}
                  isOwnMessage={item.message.user === currentUser}
                  onEditMessage={onEditMessage}
                  onDeleteMessage={onDeleteMessage}
                  onStartEdit={onStartEdit}
                  showUsername={!item.isSameUserAsPrev}
                />
              </div>
            )
          ))}
        </div>
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;