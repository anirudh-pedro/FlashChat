import React, { useState, useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ChatHeader from "../components/ChatHeader";
import MessageList from "../components/MessageList";
import ChatInput from "../components/ChatInput";
import UsersList from "../components/UsersList";
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
  
  const params = new URLSearchParams(location.search);
  const username = params.get("username");
  const room = params.get("room");
  const joinMethod = params.get("joinMethod");

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

    // Initialize socket connection
    const socketInstance = initSocket();
    setSocket(socketInstance);

    // Wait for connection before joining room
    const handleConnection = () => {
      joinRoom({ username, room }, (error) => {
        if (error) {
          toast.error(error);
          navigate("/join");
        }
      });
    };

    if (socketInstance.connected) {
      handleConnection();
    } else {
      socketInstance.once('connect', handleConnection);
    }

    // Cleanup on component unmount ONLY, not on every re-render
    return () => {
      socketInstance.off('connect', handleConnection);
      leaveRoom();
      disconnectSocket();
    };
  }, []); // Empty dependency array or add a stable reference

  useEffect(() => {
    if (!socket) return;

    // Listen for messages
    socket.on("message", (message) => {
      setMessages((prevMessages) => [...prevMessages, message]);
    });

    // Listen for room data (users list)
    socket.on("roomData", ({ users }) => {
      setUsers(users);
    });

    // Listen for user joined notifications
    socket.on("userJoined", (username) => {
      toast.info(`${username} joined the chat`);
    });

    // Listen for user left notifications
    socket.on("userLeft", (username) => {
      toast.info(`${username} left the chat`);
    });
    
    // Handle reconnection - rejoin room automatically
    const handleReconnect = () => {
      console.log("Socket reconnected, rejoining room...");
      toast.info("Reconnected to chat");
      
      joinRoom({ username, room }, (error) => {
        if (error) {
          toast.error("Failed to rejoin room: " + error);
          // Give user option to manually rejoin
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
        // Server disconnected the socket, manual reconnection needed
        toast.warning("Disconnected from server");
      } else {
        // Client disconnected, will auto-reconnect
        toast.warning("Connection lost, reconnecting...");
      }
    };
    
    socket.on("connect", handleReconnect);
    socket.on("disconnect", handleDisconnect);

    return () => {
      socket.off("message");
      socket.off("roomData");
      socket.off("userJoined");
      socket.off("userLeft");
      socket.off("connect", handleReconnect);
      socket.off("disconnect", handleDisconnect);
    };
  }, [socket, username, room, navigate]);

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
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-gray-900">
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
      
      <div className="flex flex-1 overflow-hidden relative">
        <div className={`flex-1 flex flex-col ${showUsersList ? 'hidden sm:flex' : 'flex'}`}>
          <MessageList 
            messages={messages} 
            currentUser={username} 
          />
          
          <ChatInput 
            onSendMessage={sendMessage} 
          />
        </div>
        
        {showUsersList && (
          <div className="absolute sm:relative w-full sm:w-auto right-0 top-0 h-full">
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