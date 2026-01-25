import React, { useState, useRef, useEffect } from "react";
import { FaFileAlt, FaFilePdf, FaFileWord, FaDownload, FaTimes, FaEdit, FaTrash, FaEllipsisV, FaCopy, FaRedoAlt } from "react-icons/fa";

const Message = ({ message, isOwnMessage, onEditMessage, onDeleteMessage, onStartEdit, onRetryUpload, showUsername = true }) => {
  const { id, user, text, createdAt, type, fileName, fileType, fileSize, fileData, isImage, isEdited, status, tempId } = message;
  const [showImageModal, setShowImageModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [copied, setCopied] = useState(false);
  const longPressTimer = useRef(null);
  const isLongPress = useRef(false);
  const menuRef = useRef(null);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showMenu && menuRef.current && !menuRef.current.contains(event.target)) {
        setShowMenu(false);
      }
    };

    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showMenu]);
  
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

  // Handle edit - copy text to input box
  const handleEdit = () => {
    if (onStartEdit) {
      onStartEdit(id, text);
    }
    setShowMenu(false);
  };

  // Handle delete confirmation
  const handleDeleteClick = () => {
    setShowMenu(false);
    setShowDeleteConfirm(true);
  };

  // Confirm delete
  const confirmDelete = () => {
    if (onDeleteMessage) {
      onDeleteMessage(id);
    }
    setShowDeleteConfirm(false);
  };

  // Cancel delete
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  // Long press handlers for mobile - works on all messages for copy, own messages for edit/delete
  const handleTouchStart = () => {
    if (type === 'file' || user === 'System') return;
    
    isLongPress.current = false;
    longPressTimer.current = setTimeout(() => {
      isLongPress.current = true;
      setShowMobileMenu(true);
    }, 500); // 500ms long press
  };

  const handleTouchEnd = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Mobile menu handlers
  const handleMobileEdit = () => {
    setShowMobileMenu(false);
    if (onStartEdit) {
      onStartEdit(id, text);
    }
  };

  const handleMobileDelete = () => {
    setShowMobileMenu(false);
    setShowDeleteConfirm(true);
  };

  // Copy message handler
  const handleCopy = async () => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setShowMobileMenu(false);
      setShowMenu(false);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
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
    const isUploading = status === 'uploading';
    const isFailed = status === 'failed';
    const isExpired = !fileData || fileData === 'null'; // No file data available
    
    if (isImage) {
      return (
        <div className="relative">
          {isExpired ? (
            // Show expired image placeholder
            <div className="w-64 h-40 bg-neutral-800 rounded-lg flex flex-col items-center justify-center gap-2 border border-neutral-700">
              <div className="w-16 h-16 bg-neutral-700 rounded-full flex items-center justify-center">
                <svg className="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <div className="text-center px-4">
                <div className={`text-sm font-medium mb-1 ${isOwnMessage ? 'text-neutral-300' : 'text-neutral-400'}`}>
                  Image expired
                </div>
                <div className={`text-xs ${isOwnMessage ? 'text-neutral-500' : 'text-neutral-600'}`}>
                  Files are temporary and expire after page refresh
                </div>
              </div>
              <div className="text-xs text-neutral-600 truncate max-w-[240px] px-2">{fileName}</div>
            </div>
          ) : (
            <div 
              className="cursor-pointer rounded-lg overflow-hidden relative"
              onClick={() => !isUploading && !isFailed && setShowImageModal(true)}
            >
              <img 
                src={fileData} 
                alt={fileName}
                className={`max-w-full max-h-64 object-contain rounded-lg transition-opacity ${
                  isUploading ? 'opacity-50' : isFailed ? 'opacity-30' : 'hover:opacity-90'
                }`}
              />
              
              {/* Loading overlay */}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-2">
                    <div className="w-10 h-10 border-3 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-white text-xs font-medium">Sending...</span>
                  </div>
                </div>
              )}
              
              {/* Failed overlay with retry */}
              {isFailed && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 backdrop-blur-[1px]">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center">
                      <FaTimes className="text-red-400" size={24} />
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (onRetryUpload) {
                          onRetryUpload(tempId || id, {
                            fileName,
                            fileType,
                            fileSize,
                            fileData,
                            isImage
                          });
                        }
                      }}
                      className="px-4 py-2 bg-white text-neutral-900 rounded-lg hover:bg-gray-100 transition-colors flex items-center gap-2 font-medium text-sm shadow-lg"
                    >
                      <FaRedoAlt size={12} />
                      Retry
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
          {!isExpired && <div className="text-xs text-gray-500 mt-1 truncate">{fileName}</div>}
        </div>
      );
    }

    // Non-image file
    return (
      <div className="relative">
        {isExpired ? (
          // Show expired file placeholder
          <div 
            className={`flex items-center gap-3 p-3 rounded-lg ${
              isOwnMessage ? 'bg-neutral-100' : 'bg-neutral-800'
            }`}
          >
            {getFileIcon()}
            <div className="flex-1 min-w-0">
              <div className={`text-sm font-medium truncate ${isOwnMessage ? 'text-neutral-900' : 'text-white'}`}>
                {fileName}
              </div>
              <div className={`text-xs ${isOwnMessage ? 'text-neutral-500' : 'text-gray-400'}`}>
                File expired - not available after refresh
              </div>
            </div>
            <div className={`flex-shrink-0 ${isOwnMessage ? 'text-neutral-400' : 'text-gray-600'}`}>
              <FaTimes size={16} />
            </div>
          </div>
        ) : (
          <>
            <div 
              className={`flex items-center gap-3 p-3 rounded-lg transition-opacity relative ${
                isOwnMessage ? 'bg-neutral-100' : 'bg-neutral-800'
              } ${
                isUploading ? 'opacity-50' : isFailed ? 'opacity-30 cursor-default' : 'cursor-pointer hover:opacity-80'
              }`}
              onClick={() => !isUploading && !isFailed && handleDownload()}
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
              {!isUploading && !isFailed && (
                <FaDownload className={`flex-shrink-0 ${isOwnMessage ? 'text-neutral-600' : 'text-gray-400'}`} size={16} />
              )}
              
              {/* Loading overlay for files */}
              {isUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-[1px] rounded-lg">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span className="text-white text-xs font-medium">Sending...</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Failed state for files - retry button below */}
            {isFailed && (
              <div className="mt-2 flex items-center justify-center">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onRetryUpload) {
                      onRetryUpload(tempId || id, {
                        fileName,
                        fileType,
                        fileSize,
                        fileData,
                        isImage
                      });
                    }
                  }}
                  className="px-4 py-2 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors flex items-center gap-2 font-medium text-sm border border-red-500/30"
                >
                  <FaRedoAlt size={12} />
                  Tap to retry
                </button>
              </div>
            )}
          </>
        )}
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

  // Delete confirmation modal
  const DeleteConfirmModal = () => {
    if (!showDeleteConfirm) return null;
    
    return (
      <div 
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        onClick={cancelDelete}
      >
        <div 
          className="bg-neutral-900 rounded-2xl p-6 max-w-sm w-full border border-neutral-800 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="text-center">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <FaTrash className="text-red-500" size={20} />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Delete Message?</h3>
            <p className="text-gray-400 text-sm mb-6">This action cannot be undone. The message will be permanently deleted.</p>
            <div className="flex gap-3">
              <button
                onClick={cancelDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-neutral-800 text-white hover:bg-neutral-700 transition-colors font-medium"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white hover:bg-red-700 transition-colors font-medium"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Mobile action sheet (WhatsApp-style bottom sheet) - available for all messages (copy), own messages (edit/delete)
  const MobileActionSheet = () => {
    if (!showMobileMenu || type === 'file' || user === 'System') return null;
    
    return (
      <div 
        className="fixed inset-0 bg-black/50 z-50 flex items-end justify-center md:hidden"
        onClick={() => setShowMobileMenu(false)}
      >
        <div 
          className="bg-neutral-900 rounded-t-2xl w-full max-w-lg border-t border-neutral-800 shadow-2xl animate-slide-up"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-12 h-1 bg-neutral-700 rounded-full mx-auto mt-3 mb-2"></div>
          <div className="p-2 pb-6">
            <button
              onClick={handleCopy}
              className="w-full px-4 py-3.5 text-left text-base text-white hover:bg-neutral-800 rounded-xl flex items-center gap-3 transition-colors"
            >
              <FaCopy size={18} className="text-gray-400" /> {copied ? 'Copied!' : 'Copy message'}
            </button>
            {isOwnMessage && (
              <>
                <button
                  onClick={handleMobileEdit}
                  className="w-full px-4 py-3.5 text-left text-base text-white hover:bg-neutral-800 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <FaEdit size={18} className="text-gray-400" /> Edit message
                </button>
                <button
                  onClick={handleMobileDelete}
                  className="w-full px-4 py-3.5 text-left text-base text-red-400 hover:bg-neutral-800 rounded-xl flex items-center gap-3 transition-colors"
                >
                  <FaTrash size={18} /> Delete message
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <>
      <ImageModal />
      <DeleteConfirmModal />
      <MobileActionSheet />
      <div 
        className={`flex items-end ${isOwnMessage ? 'justify-end pr-2 sm:pr-3' : 'justify-start pl-2 sm:pl-3'} group`}
      >
        <div className="flex flex-col max-w-[80%] sm:max-w-[70%] md:max-w-[65%] relative">
          {!isOwnMessage && showUsername && user !== 'System' && (
            <div className="font-medium text-xs text-gray-400 mb-1 ml-1">{user}</div>
          )}
          
          {/* Message actions menu for own messages - DESKTOP ONLY (hidden on mobile) */}
          {isOwnMessage && type !== 'file' && user !== 'System' && id && onStartEdit && onDeleteMessage && (
            <div 
              ref={menuRef}
              className={`hidden md:block absolute -left-10 top-1/2 -translate-y-1/2 transition-opacity z-10 ${showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
            >
              <div className="relative">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowMenu(!showMenu);
                  }}
                  className="p-1.5 rounded-full hover:bg-neutral-800 text-gray-400 hover:text-white transition-colors cursor-pointer"
                >
                  <FaEllipsisV size={12} />
                </button>
                
                {showMenu && (
                  <div className="absolute right-full mr-2 top-1/2 -translate-y-1/2 bg-neutral-800 rounded-lg shadow-xl border border-neutral-700 py-1 min-w-[100px] z-50">
                    <button
                      onClick={handleCopy}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-neutral-700 flex items-center gap-2 cursor-pointer"
                    >
                      <FaCopy size={12} /> {copied ? 'Copied!' : 'Copy'}
                    </button>
                    <button
                      onClick={handleEdit}
                      className="w-full px-3 py-2 text-left text-sm text-white hover:bg-neutral-700 flex items-center gap-2 cursor-pointer"
                    >
                      <FaEdit size={12} /> Edit
                    </button>
                    <button
                      onClick={handleDeleteClick}
                      className="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-neutral-700 flex items-center gap-2 cursor-pointer"
                    >
                      <FaTrash size={12} /> Delete
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
          
          <div 
            className={`rounded-2xl px-4 py-2.5 ${
              isOwnMessage 
                ? 'bg-neutral-800 text-gray-100 rounded-br-md shadow-lg' 
                : 'bg-neutral-900 text-gray-100 border border-neutral-800 rounded-bl-md'
            } ${type !== 'file' && isSingleEmoji(text) ? 'px-5 py-3' : ''} select-none ${type !== 'file' && user !== 'System' ? 'md:cursor-pointer' : ''}`}
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
            onDoubleClick={() => {
              if (type !== 'file' && user !== 'System' && text) {
                handleCopy();
              }
            }}
            title={type !== 'file' && user !== 'System' ? 'Double-click to copy' : undefined}
          >
            {type === 'file' ? (
              renderFileContent()
            ) : (
              <div className={`break-words message-text whitespace-pre-wrap ${
                isSingleEmoji(text) ? 'text-3xl md:text-4xl' : 'text-sm md:text-base leading-relaxed'
              }`}>
                {text}
              </div>
            )}
            
            <div 
              className={`text-[10px] mt-1 flex items-center gap-1 ${
                isOwnMessage ? 'text-gray-400 justify-end' : 'text-gray-500'
              }`}
            >
              {isEdited && <span className="italic">(edited)</span>}
              {formatTime(createdAt)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default Message;