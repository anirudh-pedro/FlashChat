import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaKey, FaMapMarkerAlt, FaRandom, FaCopy, FaCheck } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';
import { generateUniqueRoomId } from '../utils/roomUtils';
import { getLocationBasedRoom } from '../utils/geolocation';
import { initSocket } from '../socket';

const getServerUrl = () => {
  if (typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return 'http://localhost:5000';
    }
  }
  return import.meta.env.VITE_API_URL || 'https://flashchat-oyd6.onrender.com';
};

const JoinPage = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const [joinMethod, setJoinMethod] = useState('roomId');
  const [isLoading, setIsLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState('');
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const [requireAdmin, setRequireAdmin] = useState(false);
  
  const navigate = useNavigate();

  useEffect(() => {
    const wakeUpServer = async () => {
      try {
        fetch(`${getServerUrl()}/health`, { method: 'GET' }).catch(() => {});
      } catch (e) {}
    };
    wakeUpServer();
  }, []);

  const handleGenerateRandomRoomId = async () => {
    setIsLoading(true);
    setError('');
    try {
      const socket = initSocket();
      
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
      
      const uniqueRoomId = await generateUniqueRoomId();
      setRoomId(uniqueRoomId);
    } catch (err) {
      setError('Connection failed. Try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopyRoomId = async () => {
    if (roomId) {
      await navigator.clipboard.writeText(roomId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleJoinByLocation = async () => {
    setIsLoading(true);
    setError('');
    setLoadingStep('Locating...');
    
    try {
      const locationRoom = await getLocationBasedRoom();
      setLoadingStep('Connecting...');
      const socket = initSocket();
      
      if (!socket.connected) {
        await new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            socket.off('connect', onConnect);
            reject(new Error('Connection failed.'));
          }, 45000);
          
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
      
      setLoadingStep('Joining...');
      const normalizedUsername = username.trim().toLowerCase();
      navigate(`/chat?room=${locationRoom}&username=${normalizedUsername}&joinMethod=location`);
    } catch (err) {
      let errorMsg = err.message || 'Failed to join.';
      if (err.message.includes('timed out')) errorMsg = 'Location timeout.';
      else if (err.message.includes('denied')) errorMsg = 'Location denied.';
      setError(errorMsg);
    } finally {
      setIsLoading(false);
      setLoadingStep('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!username.trim()) {
      setError('Enter a username');
      return;
    }
    
    if (joinMethod === 'roomId') {
      if (!roomId.trim()) {
        setError('Enter a room ID');
        return;
      }
      
      const normalizedUsername = username.trim().toLowerCase();
      const normalizedRoom = roomId.trim().toUpperCase();
      
      navigate(`/chat?room=${normalizedRoom}&username=${normalizedUsername}&joinMethod=roomId&requireAdmin=${requireAdmin}`);
    } else {
      handleJoinByLocation();
    }
  };

  return (
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <svg className="absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 800">
          <path 
            className="animate-wave-path-1"
            fill="rgba(255,255,255,0.03)"
            d="M0,600 C320,700 420,500 720,550 C1020,600 1200,700 1440,650 L1440,800 L0,800 Z"
          />
          <path 
            className="animate-wave-path-2"
            fill="rgba(255,255,255,0.04)"
            d="M0,650 C280,550 520,700 720,600 C920,500 1160,650 1440,580 L1440,800 L0,800 Z"
          />
          <path 
            className="animate-wave-path-3"
            fill="rgba(255,255,255,0.025)"
            d="M0,700 C360,600 600,750 900,680 C1200,610 1320,720 1440,700 L1440,800 L0,800 Z"
          />
        </svg>
        
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/[0.04] rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-32 right-16 w-40 h-40 bg-white/[0.03] rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
      </div>

      <div className="w-full max-w-[360px] relative z-10">
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-3 mb-2">
            <img src="/logo.jpg" alt="FlashChat Logo" className="w-10 h-10 rounded-lg object-cover" />
            <span className="text-xl font-bold text-neutral-100 tracking-tight">FlashChat</span>
          </div>
          <p className="text-neutral-500 text-xs">Anonymous instant messaging</p>
        </div>

        {error && (
          <div className="mb-4 py-2.5 px-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 text-xs animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-neutral-500 text-[10px] uppercase tracking-widest mb-2">
              Name
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter your name"
              maxLength={20}
              className="w-full bg-transparent border-b border-neutral-800 focus:border-neutral-400 text-neutral-100 text-sm py-2 px-0 placeholder-neutral-600 focus:outline-none transition-colors"
              required
            />
          </div>

          <div>
            <label className="block text-neutral-500 text-[10px] uppercase tracking-widest mb-3">
              Connect via
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setJoinMethod('roomId')}
                className={`py-3 px-3 rounded-lg border transition-all duration-200 cursor-pointer flex flex-col items-center gap-1.5 ${
                  joinMethod === 'roomId'
                    ? 'border-neutral-400 bg-neutral-200 text-neutral-900'
                    : 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-400'
                }`}
              >
                <FaKey className="text-sm" />
                <span className="text-xs font-medium">Private Room</span>
              </button>
              <button
                type="button"
                onClick={() => setJoinMethod('location')}
                className={`py-3 px-3 rounded-lg border transition-all duration-200 cursor-pointer flex flex-col items-center gap-1.5 ${
                  joinMethod === 'location'
                    ? 'border-neutral-400 bg-neutral-200 text-neutral-900'
                    : 'border-neutral-800 text-neutral-500 hover:border-neutral-700 hover:text-neutral-400'
                }`}
              >
                <FaMapMarkerAlt className="text-sm" />
                <span className="text-xs font-medium">Nearby</span>
              </button>
            </div>
          </div>

          {joinMethod === 'roomId' && (
            <div className="animate-fadeIn">
              <label className="block text-neutral-500 text-[10px] uppercase tracking-widest mb-2">
                Room Code
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value.toUpperCase())}
                  placeholder="XXXXXX"
                  className="flex-1 bg-transparent border-b border-neutral-800 focus:border-neutral-400 text-neutral-100 text-base py-2 px-0 placeholder-neutral-700 focus:outline-none transition-colors font-mono tracking-[0.3em] text-center"
                  required={joinMethod === 'roomId'}
                />
                <button
                  type="button"
                  onClick={handleGenerateRandomRoomId}
                  disabled={isLoading}
                  className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all disabled:opacity-50 cursor-pointer"
                  title="Generate"
                >
                  <FaRandom className={`text-sm ${isLoading ? 'animate-spin' : ''}`} />
                </button>
                {roomId && (
                  <button
                    type="button"
                    onClick={handleCopyRoomId}
                    className="p-2 text-neutral-500 hover:text-neutral-300 hover:bg-neutral-800 rounded-lg transition-all cursor-pointer"
                    title="Copy"
                  >
                    {copied ? <FaCheck className="text-sm text-neutral-300" /> : <FaCopy className="text-sm" />}
                  </button>
                )}
              </div>
              
              <div className="mt-4 p-3 bg-neutral-900 rounded-lg border border-neutral-800">
                <label className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
                      <svg className="w-3.5 h-3.5 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-neutral-200 text-xs font-medium">Admin Control</p>
                      <p className="text-neutral-500 text-[10px]">You approve who joins</p>
                    </div>
                  </div>
                  <div 
                    className={`w-10 h-5 rounded-full transition-colors duration-200 relative ${requireAdmin ? 'bg-neutral-200' : 'bg-neutral-700'}`}
                    onClick={() => setRequireAdmin(!requireAdmin)}
                  >
                    <div className={`absolute top-0.5 w-4 h-4 rounded-full transition-all duration-200 ${requireAdmin ? 'right-0.5 bg-neutral-900' : 'left-0.5 bg-neutral-500'}`} />
                  </div>
                </label>
              </div>
            </div>
          )}

          {/* Location Info */}
          {joinMethod === 'location' && (
            <div className="animate-fadeIn p-3 bg-neutral-900 rounded-lg border border-neutral-800">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-neutral-800 flex items-center justify-center flex-shrink-0">
                  <FaMapMarkerAlt className="text-neutral-400 text-xs" />
                </div>
                <div>
                  <p className="text-neutral-200 text-xs font-medium">Location-based</p>
                  <p className="text-neutral-500 text-[10px]">Connect with people ~15km around you</p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-1">
            <button 
              type="submit" 
              disabled={isLoading}
              className="w-full py-3 bg-neutral-200 text-neutral-900 font-medium rounded-lg hover:bg-neutral-300 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50 text-sm"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-neutral-400 border-t-neutral-900 rounded-full animate-spin" />
                  <span>{loadingStep || 'Connecting...'}</span>
                </>
              ) : (
                <>
                  <span>{joinMethod === 'roomId' ? 'Join Room' : 'Find Nearby'}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </>
              )}
            </button>
          </div>
        </form>

        <div className="mt-6 pt-4 border-t border-neutral-800">
          <div className="flex items-center justify-center gap-4 text-[10px] text-neutral-600">
            <span>No signup</span>
            <span className="w-0.5 h-0.5 rounded-full bg-neutral-700" />
            <span>No tracking</span>
            <span className="w-0.5 h-0.5 rounded-full bg-neutral-700" />
            <span>Ephemeral</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default JoinPage;