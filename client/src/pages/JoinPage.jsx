import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaKey, FaMapMarkerAlt, FaRandom } from 'react-icons/fa';
import { generateUniqueRoomId } from '../utils/roomUtils';
import { getLocationBasedRoom } from '../utils/geolocation';
import { initSocket } from '../socket';

const JoinPage = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joinMethod, setJoinMethod] = useState('roomId'); // 'roomId' or 'location'
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleGenerateRandomRoomId = async () => {
    setIsLoading(true);
    try {
      // Initialize socket if not already done
      initSocket();
      
      // Generate a unique room ID that's not already in use
      const uniqueRoomId = await generateUniqueRoomId();
      setRoomId(uniqueRoomId);
    } catch (err) {
      console.error("Error generating room ID:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByLocation = async () => {
    setIsLoading(true);
    setError('');
    
    try {
      // Initialize socket
      initSocket();
      
      const locationRoom = await getLocationBasedRoom();
      // Normalize username to match server-side normalization
      const normalizedUsername = username.trim().toLowerCase();
      navigate(`/chat?room=${locationRoom}&username=${normalizedUsername}&joinMethod=location`);
    } catch (err) {
      setError(err.message || 'Failed to get your location. Please try again or use Room ID instead.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByRoomId = () => {
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    if (!roomId.trim()) {
      setError('Please enter a room ID');
      return;
    }
    
    // Normalize username to match server-side normalization
    const normalizedUsername = username.trim().toLowerCase();
    navigate(`/chat?room=${roomId}&username=${normalizedUsername}&joinMethod=roomId`);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Please enter a username');
      return;
    }
    
    if (joinMethod === 'roomId') {
      handleJoinByRoomId();
    } else {
      handleJoinByLocation();
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-gradient-to-br from-gray-900 to-indigo-900 p-3 sm:p-4 md:p-6">
      <div className="bg-gray-800 bg-opacity-95 rounded-xl sm:rounded-2xl shadow-xl p-5 sm:p-8 md:p-10 w-full max-w-[340px] sm:max-w-md transition-transform duration-300 hover:-translate-y-1 backdrop-blur-sm border border-gray-700 border-opacity-50">
        <h1 className="text-3xl sm:text-4xl font-bold text-center mb-2 bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">FlashChat</h1>
        <p className="text-center text-gray-400 mb-6 sm:mb-8 text-sm sm:text-base">Real-time chat with no strings attached</p>

        {error && (
          <div className="bg-red-900 bg-opacity-20 text-red-400 p-3 rounded-lg mb-5 border-l-4 border-red-500 text-xs sm:text-sm">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
          <div className="space-y-1 sm:space-y-2">
            <label htmlFor="username" className="block font-semibold text-gray-300 text-xs sm:text-sm">
              Username
            </label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your display name"
              maxLength={20}
              className="w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 border-gray-700 bg-gray-700 text-white text-sm sm:text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-800 outline-none transition placeholder-gray-500"
              required
            />
          </div>

          <div className="space-y-3 sm:space-y-4">
            <div className="flex rounded-lg overflow-hidden border border-gray-700">
              <button
                type="button"
                className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm transition ${
                  joinMethod === 'roomId' 
                    ? 'bg-indigo-700 text-white font-semibold' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                onClick={() => setJoinMethod('roomId')}
              >
                <FaKey /> Private Room
              </button>
              <button
                type="button"
                className={`flex-1 py-2 sm:py-3 px-2 sm:px-4 flex items-center justify-center gap-1 sm:gap-2 text-xs sm:text-sm transition ${
                  joinMethod === 'location' 
                    ? 'bg-indigo-700 text-white font-semibold' 
                    : 'bg-gray-700 hover:bg-gray-600 text-gray-300'
                }`}
                onClick={() => setJoinMethod('location')}
              >
                <FaMapMarkerAlt /> Nearby Chat
              </button>
            </div>

            {joinMethod === 'roomId' ? (
              <div className="space-y-1 sm:space-y-2">
                <label htmlFor="roomId" className="block font-semibold text-gray-300 text-xs sm:text-sm">
                  Room ID
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    id="roomId"
                    value={roomId}
                    onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                    placeholder="Enter room ID"
                    className="flex-1 px-3 sm:px-4 py-2 sm:py-3 rounded-lg border-2 border-gray-700 bg-gray-700 text-white text-sm sm:text-base focus:border-indigo-500 focus:ring-2 focus:ring-indigo-800 outline-none transition placeholder-gray-500"
                    required={joinMethod === 'roomId'}
                  />
                  <button 
                    type="button"
                    className="bg-gray-600 border-2 border-gray-700 rounded-lg px-3 hover:bg-gray-500 transition flex items-center justify-center text-white"
                    onClick={handleGenerateRandomRoomId}
                    title="Generate Random Room ID"
                    aria-label="Generate Random Room ID"
                  >
                    <FaRandom />
                  </button>
                </div>
                <p className="text-gray-400 text-[10px] sm:text-xs">Share this ID with others you want to chat with</p>
              </div>
            ) : (
              <div className="bg-gray-700 p-3 sm:p-4 rounded-lg border border-gray-600">
                <p className="flex items-center gap-1 sm:gap-2 text-gray-300 text-xs sm:text-sm">
                  <FaMapMarkerAlt className="text-indigo-400 flex-shrink-0" /> Join a chat room with people nearby
                </p>
                <p className="text-gray-400 text-[10px] sm:text-xs mt-1 sm:mt-2">
                  Uses your approximate location to connect with others in the same area (~5-10km).
                  No precise location data is stored.
                </p>
              </div>
            )}
          </div>

          <button 
            type="submit" 
            className={`w-full py-2.5 sm:py-3 px-4 bg-gradient-to-r from-indigo-600 to-purple-700 text-white font-semibold rounded-lg shadow-md hover:-translate-y-1 hover:shadow-lg transition-all duration-300 text-sm sm:text-base ${
              isLoading ? 'opacity-70 cursor-not-allowed' : ''
            }`}
            disabled={isLoading}
          >
            {isLoading 
              ? 'Connecting...' 
              : joinMethod === 'roomId' 
                ? 'Join Room' 
                : 'Join Nearby Chat'
            }
          </button>
        </form>
      </div>
    </div>
  );
};

export default JoinPage;