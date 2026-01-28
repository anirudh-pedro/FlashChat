import React, { useState, useRef, useEffect } from "react";
import { FaPaperPlane, FaSmile, FaTimes, FaPaperclip, FaPen } from "react-icons/fa";
import EmojiPicker from "emoji-picker-react";
import { getSocket } from "../socket";

const ChatInput = ({ onSendMessage, onSendFile, editingMessage, onCancelEdit, onLocalFilePreview }) => {
  const [message, setMessage] = useState("");
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const emojiPickerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const textareaRef = useRef(null);
  const fileInputRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const MAX_MESSAGE_LENGTH = 1000;
  const MAX_FILE_SIZE = 5 * 1024 * 1024;

  useEffect(() => {
    if (editingMessage) {
      setMessage(editingMessage.text);
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [editingMessage]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollHeight = textareaRef.current.scrollHeight;
      const maxHeight = 120;
      
      if (scrollHeight > maxHeight) {
        textareaRef.current.style.height = maxHeight + 'px';
        textareaRef.current.style.overflowY = 'auto';
      } else {
        textareaRef.current.style.height = scrollHeight + 'px';
        textareaRef.current.style.overflowY = 'hidden';
      }
    }
  }, [message]);
  
  useEffect(() => {
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
    
    if (trimmedMessage.length > 1000) {
      alert("Message is too long. Maximum 1000 characters allowed.");
      return;
    }

    const socket = getSocket();
    if (socket && isTypingRef.current) {
      socket.emit("stopTyping");
      isTypingRef.current = false;
    }
    
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    
    onSendMessage(trimmedMessage);
    setMessage("");
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.focus();
    }
  };

  const handleCancelEdit = () => {
    setMessage("");
    onCancelEdit?.();
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
    if (e.key === 'Escape' && editingMessage) {
      e.preventDefault();
      handleCancelEdit();
    }
  };

  const handleMessageChange = (e) => {
    const newMessage = e.target.value;
    setMessage(newMessage);

    const socket = getSocket();
    if (!socket) return;

    if (newMessage.trim() && !isTypingRef.current) {
      socket.emit("typing");
      isTypingRef.current = true;
    }

    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    if (newMessage.trim()) {
      typingTimeoutRef.current = setTimeout(() => {
        if (isTypingRef.current) {
          socket.emit("stopTyping");
          isTypingRef.current = false;
        }
      }, 2000);
    } else {
      if (isTypingRef.current) {
        socket.emit("stopTyping");
        isTypingRef.current = false;
      }
    }
  };

  const handleEmojiClick = (emojiObject) => {
    setMessage(prevMessage => prevMessage + emojiObject.emoji);
    setTimeout(() => textareaRef.current?.focus(), 100);
  };

  const handleFileSelect = async (e, directFile) => {
    const file = directFile || e.target.files?.[0];
    if (!file) return;

    if (file.size > MAX_FILE_SIZE) {
      alert('File too large. Maximum size is 5MB.');
      return;
    }

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

    try {
      const base64Data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = (error) => {
          console.error('FileReader error:', error);
          reject(error);
        };
        reader.readAsDataURL(file);
      });

      const tempId = `temp_${Date.now()}_${Math.random()}`;
      
      // Show file immediately in chat with loading state
      const filePreview = {
        id: tempId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: base64Data,
        isImage: file.type.startsWith('image/'),
        status: 'uploading'
      };
      
      if (onLocalFilePreview) {
        onLocalFilePreview(filePreview);
      }

      const socket = getSocket();
      
      const waitForConnectionAndRoom = async (maxWait = 25000) => {
        const startTime = Date.now();
        console.log('⏳ Waiting for connection and room...');
        
        // First wait for socket connection
        while (Date.now() - startTime < maxWait) {
          const currentSocket = getSocket();
          if (currentSocket && currentSocket.connected) {
            console.log('✅ Socket connected');
            break;
          }
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        const currentSocket = getSocket();
        if (!currentSocket || !currentSocket.connected) {
          console.error('❌ Socket connection timeout');
          return false;
        }
        

        console.log('⏳ Waiting for room rejoin to complete...');
        await new Promise(resolve => setTimeout(resolve, 4000));
        
        console.log('✅ Ready to upload');
        return true;
      };
      
      if (!socket || !socket.connected) {
        console.log('🔌 Socket disconnected (camera opened), waiting for reconnection...');
        const ready = await waitForConnectionAndRoom(25000);
        
        if (!ready) {
          console.error('❌ Connection/room timeout after camera');
          if (onLocalFilePreview) {
            onLocalFilePreview({ 
              id: tempId, 
              fileName: file.name,
              fileType: file.type,
              fileSize: file.size,
              fileData: base64Data,
              isImage: file.type.startsWith('image/'),
              status: 'failed' 
            });
          }
          if (fileInputRef.current) {
            fileInputRef.current.value = '';
          }
          alert('Connection timeout. Please tap retry to upload.');
          return;
        }
        console.log('✅ Reconnected and rejoined room successfully');
      }

      console.log('📤 Uploading file...');
      const result = await onSendFile({
        tempId,
        fileName: file.name,
        fileType: file.type,
        fileSize: file.size,
        fileData: base64Data
      }).catch(err => {
        console.error('Upload error:', err);
        return { error: err.message || 'Upload failed' };
      });
      
      if (result && result.error) {
        console.error('❌ Upload failed:', result.error);
        if (onLocalFilePreview) {
          onLocalFilePreview({ 
            id: tempId,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            fileData: base64Data,
            isImage: file.type.startsWith('image/'),
            status: 'failed' 
          });
        }
      } else {
        console.log('✅ Upload successful');
      }
    } catch (error) {
      console.error('Error in file upload process:', error);
      alert('Failed to process file. Please try again.');
    } finally {
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

        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          accept=".pdf,.txt,.doc,.docx,.jpg,.jpeg,.png,.gif,.webp"
          className="hidden"
        />
        
        <button 
          type="button"
          onClick={async () => {
            // Try File System Access API first to avoid camera option
            if (window.showOpenFilePicker) {
              try {
                const [handle] = await window.showOpenFilePicker({
                  multiple: false,
                  types: [
                    {
                      description: 'Images and documents',
                      accept: {
                        'image/*': ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
                        'application/pdf': ['.pdf'],
                        'text/plain': ['.txt'],
                        'application/msword': ['.doc'],
                        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx']
                      }
                    }
                  ],
                  excludeAcceptAllOption: false
                });
                const file = await handle.getFile();
                await handleFileSelect(null, file);
                return;
              } catch (err) {
                // If user cancels or API fails, fallback to input
                console.warn('File picker fallback:', err);
              }
            }
            fileInputRef.current?.click();
          }}
          className="p-1.5 sm:p-2 md:p-2.5 rounded-lg sm:rounded-xl transition-colors flex-shrink-0 cursor-pointer flex items-center justify-center text-gray-300 hover:bg-neutral-800"
          aria-label="Attach file"
          title="Attach file or image"
        >
          <FaPaperclip className="w-5 h-5 sm:w-[18px] sm:h-[18px] md:w-5 md:h-5" />
        </button>

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