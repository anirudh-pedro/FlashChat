import React, { useState, useRef, useEffect } from "react";
import { FaPaperPlane, FaSmile, FaTimes } from "react-icons/fa";
import EmojiPicker from "emoji-picker-react";
import { getSocket } from "../socket";

const ChatInput = ({ onSendMessage }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const inputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const MAX_MESSAGE_LENGTH = 1000;
  
  useEffect(() => {
    // Close emoji picker when clicking outside
    const handleClickOutside = (event) => {
      if (emojiPickerRef.current && !emojiPickerRef.current.contains(event.target) && 
          emojiButtonRef.current && !emojiButtonRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const trimmedMessage = message.trim();
    
    if (!trimmedMessage) {
      return;
    }
    
    // Check message length (client-side validation)
    if (trimmedMessage.length > 1000) {
      alert("Message is too long. Maximum 1000 characters allowed.");
      return;
    }

    // Stop typing indicator when sending message
    const socket = getSocket();
    if (socket && isTypingRef.current) {
      socket.emit("stopTyping");
      isTypingRef.current = false;
    }
    
    // Clear typing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    onSendMessage(trimmedMessage);
    setMessage("");
  };

  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    const socket = getSocket();
    if (!socket) return;

    // Emit typing event if not already typing
    if (newMessage.trim() && !isTypingRef.current) {
      socket.emit("typing");
      isTypingRef.current = true;
    }

    // Clear existing timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Set new timeout to stop typing after 2 seconds of inactivity
    if (newMessage.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          socket.emit("stopTyping");
          isTypingRef.current = false;
        }
      }, 2000);
    } else {
      // If message is empty, stop typing immediately
      if (isTypingRef.current) {
        socket.emit("stopTyping");
        isTypingRef.current = false;
      }
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage(prevMessage => prevMessage + emojiObject.emoji);
    // Close emoji picker on mobile after selection to save space
    if (window.innerWidth < 640) {
      setShowEmojiPicker(false);
      // Focus the input after selecting an emoji on mobile
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const messageLength = message.length;
  const isNearLimit = messageLength > 900;
  const isOverLimit = messageLength > MAX_MESSAGE_LENGTH;

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 px-4 md:px-6 py-4 relative">
      {isNearLimit && (
        <div className={`text-xs text-right pb-2 ${isOverLimit ? 'text-red-400' : 'text-yellow-400'}`}>
          {messageLength}/{MAX_MESSAGE_LENGTH} characters
        </div>
      )}
      {showEmojiPicker && (
        <div 
          ref={emojiPickerRef}
          className="absolute bottom-full right-4 left-4 md:right-6 md:left-6 mb-2 z-10 max-h-[60vh]"
        >
          <div className="emoji-picker-container w-full mx-auto max-w-md rounded-lg overflow-hidden" 
               style={{boxShadow: "0 8px 24px rgba(0,0,0,0.4)"}}>
            <div className="bg-neutral-800 p-3 flex justify-between items-center">
              <span className="text-white text-sm font-semibold">Emojis</span>
              <button 
                onClick={() => setShowEmojiPicker(false)}
                className="p-1.5 text-gray-300 hover:bg-neutral-700 rounded-lg transition-colors"
                aria-label="Close emoji picker"
              >
                <FaTimes size={16} />
              </button>
            </div>
            <EmojiPicker 
              onEmojiClick={handleEmojiClick} 
              theme="dark"
              emojiStyle="native"
              width="100%"
              height="300px"
              searchPlaceholder="Search emoji..."
              previewConfig={{ showPreview: false }}
              categories={[
                {
                  name: "Smileys & People",
                  category: "smileys_people"
                },
                {
                  name: "Animals & Nature",
                  category: "animals_nature"
                },
                {
                  name: "Food & Drink",
                  category: "food_drink"
                },
                {
                  name: "Travel & Places",
                  category: "travel_places"
                },
                {
                  name: "Activities",
                  category: "activities"
                },
                {
                  name: "Objects",
                  category: "objects"
                },
                {
                  name: "Symbols",
                  category: "symbols"
                },
                {
                  name: "Flags",
                  category: "flags"
                }
              ]}
              lazyLoadEmojis={true}
            />
          </div>
        </div>
      )}
      
      <form onSubmit={handleSubmit} className="flex items-center gap-3 max-w-5xl mx-auto">
        <button 
          type="button"
          ref={emojiButtonRef}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2.5 md:p-3 rounded-xl text-gray-300 hover:bg-neutral-800 transition-colors flex-shrink-0"
          aria-label="Insert emoji"
        >
          <FaSmile size={20} />
        </button>
        
        <div className="flex-1 relative">
          <input
            type="text"
            ref={inputRef}
            value={message}
            onChange={handleMessageChange}
            placeholder="Type a message..."
            maxLength={MAX_MESSAGE_LENGTH}
            className="w-full py-3 md:py-3.5 px-4 md:px-5 text-sm md:text-base bg-neutral-950 border border-neutral-800 text-white rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent placeholder-gray-500 transition-all"
          />
        </div>
        
        <button
          type="submit"
          disabled={!message.trim()}
          className={`p-3 md:p-3.5 rounded-xl flex-shrink-0 transition-all ${
            message.trim() 
              ? 'bg-white text-neutral-950 hover:bg-gray-100 hover:scale-105 shadow-lg' 
              : 'bg-neutral-800 text-gray-500 cursor-not-allowed'
          }`}
          aria-label="Send message"
        >
          <FaPaperPlane size={18} />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;