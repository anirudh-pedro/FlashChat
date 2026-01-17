import React, { useState, useRef, useEffect } from "react";
import { FaPaperPlane, FaSmile, FaTimes, FaPaperclip, FaPen } from "react-icons/fa";
import EmojiPicker from "emoji-picker-react";
import { getSocket } from "../socket";

const ChatInput = ({ onSendMessage, onSendFile, editingMessage, onCancelEdit }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(""); // "reconnecting", "sending", ""
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const MAX_MESSAGE_LENGTH = 1000;
  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // Populate input when editing a message
  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.text);
      // Focus the textarea
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [editingMessage]);

  // Auto-resize textarea with scrollbar when exceeding max height
  useEffect(() => {
    if (textareaRef.current) {
      // Reset height to auto to get the correct scrollHeight
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120;
      
      if (scrollHeight > maxHeight) {
        // Content exceeds max, set to max and enable scroll
        textareaRef.current.style.height = maxHeight + 'px';
        textareaRef.current.style.overflowY = 'auto';
      } else {
        // Content fits, use scrollHeight
        textareaRef.current.style.height = scrollHeight + 'px';
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [message]);
  
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
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      // Keep focus on textarea to prevent mobile keyboard from closing
      textareaRef.current.focus();
    }
  };

  const handleCancelEdit = () => {
    setMessage("");
    onCancelEdit?.();
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    // Cancel editing on Escape
    if (e.key === 'Escape' && editingMessage) {
      e.preventDefault();
      handleCancelEdit();
    }
    // Shift+Enter will naturally create a new line in textarea
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
    // Focus the textarea after selecting an emoji
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

    // Validate file type
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'application/pdf',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      alert('File type not allowed. Supported: images, PDF, text, Word documents.');
      return;
    }

    setIsUploading(true);
    setUploadStatus("preparing");

    try {
      // Mobile file picker causes browser to go to background, disconnecting WebSocket
      // We need to wait for reconnection and room rejoin before sending
      const socket = getSocket();
      
      // Wait for socket to be connected (up to 8 seconds for camera/photo picker)
      const waitForConnection = async (maxWait = 8000) => {
        const startTime = Date.now();
        while (Date.now() - startTime < maxWait) {
          const currentSocket = getSocket();
          if (currentSocket && currentSocket.connected) {
            // Give extra time for room rejoin after reconnection
            await new Promise(resolve => setTimeout(resolve, 1000));
            return true;
          }
          await new Promise(resolve => setTimeout(resolve, 300));
        }
        return false;
      };
      
      if (!socket || !socket.connected) {
        // Socket disconnected (common on mobile when camera/file picker opens)
        console.log('Socket disconnected, waiting for reconnection...');
        setUploadStatus("reconnecting");
        const reconnected = await waitForConnection(8000); // 8 seconds for camera
        
        if (!reconnected) {
          setUploadStatus("");
          setIsUploading(false);
          alert('Connection lost. Please try uploading again.');
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          return;
        }
        console.log('Socket reconnected, proceeding with file upload');
      }
      
      setUploadStatus("sending");

      // Convert file to base64
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Send file via socket and wait for response
      const result = await onSendFile({
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: base64Data
      });
      
      if (result && result.error) {
        // Error already shown via toast in parent
        console.error('File send failed:', result.error);
      }
    } catch (error) {
      console.error('Error reading file:', error);
      alert('Failed to read file. Please try again.');
    } finally {
      setIsUploading(false);
      setUploadStatus("");
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const messageLength = message.length;
  const isNearLimit = messageLength > 900;
  const isOverLimit = messageLength > MAX_MESSAGE_LENGTH;

  return (
    <div className="bg-neutral-900 border-t border-neutral-800 px-2 py-2 sm:px-4 sm:py-3 md:px-6 md:py-4 relative flex-shrink-0">
      {/* File upload loader overlay */}
      {isUploading && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col items-center gap-4 shadow-2xl">
            <div className="w-12 h-12 border-4 border-neutral-700 border-t-white rounded-full animate-spin" />
            <p className="text-white font-medium text-lg">
              {uploadStatus === "reconnecting" ? "Reconnecting..." : 
               uploadStatus === "sending" ? "Sending file..." : "Preparing..."}
            </p>
            <p className="text-gray-400 text-sm">
              {uploadStatus === "reconnecting" ? "Please wait while we restore connection" : "Please wait"}
            </p>
          </div>
        </div>
      )}

      {/* Editing indicator */}
      {editingMessage && (
        <div className="flex items-center justify-between gap-2 pb-2 mb-2 border-b border-neutral-800 max-w-5xl mx-auto">
          <div className="flex items-center gap-2 text-sm text-white">
            <FaPen size={12} className="text-blue-400" />
            <span className="text-blue-400 font-medium">Editing message</span>
            <span className="text-gray-400 truncate max-w-[200px] sm:max-w-[300px]">
              "{editingMessage.text.length > 50 ? editingMessage.text.substring(0, 50) + '...' : editingMessage.text}"
            </span>
          </div>
          <button
            type="button"
            onClick={handleCancelEdit}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-neutral-800 rounded-lg transition-colors"
            aria-label="Cancel editing"
          >
            <FaTimes size={14} />
          </button>
        </div>
      )}
      
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
      
      <form onSubmit={handleSubmit} className="flex items-end gap-1.5 sm:gap-2 md:gap-3 max-w-5xl mx-auto">
        {/* Hidden file input */}
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept="image/*,.pdf,.txt,.doc,.docx"
          className="hidden"
        />
        
        {/* File attachment button */}
        <button 
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className={`p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl transition-colors flex-shrink-0 cursor-pointer flex items-center justify-center ${
            isUploading 
              ? 'text-gray-500 cursor-not-allowed' 
              : 'text-gray-300 hover:bg-neutral-800'
          }`}
          aria-label="Attach file"
          title="Attach file or image"
        >
          {isUploading ? (
            <div className="w-5 h-5 sm:w-[18px] sm:h-[18px] md:w-5 md:h-5 border-2 border-gray-500 border-t-white rounded-full animate-spin" />
          ) : (
            <FaPaperclip className="w-5 h-5 sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
          )}
        </button>

        {/* Emoji button - hidden on mobile, tablets, and small laptops */}
        <button 
          type="button"
          ref={emojiButtonRef}
          onClick={() => setShowEmojiPicker(!showEmojiPicker)}
          className="hidden lg:block p-2 lg:p-3 rounded-xl text-gray-300 hover:bg-neutral-800 transition-colors flex-shrink-0 cursor-pointer"
          aria-label="Insert emoji"
        >
          <FaSmile size={18} className="lg:w-5 lg:h-5" />
        </button>
        
        <div className="flex-1 relative min-w-0">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleMessageChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            maxLength={MAX_MESSAGE_LENGTH}
            rows={1}
            className="w-full py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 text-sm md:text-base bg-neutral-950 border border-neutral-800 text-white rounded-xl sm:rounded-2xl focus:outline-none focus:ring-2 focus:ring-white/50 focus:border-transparent placeholder-gray-500 transition-all resize-none overflow-y-auto leading-normal scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent"
            style={{ minHeight: '38px', maxHeight: '120px' }}
          />
        </div>
        
        <button
          type="submit"
          disabled={!message.trim()}
          className={`p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl flex-shrink-0 transition-all self-end cursor-pointer flex items-center justify-center ${
            message.trim() 
              ? editingMessage
                ? 'bg-blue-500 text-white hover:bg-blue-600 hover:scale-105 shadow-lg'
                : 'bg-white text-neutral-950 hover:bg-gray-100 hover:scale-105 shadow-lg' 
              : 'bg-neutral-800 text-gray-500 cursor-not-allowed'
          }`}
          aria-label={editingMessage ? "Save edit" : "Send message"}
          title={editingMessage ? "Save changes" : "Send message"}
        >
          {editingMessage ? (
            <FaPen className="w-5 h-5 sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
          ) : (
            <FaPaperPlane className="w-5 h-5 sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
          )}
        </button>
      </form>
    </div>
  );
};

export default ChatInput;