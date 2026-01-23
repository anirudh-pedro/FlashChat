import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatHeader from "../components/ChatHeader";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import UsersList from "../components/UsersList";
import TypingIndicator from "../components/TypingIndicator";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { initSocket, getSocket, disconnectSocket, joinRoom, leaveRoom, approveJoin, rejectJoin, cancelJoinRequest, kickUser, setIntentionalLeave } from "../socket";
import { formatRoomName, isLocationRoom } from "../utils/roomUtils";
import { FaSpinner, FaTimes } from "react-icons/fa";

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
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  
  const params = new URLSearchParams(location.search);
  const username = params.get("username");
  const room = params.get("room");
  const joinMethod = params.get("joinMethod");
  const requireAdmin = params.get("requireAdmin") === "true";
  
  const usernameRef = useRef(username);
  const roomRef = useRef(room);
  const hasJoinedRef = useRef(false);
  const isInitialConnectionRef = useRef(true); 
  const isMountedRef = useRef(false); 
  
  useEffect(() => {
    usernameRef.current = username;
    roomRef.current = room;
  }, [username, room]);

  useEffect(() => {
    const handleViewportResize = () => {
      if (window.visualViewport) {
        requestAnimationFrame(() => {
          setViewportHeight(`${window.visualViewport.height}px`);
        });
      }
    };

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

    if (hasJoinedRef.current) return;

    const socketInstance = initSocket();
    setSocket(socketInstance);

    const handleConnection = () => {
      if (hasJoinedRef.current) return; 
      
      joinRoom({ username, room, requireAdmin }, (response) => {
        if (response && response.error) {
          toast.error(response.error);
          navigate("/join");
        } else if (response && response.pending) {
          // Waiting for admin approval
          setIsPendingApproval(true);
          toast.info("Waiting for admin approval...");
        } else {
          hasJoinedRef.current = true;
          isMountedRef.current = true; 
          if (response && response.adminToken && room) {
            localStorage.setItem(`adminToken_${room}`, response.adminToken);
          }
        }
      });
    };

    if (socketInstance.connected) {
      handleConnection();
    } else {
      socketInstance.once('connect', handleConnection);
    }

    return () => {
      socketInstance.off('connect', handleConnection);
    };
  }, []); 

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (hasJoinedRef.current) {
        setIntentionalLeave(true);
        leaveRoom();
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
       
        console.log('App went to background - staying in room');
      } else if (document.visibilityState === 'visible') {
        console.log('App became visible - checking connection');
        const socketInstance = getSocket();
        if (socketInstance && !socketInstance.connected) {
          console.log('Socket disconnected while in background, reconnecting...');
          socketInstance.connect();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      
     
      const cleanupTimeout = setTimeout(() => {
        if (hasJoinedRef.current) {
          setIntentionalLeave(true);
          leaveRoom();
          hasJoinedRef.current = false;
          isMountedRef.current = false;
          isInitialConnectionRef.current = true;
          disconnectSocket();
        }
      }, 100);
      
      window.__flashchatCleanupTimeout = cleanupTimeout;
    };
  }, []);

  useEffect(() => {
    if (window.__flashchatCleanupTimeout) {
      clearTimeout(window.__flashchatCleanupTimeout);
      window.__flashchatCleanupTimeout = null;
    }
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleChatHistory = (history) => {
      console.log(`📜 Loaded ${history.length} messages from history`);
      setMessages(history);
    };

    const handleMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    const handleRoomData = ({ users, pendingUsers: pending }) => {
      setUsers(users);
      if (pending) {
        setPendingUsers(pending);
      }
    };
    
    const handleAdminStatus = ({ isAdmin: adminStatus, adminToken }) => {
      setIsAdmin(adminStatus);
      
      const isNearbyRoom = room && room.startsWith('LOC_');
      if (adminStatus && !isNearbyRoom && requireAdmin) {
        toast.success("You are the room admin");
      }
      if (adminStatus && adminToken && room) {
        localStorage.setItem(`adminToken_${room}`, adminToken);
      }
    };
    
    const handleJoinRequest = ({ socketId, username: requestingUser, room: requestRoom }) => {
      toast.info(`${requestingUser} wants to join the room`, {
        autoClose: false,
        closeOnClick: false,
      });
      setPendingUsers(prev => [...prev, { socketId, username: requestingUser }]);
      setShowPendingPanel(true);
    };
    
    const handlePendingUsersUpdate = ({ pendingUsers: updated }) => {
      setPendingUsers(updated);
    };
    
    const handleJoinApproved = ({ room: approvedRoom }) => {
      setIsPendingApproval(false);
      hasJoinedRef.current = true;
      isMountedRef.current = true;
      toast.success("Your join request was approved!");
    };
    
    const handleJoinRejected = ({ reason }) => {
      setIsPendingApproval(false);
      toast.error(reason || "Your join request was rejected");
      setTimeout(() => navigate("/join"), 2000);
    };
    
    const handleKicked = ({ reason }) => {
      toast.error(reason || "You have been removed from the room");
      hasJoinedRef.current = false;
      setTimeout(() => navigate("/join"), 2000);
    };

    const handleUserJoined = (username) => {
      toast.info(`${username} joined the chat`);
    };

    const handleUserLeft = (username) => {
      toast.info(`${username} left the chat`);
    };

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

    const handleMessageEdited = ({ messageId, newText, editedAt }) => {
      setMessages((prevMessages) => 
        prevMessages.map((msg) => 
          msg.id === messageId 
            ? { ...msg, text: newText, isEdited: true, editedAt } 
            : msg
        )
      );
    };

    const handleMessageDeleted = ({ messageId }) => {
      setMessages((prevMessages) => 
        prevMessages.filter((msg) => msg.id !== messageId)
      );
    };
    
    const handleReconnect = () => {
      if (isInitialConnectionRef.current) {
        isInitialConnectionRef.current = false;
        return;
      }
      
      console.log("Socket reconnected, rejoining room...");
      toast.info("Reconnected to chat");
      
      joinRoom({ username: usernameRef.current, room: roomRef.current }, (response) => {
        if (response && response.error) {
          toast.error("Failed to rejoin room: " + response.error);
          setTimeout(() => {
            navigate("/join");
          }, 3000);
        }
      });
    };
    
    const handleDisconnect = (reason) => {
      console.log("Socket disconnected:", reason);
      if (reason === "io server disconnect") {
        toast.warning("Disconnected from server");
      } else if (reason !== "io client disconnect") {
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
    socket.on("joinApproved", handleJoinApproved);
    socket.on("joinRejected", handleJoinRejected);
    socket.on("kicked", handleKicked);

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
      socket.off("joinApproved", handleJoinApproved);
      socket.off("joinRejected", handleJoinRejected);
      socket.off("kicked", handleKicked);
    };
  }, [socket, navigate]); 

  const handleCancelPending = () => {
    cancelJoinRequest(room, () => {});
    navigate("/join");
  };

  const sendMessage = (message) => {
    const socketInstance = getSocket();
    socketInstance.emit("sendMessage", message, (response) => {
      if (response && response.error) {
        toast.error(response.error);
      }
    });
  };

  const sendFile = (fileData) => {
    return new Promise((resolve) => {
      const socketInstance = getSocket();
      
      const timeout = setTimeout(() => {
        console.error('File upload timeout - no response from server');
        toast.error('File upload timed out. Please try again.');
        resolve({ error: 'Upload timed out' });
      }, 30000); 
      
      socketInstance.emit("sendFile", fileData, (response) => {
        clearTimeout(timeout); 
        if (response && response.error) {
          toast.error(response.error);
          resolve({ error: response.error });
        } else {
          resolve({ success: true });
        }
      });
    });
  };

  const handleApproveJoin = (pendingSocketId) => {
    approveJoin(pendingSocketId, room, (response) => {
      if (response && response.error) {
        toast.error(response.error);
      } else {
        toast.success("User approved");
      }
    });
  };

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

  const startEdit = (messageId, text) => {
    setEditingMessage({ id: messageId, text });
  };

  const cancelEdit = () => {
    setEditingMessage(null);
  };

  const handleSendMessage = (message) => {
    if (editingMessage) {
      editMessage(editingMessage.id, message);
      setEditingMessage(null);
    } else {
      sendMessage(message);
    }
  };

  const toggleUsersList = () => {
    setShowUsersList(!showUsersList);
  };

  const leaveCurrentRoom = () => {
    setIntentionalLeave(true);
    leaveRoom();
    navigate("/join");
  };

  const copyRoomId = () => {
    navigator.clipboard.writeText(room);
    toast.success("Room ID copied to clipboard!");
  };

  const formattedRoomName = formatRoomName(room);
  const isLocationBased = isLocationRoom(room);

  if (isPendingApproval) {
    return (
      <div 
        className="flex flex-col items-center justify-center w-full bg-neutral-950"
        style={{ height: viewportHeight }}
      >
        <div className="w-full max-w-[360px] p-4 text-center">
          <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-xl p-8">
            <div className="mb-6">
              <FaSpinner className="text-4xl text-neutral-300 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-neutral-100 mb-2">Waiting for Approval</h2>
              <p className="text-neutral-400 text-sm">
                Requesting to join room <span className="text-neutral-200 font-mono">{room}</span>
              </p>
            </div>
            
            <p className="text-neutral-500 text-xs mb-6">
              The room admin will decide whether to let you in. Please wait...
            </p>
            
            <button
              onClick={handleCancelPending}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors text-sm cursor-pointer"
            >
              <FaTimes className="text-xs" />
              Cancel Request
            </button>
          </div>
        </div>
      </div>
    );
  }

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
        
        {showUsersList && (
          <div className="absolute sm:relative w-full sm:w-auto right-0 top-0 h-full z-20">
            <UsersList 
              users={users} 
              currentUser={username} 
              onClose={toggleUsersList}
              isAdmin={isAdmin}
              onKickUser={(targetSocketId) => {
                kickUser(targetSocketId, room, (response) => {
                  if (response && response.error) {
                    toast.error(response.error);
                  } else {
                    toast.success("User removed from room");
                  }
                });
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatPage;