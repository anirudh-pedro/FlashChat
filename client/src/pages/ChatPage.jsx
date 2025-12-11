import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatHeader from "../components/ChatHeader";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import UsersList from "../components/UsersList";
import TypingIndicator from "../components/TypingIndicator";
import { toast, ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { initSocket, getSocket, disconnectSocket, joinRoom, leaveRoom } from "../socket";
import { formatRoomName, isLocationRoom } from "../utils/roomUtils";

const ChatPage = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);
  const [users, setUsers] = useState([]);
  const [socket, setSocket] = useState(null);
  const [showUsersList, setShowUsersList] = useState(false);
  const [typingUsers, setTypingUsers] = useState([]);
  
  const params = new URLSearchParams(location.search);
  const username = params.get("username");
  const room = params.get("room");
  const joinMethod = params.get("joinMethod");
  
  // Use refs to avoid re-running effects when these values are used in callbacks
  const usernameRef = useRef(username);
  const roomRef = useRef(room);
  const hasJoinedRef = useRef(false);
  const isInitialConnectionRef = useRef(true); // Track if this is the first connection
  
  useEffect(() => {
    usernameRef.current = username;
    roomRef.current = room;
  }, [username, room]);

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
        }
      });
    };

    if (socketInstance.connected) {
      handleConnection();
    } else {
      socketInstance.once('connect', handleConnection);
    }

    // Cleanup only on unmount
    return () => {
      socketInstance.off('connect', handleConnection);
      if (hasJoinedRef.current) {
        leaveRoom();
        hasJoinedRef.current = false;
      }
      isInitialConnectionRef.current = true; // Reset for next mount
      disconnectSocket();
    };
  }, []); // Keep empty - only run once on mount

  useEffect(() => {
    if (!socket) return;

    // Listen for messages
    const handleMessage = (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    };

    // Listen for room data (users list)
    const handleRoomData = ({ users }) => {
      setUsers(users);
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
    
    socket.on("message", handleMessage);
    socket.on("roomData", handleRoomData);
    socket.on("userJoined", handleUserJoined);
    socket.on("userLeft", handleUserLeft);
    socket.on("userTyping", handleUserTyping);
    socket.on("userStoppedTyping", handleUserStoppedTyping);
    socket.on("connect", handleReconnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("message", handleMessage);
      socket.off("roomData", handleRoomData);
      socket.off("userJoined", handleUserJoined);
      socket.off("userLeft", handleUserLeft);
      socket.off("userTyping", handleUserTyping);
      socket.off("userStoppedTyping", handleUserStoppedTyping);
      socket.off("connect", handleReconnect);
      socket.off("disconnect", handleDisconnect);
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
    <div className="flex flex-col h-screen max-h-screen w-screen overflow-hidden bg-neutral-950">
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
      />
      
      <div className="flex flex-1 overflow-hidden relative min-h-0">
        {/* Main chat area */}
        <div className={`flex-1 flex flex-col min-w-0 ${showUsersList ? 'hidden sm:flex' : 'flex'}`}>
          <MessageList 
            messages={messages} 
            currentUser={username} 
          />
          
          <TypingIndicator typingUsers={typingUsers} />
          
          <ChatInput 
            onSendMessage={sendMessage} 
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