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
    <div className="flex-1 overflow-y-auto px-3 py-2 sm:px-4 sm:py-4 md:px-6 md:py-6 space-y-2 sm:space-y-3 md:space-y-4 bg-neutral-950">
      {messages.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-full text-gray-400">
          <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mb-4">
            <div className="text-3xl">💬</div>
          </div>
          <p className="text-lg font-semibold text-white mb-1">No messages yet</p>
          <p className="text-sm text-gray-500">Start the conversation!</p>
        </div>
      ) : (
        groupedMessages.map((item, index) => (
          item.type === 'date' ? (
            <div key={`date-${index}`} className="flex justify-center my-6">
              <div className="bg-neutral-900 text-gray-400 text-xs font-medium px-4 py-1.5 rounded-full border border-neutral-800">
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