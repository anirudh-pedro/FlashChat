import React, { useState, useRef, useEffect } from "react";
import { FaPaperPlane, FaSmile, FaTimes } from "react-icons/fa";
import EmojiPicker from "emoji-picker-react";

const ChatInput = ({ onSendMessage }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const inputRef = useRef(null);
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
    
    onSendMessage(trimmedMessage);
    setMessage("");
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
    <div className="bg-gray-800 border-t border-gray-700 p-3 relative">
      {isNearLimit && (
        <div className={`text-xs text-right pb-1 ${isOverLimit ? 'text-red-400' : 'text-yellow-400'}`}>
          {messageLength}/{MAX_MESSAGE_LENGTH} characters
        </div>
      )}
      {showEmojiPicker && (
        <div 
          ref={emojiPickerRef}
          className="absolute bottom-full right-0 left-0 mb-2 z-10 max-h-[60vh]"
          style={{maxWidth: "100%"}}
        >
          <div className="emoji-picker-container w-full mx-auto" 
               style={{maxWidth: "350px", boxShadow: "0 8px 24px rgba(0,0,0,0.4)"}}>
            <div className="bg-gray-700 p-2 rounded-t-lg flex justify-between items-center">
              <span className="text-white text-sm font-medium pl-1">Emojis</span>
              <button 
                onClick={() => setShowEmojiPicker(false)}
                className="p-1.5 text-gray-300 hover:bg-gray-600 rounded-full"
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
      
      <form onSubmit={handleSubmit} className="flex items-center">
        <button 
          type="button"
          ref={emojiButtonRef}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="p-2 rounded-full text-gray-300 hover:bg-gray-700 transition-colors mr-2"
          aria-label="Insert emoji"
        >
          <FaSmile size={20} />
        </button>
        
        <input
          type="text"
          ref={inputRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="Type a message..."
          maxLength={MAX_MESSAGE_LENGTH}
          className="flex-1 py-2.5 px-4 text-sm bg-gray-700 text-white rounded-full focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder-gray-400"
        />
        
        <button
          type="submit"
          disabled={!message.trim()}
          className={`ml-2 p-2.5 rounded-full ${
            message.trim() 
              ? 'bg-indigo-600 text-white hover:bg-indigo-700' 
              : 'bg-gray-700 text-gray-500 cursor-not-allowed'
          } transition-colors`}
          aria-label="Send message"
        >
          <FaPaperPlane size={16} />
        </button>
      </form>
    </div>
  );
};

export default ChatInput;