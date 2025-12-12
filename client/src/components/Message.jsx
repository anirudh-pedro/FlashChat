import React, { useState } from "react";
import { FaFileAlt, FaFilePdf, FaFileWord, FaDownload, FaTimes } from "react-icons/fa";

const Message = ({ message, isOwnMessage }) => {
  const { user, text, createdAt, type, fileName, fileType, fileSize, fileData, isImage } = message;
  const [showImageModal, setShowImageModal] = useState(false);
  
  // Format time from timestamp
  const formatTime = (timestamp) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Format file size
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Get file icon based on type
  const getFileIcon = () => {
    if (fileType?.includes('pdf')) return <FaFilePdf className="text-red-400" size={24} />;
    if (fileType?.includes('word') || fileType?.includes('document')) return <FaFileWord className="text-blue-400" size={24} />;
    return <FaFileAlt className="text-gray-400" size={24} />;
  };

  // Handle file download
  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = fileData;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper function to add more padding around single emoji messages
  const isSingleEmoji = (text) => {
    if (!text) return false;
    // Check if the message is just a single emoji (or very few)
    const emojiRegex = /^(?:[\u2700-\u27bf]|(?:\ud83c[\udde6-\uddff]){2}|[\ud800-\udbff][\udc00-\udfff]|[\u0023-\u0039]\ufe0f?\u20e3|\u3299|\u3297|\u303d|\u3030|\u24c2|\ud83c[\udd70-\udd71]|\ud83c[\udd7e-\udd7f]|\ud83c\udd8e|\ud83c[\udd91-\udd9a]|\ud83c[\udde6-\uddff]|\ud83c[\ude01-\ude02]|\ud83c\ude1a|\ud83c\ude2f|\ud83c[\ude32-\ude3a]|\ud83c[\ude50-\ude51]|\u203c|\u2049|[\u25aa-\u25ab]|\u25b6|\u25c0|[\u25fb-\u25fe]|\u00a9|\u00ae|\u2122|\u2139|\ud83c\udc04|[\u2600-\u26FF]|\u2b05|\u2b06|\u2b07|\u2b1b|\u2b1c|\u2b50|\u2b55|\u231a|\u231b|\u2328|\u23cf|[\u23e9-\u23f3]|[\u23f8-\u23fa]|\ud83c\udccf|\u2934|\u2935|[\u2190-\u21ff]){1,3}$/;
    return emojiRegex.test(text);
  };

  // Render file/image content
  const renderFileContent = () => {
    if (isImage) {
      return (
        <>
          <div 
            className="cursor-pointer rounded-lg overflow-hidden"
            onClick={() => setShowImageModal(true)}
          >
            <img 
              src={fileData} 
              alt={fileName}
              className="max-w-full max-h-64 object-contain rounded-lg hover:opacity-90 transition-opacity"
            />
          </div>
          <div className="text-xs text-gray-500 mt-1 truncate">{fileName}</div>
        </>
      );
    }

    // Non-image file
    return (
      <div 
        className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer hover:opacity-80 transition-opacity ${
          isOwnMessage ? 'bg-neutral-100' : 'bg-neutral-800'
        }`}
        onClick={handleDownload}
      >
        {getFileIcon()}
        <div className="flex-1 min-w-0">
          <div className={`text-sm font-medium truncate ${isOwnMessage ? 'text-neutral-900' : 'text-white'}`}>
            {fileName}
          </div>
          <div className={`text-xs ${isOwnMessage ? 'text-neutral-500' : 'text-gray-400'}`}>
            {formatFileSize(fileSize)}
          </div>
        </div>
        <FaDownload className={`flex-shrink-0 ${isOwnMessage ? 'text-neutral-600' : 'text-gray-400'}`} size={16} />
      </div>
    );
  };

  // Image modal for fullscreen view
  const ImageModal = () => {
    if (!showImageModal || !isImage) return null;
    
    return (
      <div 
        className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4"
        onClick={() => setShowImageModal(false)}
      >
        <button 
          className="absolute top-4 right-4 p-2 text-white hover:bg-white/20 rounded-full transition-colors"
          onClick={() => setShowImageModal(false)}
        >
          <FaTimes size={24} />
        </button>
        <button 
          className="absolute bottom-4 right-4 p-3 bg-white text-black rounded-full hover:bg-gray-200 transition-colors flex items-center gap-2"
          onClick={(e) => {
            e.stopPropagation();
            handleDownload();
          }}
        >
          <FaDownload size={16} />
          <span className="text-sm font-medium">Download</span>
        </button>
        <img 
          src={fileData} 
          alt={fileName}
          className="max-w-full max-h-full object-contain"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    );
  };

  return (
    <>
      <ImageModal />
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
            } ${type !== 'file' && isSingleEmoji(text) ? 'px-5 py-3' : ''}`}
          >
            {type === 'file' ? (
              renderFileContent()
            ) : (
              <div className={`break-words message-text ${
                isSingleEmoji(text) ? 'text-3xl md:text-4xl' : 'text-sm md:text-base leading-relaxed'
              }`}>
                {text}
              </div>
            )}
            
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
    </>
  );
};

export default Message;