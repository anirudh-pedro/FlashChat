import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatHeader from "../components/ChatHeader";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import UsersList from "../components/UsersList";
import TypingIndicator from "../components/TypingIndicator";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { initSocket, getSocket, disconnectSocket, joinRoom, leaveRoom, approveJoin, rejectJoin } from "../socket";
import { formatRoomName, isLocationRoom } from "../utils/roomUtils";

const ChatPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [showUsersList, setShowUsersList] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  const [editingMessage, setEditingMessage] = useState(null); // { id, text }
  const [viewportHeight, setViewportHeight] = useState('100%');
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingUsers, setPendingUsers] = useState([]);
  const [showPendingPanel, setShowPendingPanel] = useState(false);
  
  const params = new URLSearchParams(location.search);
  const username = params.get("username");
  const room = params.get("room");
  const joinMethod = params.get("joinMethod");
  
  // Use refs to avoid re-running effects when these values are used in callbacks
  const usernameRef = useRef(username);
  const roomRef = useRef(room);
  const hasJoinedRef = useRef(false);
  const isInitialConnectionRef = useRef(true); // Track if this is the first connection
  const isMountedRef = useRef(false); // Track if component is actually mounted
  
  useEffect(() => {
    usernameRef.current = username;
    roomRef.current = room;
  }, [username, room]);

  // Handle visual viewport changes (keyboard open/close) - WhatsApp-like behavior
  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        // Use requestAnimationFrame to prevent layout thrashing
        requestAnimationFrame(() => {
          setViewportHeight(`${window.visualViewport.height}px`);
        });
      }
    };

    // Set initial height
    if (window.visualViewport) {
      setViewportHeight(`${window.visualViewport.height}px`);
      window.visualViewport.addEventListener('resize', handleViewportResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleViewportResize);
      }
    };
  }, []);

  useEffect(() => {
    if (!username || !room) {
      navigate("/join");
    }
  }, [username, room, navigate]);

  useEffect(() => {
    if (!username || !room) {
      navigate("/join");
      return;
    }

    // Prevent multiple joins
    if (hasJoinedRef.current) return;

    // Initialize socket connection
    const socketInstance = initSocket();
    setSocket(socketInstance);

    // Wait for connection before joining room
    const handleConnection = () => {
      if (hasJoinedRef.current) return; // Prevent duplicate joins
      
      joinRoom({ username, room }, (error) => {
        if (error) {
          toast.error(error);
          navigate("/join");
        } else {
          hasJoinedRef.current = true;
          isMountedRef.current = true; // Mark as truly mounted after successful join
        }
      });
    };

    if (socketInstance.connected) {
      handleConnection();
    } else {
      socketInstance.once('connect', handleConnection);
    }

    // Cleanup only on actual unmount (not StrictMode re-render)
    return () => {
      socketInstance.off('connect', handleConnection);
    };
  }, []); // Keep empty - only run once on mount

  // Separate cleanup effect that runs on actual page leave
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasJoinedRef.current) {
        leaveRoom();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      
      // Use a small timeout to distinguish between StrictMode remount and actual unmount
      // StrictMode will remount immediately (within ~10ms), real navigation won't
      const cleanupTimeout = setTimeout(() => {
        if (hasJoinedRef.current) {
          leaveRoom();
          hasJoinedRef.current = false;
          isMountedRef.current = false;
          isInitialConnectionRef.current = true;
          disconnectSocket();
        }
      }, 100);
      
      // Store timeout ID so it can be cleared if component remounts (StrictMode)
      window.__flashchatCleanupTimeout = cleanupTimeout;
    };
  }, []);

  // Clear any pending cleanup on mount (handles StrictMode)
  useEffect(() => {
    if (window.__flashchatCleanupTimeout) {
      clearTimeout(window.__flashchatCleanupTimeout);
      window.__flashchatCleanupTimeout = null;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    // Listen for chat history (loaded from Redis on join/refresh)
    const handleChatHistory = (history) => {
      console.log(`📜 Loaded ${history.length} messages from history`);
      setMessages(history);
    };

    // Listen for new messages
    const handleMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    // Listen for room data (users list)
    const handleRoomData = ({ users, pendingUsers: pending }) => {
      setUsers(users);
      if (pending) {
        setPendingUsers(pending);
      }
    };
    
    // Handle admin status update
    const handleAdminStatus = ({ isAdmin: adminStatus }) => {
      setIsAdmin(adminStatus);
      if (adminStatus) {
        toast.success("You are the room admin");
      }
    };
    
    // Handle incoming join request (admin only)
    const handleJoinRequest = ({ socketId, username: requestingUser, room: requestRoom }) => {
      toast.info(`${requestingUser} wants to join the room`, {
        autoClose: false,
        closeOnClick: false,
      });
      setPendingUsers(prev => [...prev, { socketId, username: requestingUser }]);
      setShowPendingPanel(true);
    };
    
    // Handle pending users update
    const handlePendingUsersUpdate = ({ pendingUsers: updated }) => {
      setPendingUsers(updated);
    };

    // Listen for user joined notifications
    const handleUserJoined = (username) => {
      toast.info(`${username} joined the chat`);
    };

    // Listen for user left notifications
    const handleUserLeft = (username) => {
      toast.info(`${username} left the chat`);
    };

    // Listen for typing indicators
    const handleUserTyping = (username) => {
      setTypingUsers((prev) => {
        if (!prev.includes(username)) {
          return [...prev, username];
        }
        return prev;
      });
    };

    const handleUserStoppedTyping = (username) => {
      setTypingUsers((prev) => prev.filter((user) => user !== username));
    };

    // Handle message edited
    const handleMessageEdited = ({ messageId, newText, editedAt }) => {
      setMessages((prevMessages) => 
        prevMessages.map((msg) => 
          msg.id === messageId 
            ? { ...msg, text: newText, isEdited: true, editedAt } 
            : msg
        )
      );
    };

    // Handle message deleted
    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prevMessages) => 
        prevMessages.filter((msg) => msg.id !== messageId)
      );
    };
    
    // Handle reconnection - rejoin room automatically
    const handleReconnect = () => {
      // Skip if this is the initial connection (already handled in first useEffect)
      if (isInitialConnectionRef.current) {
        isInitialConnectionRef.current = false;
        return;
      }
      
      console.log("Socket reconnected, rejoining room...");
      toast.info("Reconnected to chat");
      
      // Use refs to get current values
      joinRoom({ username: usernameRef.current, room: roomRef.current }, (error) => {
        if (error) {
          toast.error("Failed to rejoin room: " + error);
          setTimeout(() => {
            navigate("/join");
          }, 3000);
        }
      });
    };
    
    // Handle disconnection
    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason);
      if (reason === "io server disconnect") {
        toast.warning("Disconnected from server");
      } else if (reason !== "io client disconnect") {
        // Don't show warning for intentional disconnects
        toast.warning("Connection lost, reconnecting...");
      }
    };
    
    socket.on("chatHistory", handleChatHistory);
    socket.on("message", handleMessage);
    socket.on("roomData", handleRoomData);
    socket.on("userJoined", handleUserJoined);
    socket.on("userLeft", handleUserLeft);
    socket.on("userTyping", handleUserTyping);
    socket.on("userStoppedTyping", handleUserStoppedTyping);
    socket.on("messageEdited", handleMessageEdited);
    socket.on("messageDeleted", handleMessageDeleted);
    socket.on("connect", handleReconnect);
    socket.on("disconnect", handleDisconnect);
    socket.on("adminStatus", handleAdminStatus);
    socket.on("joinRequest", handleJoinRequest);
    socket.on("pendingUsersUpdate", handlePendingUsersUpdate);

    return () => {
      socket.off("chatHistory", handleChatHistory);
      socket.off("message", handleMessage);
      socket.off("roomData", handleRoomData);
      socket.off("userJoined", handleUserJoined);
      socket.off("userLeft", handleUserLeft);
      socket.off("userTyping", handleUserTyping);
      socket.off("userStoppedTyping", handleUserStoppedTyping);
      socket.off("messageEdited", handleMessageEdited);
      socket.off("messageDeleted", handleMessageDeleted);
      socket.off("connect", handleReconnect);
      socket.off("disconnect", handleDisconnect);
      socket.off("adminStatus", handleAdminStatus);
      socket.off("joinRequest", handleJoinRequest);
      socket.off("pendingUsersUpdate", handlePendingUsersUpdate);
    };
  }, [socket, navigate]); // Only socket and navigate as dependencies

  const sendMessage = (message) => {
    const socketInstance = getSocket();
    socketInstance.emit("sendMessage", message, (response) => {
      if (response && response.error) {
        toast.error(response.error);
      }
    });
  };

  const sendFile = (fileData) => {
    const socketInstance = getSocket();
    socketInstance.emit("sendFile", fileData, (response) => {
      if (response && response.error) {
        toast.error(response.error);
      }
    });
  };

  // Admin approve join request
  const handleApproveJoin = (pendingSocketId) => {
    approveJoin(pendingSocketId, room, (response) => {
      if (response && response.error) {
        toast.error(response.error);
      } else {
        toast.success("User approved");
      }
    });
  };

  // Admin reject join request
  const handleRejectJoin = (pendingSocketId) => {
    rejectJoin(pendingSocketId, room, null, (response) => {
      if (response && response.error) {
        toast.error(response.error);
      } else {
        toast.info("Join request rejected");
      }
    });
  };

  const editMessage = (messageId, newText) => {
    const socketInstance = getSocket();
    socketInstance.emit("editMessage", { messageId, newText }, (response) => {
      if (response && response.error) {
        toast.error(response.error);
      }
    });
  };

  const deleteMessage = (messageId) => {
    const socketInstance = getSocket();
    socketInstance.emit("deleteMessage", messageId, (response) => {
      if (response && response.error) {
        toast.error(response.error);
      }
    });
  };

  // Start editing a message - copies text to input box
  const startEdit = (messageId, text) => {
    setEditingMessage({ id: messageId, text });
  };

  // Cancel editing
  const cancelEdit = () => {
    setEditingMessage(null);
  };

  // Handle sending message (new or edited)
  const handleSendMessage = (message) => {
    if (editingMessage) {
      // We're editing an existing message
      editMessage(editingMessage.id, message);
      setEditingMessage(null);
    } else {
      // Send new message
      sendMessage(message);
    }
  };

  const toggleUsersList = () => {
    setShowUsersList(!showUsersList);
  };

  const leaveCurrentRoom = () => {
    leaveRoom();
    navigate("/join");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(room);
    toast.success("Room ID copied to clipboard!");
  };

  const formattedRoomName = formatRoomName(room);
  const isLocationBased = isLocationRoom(room);

  return (
    <div 
      className="flex flex-col w-full overflow-hidden bg-neutral-950"
      style={{ height: viewportHeight }}
    >
      <ToastContainer 
        position="top-right" 
        autoClose={3000}
        hideProgressBar={true}
        newestOnTop={true}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark"
        toastClassName="!bg-neutral-900 !text-white !border !border-neutral-800"
      />
      
      <ChatHeader 
        room={formattedRoomName} 
        userCount={users.length}
        joinMethod={joinMethod}
        onToggleUsers={toggleUsersList}
        onLeaveRoom={leaveCurrentRoom}
        onCopyRoomId={copyRoomId}
        isLocationBased={isLocationBased}
        isAdmin={isAdmin}
        pendingCount={pendingUsers.length}
        onTogglePending={() => setShowPendingPanel(!showPendingPanel)}
      />
      
      {/* Pending Users Panel (Admin only) */}
      {isAdmin && showPendingPanel && pendingUsers.length > 0 && (
        <div className="bg-neutral-900 border-b border-neutral-800 px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-white font-medium text-sm">
              Pending Join Requests ({pendingUsers.length})
            </h3>
            <button 
              onClick={() => setShowPendingPanel(false)}
              className="text-neutral-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {pendingUsers.map((pending) => (
              <div 
                key={pending.socketId} 
                className="flex items-center justify-between bg-neutral-800 rounded-lg px-3 py-2"
              >
                <span className="text-white text-sm">{pending.username}</span>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleApproveJoin(pending.socketId)}
                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs rounded-md transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleRejectJoin(pending.socketId)}
                    className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white text-xs rounded-md transition-colors"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Main chat area */}
        <div className={`flex-1 flex flex-col min-h-0 min-w-0 ${showUsersList ? 'hidden sm:flex' : 'flex'}`}>
          <MessageList 
            messages={messages} 
            currentUser={username}
            onStartEdit={startEdit}
            onDeleteMessage={deleteMessage}
          />
          
          <TypingIndicator typingUsers={typingUsers} />
          
          <ChatInput 
            onSendMessage={handleSendMessage}
            onSendFile={sendFile}
            editingMessage={editingMessage}
            onCancelEdit={cancelEdit}
          />
        </div>
        
        {/* Users sidebar */}
        {showUsersList && (
          <div className="absolute sm:relative w-full sm:w-auto right-0 top-0 h-full z-20">
            <UsersList 
              users={users} 
              currentUser={username} 
              onClose={toggleUsersList} 
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;