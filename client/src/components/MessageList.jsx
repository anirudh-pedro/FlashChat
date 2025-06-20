import React, { useEffect, useRef } from "react";
import Message from "./Message";

const MessageList = ({ messages, currentUser }) => {
  const messagesEndRef = useRef(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // Group messages by date for date separators
  const groupMessagesByDate = () => {
    const groups = [];
    let currentDate = null;
    
    messages.forEach(message => {
      const messageDate = new Date(message.createdAt).toLocaleDateString();
      
      if (messageDate !== currentDate) {
        currentDate = messageDate;
        groups.push({
          type: 'date',
          date: messageDate
        });
      }
      
      groups.push({
        type: 'message',
        message
      });
    });
    
    return groups;
  };

  const groupedMessages = groupMessagesByDate();

  return (
    <div className="flex-1 overflow-y-auto p-2 sm:p-3 md:p-4 space-y-2 sm:space-y-3 bg-gray-900">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <div className="text-4xl sm:text-5xl mb-3 md:mb-4">💬</div>
          <p className="text-base sm:text-lg font-medium">No messages yet</p>
          <p className="text-xs sm:text-sm">Be the first to send a message!</p>
        </div>
      ) : (
        groupedMessages.map((item, index) => (
          item.type === 'date' ? (
            <div key={`date-${index}`} className="flex justify-center my-3 md:my-4">
              <div className="bg-gray-800 text-gray-300 text-xs px-2 sm:px-3 py-0.5 sm:py-1 rounded-full">
                {item.date === new Date().toLocaleDateString() ? 'Today' : item.date}
              </div>
            </div>
          ) : (
            <Message
              key={`msg-${index}`}
              message={item.message}
              isOwnMessage={item.message.user === currentUser}
            />
          )
        ))
      )}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;