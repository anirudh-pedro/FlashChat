import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaKey, FaMapMarkerAlt, FaRandom, FaUsers, FaBolt, FaShieldAlt } from 'react-icons/fa';
import { generateUniqueRoomId } from '../utils/roomUtils';
import { getLocationBasedRoom } from '../utils/geolocation';
import { initSocket } from '../socket';

const JoinPage = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joinMethod, setJoinMethod] = useState('roomId'); // 'roomId' or 'location'
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  
  const navigate = useNavigate();

  const handleGenerateRandomRoomId = async () => {
    setIsLoading(true);
    setError('');
    try {
      // Initialize socket if not already done
      const socket = initSocket();
      
      // Wait for socket to connect before generating room ID
      if (!socket.connected) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off('connect', onConnect);
            reject(new Error('Connection timeout'));
          }, 10000);
          
          const onConnect = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          socket.once('connect', onConnect);
          if (socket.connected) {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
      
      // Generate a unique room ID that's not already in use
      const uniqueRoomId = await generateUniqueRoomId();
      setRoomId(uniqueRoomId);
    } catch (err) {
      console.error("Error generating room ID:", err);
      setError('Failed to connect. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJoinByLocation = async () => {
    setIsLoading(true);
    setError('');
    setLoadingStep('Getting your location...');
    
    try {
      // Get location FIRST (before connecting to socket)
      const locationRoom = await getLocationBasedRoom();
      
      // Now initialize socket connection
      setLoadingStep('Connecting to server...');
      const socket = initSocket();
      
      if (!socket.connected) {
        // Longer timeout for Render free tier cold starts (can take 30-60s)
        setLoadingStep('Waking up server...');
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off('connect', onConnect);
            reject(new Error('Server is taking too long to respond. Please try again.'));
          }, 45000); // 45 seconds for cold start
          
          const onConnect = () => {
            clearTimeout(timeout);
            resolve();
          };
          
          socket.once('connect', onConnect);
          if (socket.connected) {
            clearTimeout(timeout);
            resolve();
          }
        });
      }
      
      setLoadingStep('Joining chat...');
      const normalizedUsername = username.trim().toLowerCase();
      navigate(`/chat?room=${locationRoom}&username=${normalizedUsername}&joinMethod=location`);
    } catch (err) {
      let errorMsg = err.message || 'Failed to join nearby chat.';
      
      if (err.message.includes('too long') || err.message.includes('connect to server')) {
        errorMsg += '\n\n💡 The server may be sleeping. Try again in a few seconds.';
      } else if (err.message.includes('timed out')) {
        errorMsg += '\n\n💡 Try: Move near a window or use "Private Room" instead';
      } else if (err.message.includes('denied')) {
        errorMsg += '\n\n💡 Try: Enable location in settings or use "Private Room" instead';
      }
      
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
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
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-3 sm:p-4 relative overflow-hidden">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-white/5 rounded-full filter blur-3xl animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-white/5 rounded-full filter blur-3xl animate-blob animation-delay-2000"></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-white/5 rounded-full filter blur-3xl animate-blob animation-delay-4000"></div>
        
        {/* Floating letters */}
        <div className="hidden sm:block absolute top-[10%] left-[15%] text-white/5 text-6xl font-bold animate-float">F</div>
        <div className="hidden sm:block absolute top-[20%] right-[20%] text-white/5 text-5xl font-bold animate-float animation-delay-1000">L</div>
        <div className="hidden sm:block absolute top-[60%] left-[10%] text-white/5 text-7xl font-bold animate-float animation-delay-2000">A</div>
        <div className="hidden sm:block absolute top-[70%] right-[15%] text-white/5 text-6xl font-bold animate-float animation-delay-3000">S</div>
        <div className="hidden sm:block absolute top-[40%] right-[40%] text-white/5 text-5xl font-bold animate-float animation-delay-4000">H</div>
        <div className="hidden sm:block absolute bottom-[20%] left-[40%] text-white/5 text-6xl font-bold animate-float animation-delay-5000">C</div>
      </div>

      <div className="w-full max-w-6xl mx-auto relative z-10">
        <div className="grid lg:grid-cols-2 gap-6 lg:gap-8 items-center">
          {/* Left side - Branding */}
          <div className="hidden lg:block text-white space-y-6">
            <div className="inline-block">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/20">
                  <FaBolt className="text-2xl text-neutral-950" />
                </div>
                <h1 className="text-5xl font-bold text-white tracking-tight">
                  FlashChat
                </h1>
              </div>
              <div className="h-1 w-32 bg-white rounded-full"></div>
            </div>

            <p className="text-2xl text-gray-300 font-light leading-relaxed">
              Connect instantly with<br />
              <span className="font-semibold text-white">real-time messaging</span>
            </p>

            <div className="space-y-4 pt-4">
              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors border border-white/10">
                  <FaBolt className="text-white/70" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">Lightning Fast</h3>
                  <p className="text-gray-400 text-sm">Real-time messaging with zero lag</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors border border-white/10">
                  <FaShieldAlt className="text-white/70" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">Secure & Private</h3>
                  <p className="text-gray-400 text-sm">No data stored, complete anonymity</p>
                </div>
              </div>

              <div className="flex items-start gap-4 group">
                <div className="w-10 h-10 bg-white/10 rounded-lg flex items-center justify-center flex-shrink-0 group-hover:bg-white/20 transition-colors border border-white/10">
                  <FaUsers className="text-white/70" />
                </div>
                <div>
                  <h3 className="font-semibold text-lg text-white">Connect Anywhere</h3>
                  <p className="text-gray-400 text-sm">Private rooms or discover nearby chats</p>
                </div>
              </div>
            </div>
          </div>

          {/* Right side - Join Form */}
          <div className="w-full">
            {/* Mobile header */}
            <div className="lg:hidden text-center mb-6">
              <div className="inline-flex items-center gap-2 sm:gap-3 mb-3">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/20">
                  <FaBolt className="text-xl text-neutral-950" />
                </div>
                <h1 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                  FlashChat
                </h1>
              </div>
              <p className="text-gray-400 text-xs sm:text-sm">Connect instantly with real-time messaging</p>
            </div>

            <div className="bg-neutral-900 rounded-xl sm:rounded-2xl shadow-2xl border border-neutral-800 p-5 sm:p-8 relative overflow-hidden">
              {/* Animated shining overlay */}
              <div className="absolute inset-0 bg-gradient-to-br from-white/0 via-white/5 to-white/0 pointer-events-none animate-shine"></div>
              
              <div className="relative z-10">
                <div className="text-center mb-5 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold text-white mb-2">Get Started</h2>
                  <p className="text-gray-400 text-xs sm:text-sm">Choose how you'd like to connect</p>
                </div>

                {error && (
                  <div className="mb-5 sm:mb-6 bg-red-500/10 border border-red-500/30 rounded-xl p-3 sm:p-4 animate-shake">
                    <div className="whitespace-pre-line text-red-300 text-xs sm:text-sm leading-relaxed">{error}</div>
                  </div>
                )}
                
                <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
                  {/* Username Input */}
                  <div className="space-y-2">
                    <label htmlFor="username" className="block text-xs sm:text-sm font-medium text-gray-300">
                      Your Name
                    </label>
                    <input
                      type="text"
                      id="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      placeholder="Enter your display name"
                      maxLength={20}
                      className="w-full px-3 sm:px-4 py-2.5 sm:py-3 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all"
                      required
                    />
                    <p className="text-xs text-gray-500">This is how others will see you</p>
                  </div>

                  {/* Join Method Tabs */}
                  <div className="space-y-3 sm:space-y-4">
                    <label className="block text-xs sm:text-sm font-medium text-gray-300 mb-2 sm:mb-3">
                      Join Method
                    </label>
                    <div className="grid grid-cols-2 gap-2 sm:gap-3 p-1 bg-neutral-950 rounded-xl border border-neutral-800">
                      <button
                        type="button"
                        onClick={() => setJoinMethod('roomId')}
                        className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                          joinMethod === 'roomId'
                            ? 'bg-white text-neutral-950 shadow-lg shadow-white/30 font-semibold'
                            : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        <FaKey className="text-xs" />
                        <span className="hidden xs:inline">Private Room</span>
                        <span className="xs:hidden">Private</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setJoinMethod('location')}
                        className={`py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 cursor-pointer ${
                          joinMethod === 'location'
                            ? 'bg-white text-neutral-950 shadow-lg shadow-white/30 font-semibold'
                            : 'text-gray-400 hover:text-white hover:bg-neutral-800'
                        }`}
                      >
                        <FaMapMarkerAlt className="text-xs" />
                        Nearby
                      </button>
                    </div>

                    {/* Method-specific content */}
                    <div className="min-h-[120px] sm:min-h-[140px]">
                      {joinMethod === 'roomId' ? (
                        <div className="space-y-2.5 sm:space-y-3 animate-fadeIn">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              id="roomId"
                              value={roomId}
                              onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                              placeholder="Enter or generate Room ID"
                              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 bg-neutral-950 border border-neutral-700 rounded-xl text-white text-sm sm:text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-white focus:border-transparent transition-all font-mono tracking-wider"
                              required={joinMethod === 'roomId'}
                            />
                            <button 
                              type="button"
                              onClick={handleGenerateRandomRoomId}
                              disabled={isLoading}
                              className="px-3 sm:px-4 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-xl text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center min-w-[48px] sm:min-w-[52px] cursor-pointer"
                              title="Generate Random Room ID"
                            >
                              <FaRandom className={isLoading ? 'animate-spin' : ''} />
                            </button>
                          </div>
                          <div className="bg-white/5 border border-white/20 rounded-lg p-2.5 sm:p-3">
                            <p className="text-xs text-gray-300 leading-relaxed">
                              <strong>Private Room:</strong> Create or join with a unique code. Share it with people you want to chat with.
                            </p>
                          </div>
                        </div>
                      ) : (
                        <div className="space-y-2.5 sm:space-y-3 animate-fadeIn">
                          <div className="bg-white/5 border border-white/20 rounded-lg p-3 sm:p-4">
                            <div className="flex items-start gap-2.5 sm:gap-3">
                              <FaMapMarkerAlt className="text-white/70 mt-0.5 flex-shrink-0 text-sm sm:text-base" />
                              <div>
                                <p className="text-xs sm:text-sm text-gray-200 font-medium mb-1">
                                  Discover Nearby Chats
                                </p>
                                <p className="text-xs text-gray-300 leading-relaxed">
                                  Connect with people within ~15km radius.
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Submit Button */}
                  <button 
                    type="submit" 
                    disabled={isLoading}
                    className={`w-full py-3.5 sm:py-4 px-5 sm:px-6 bg-white hover:bg-gray-100 text-neutral-950 font-semibold rounded-xl shadow-lg shadow-white/20 hover:shadow-white/30 transition-all duration-200 flex items-center justify-center gap-2 relative overflow-hidden text-sm sm:text-base cursor-pointer ${
                      isLoading ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02]'
                    }`}
                  >
                    {!isLoading && <div className="absolute inset-0 animate-shine pointer-events-none"></div>}
                    {isLoading ? (
                      <>
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        <span>{loadingStep || 'Connecting...'}</span>
                      </>
                    ) : (
                      <>
                        <span>{joinMethod === 'roomId' ? 'Join Room' : 'Find Nearby Chats'}</span>
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </>
                    )}
                  </button>

                  {isLoading && joinMethod === 'location' && (
                    <div className="text-center animate-pulse">
                      <p className="text-xs text-gray-400">
                        {loadingStep === 'Getting your location...' && '📍 Acquiring location...'}
                        {loadingStep === 'Connecting to server...' && '🔌 Establishing connection...'}
                        {loadingStep === 'Joining chat...' && '✨ Almost there...'}
                      </p>
                    </div>
                  )}
                </form>
              </div>
            </div>

            {/* Footer note */}
            <p className="text-center text-gray-500 text-xs mt-4 sm:mt-6 px-2">
              No registration required • Completely anonymous • No data stored
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;