import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FaKey, FaMapMarkerAlt, FaRandom, FaCopy, FaCheck, FaTimes, FaSpinner } from 'react-icons/fa';
import { HiLightningBolt } from 'react-icons/hi';
import { generateUniqueRoomId } from '../utils/roomUtils';
import { getLocationBasedRoom } from '../utils/geolocation';
import { initSocket, getSocket, cancelJoinRequest } from '../socket';

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
  const [isPending, setIsPending] = useState(false);
  const [pendingRoom, setPendingRoom] = useState('');
  
  const navigate = useNavigate();

  useEffect(() => {
    const wakeUpServer = async () => {
      try {
        fetch(`${getServerUrl()}/health`, { method: 'GET' }).catch(() => {});
      } catch (e) {}
    };
    wakeUpServer();
  }, []);

  // Listen for join approval/rejection when pending
  useEffect(() => {
    if (!isPending) return;
    
    const socket = getSocket();
    if (!socket) return;
    
    const handleJoinApproved = ({ room }) => {
      setIsPending(false);
      setPendingRoom('');
      const normalizedUsername = username.trim().toLowerCase();
      navigate(`/chat?room=${room}&username=${normalizedUsername}&joinMethod=roomId`);
    };
    
    const handleJoinRejected = ({ reason }) => {
      setIsPending(false);
      setPendingRoom('');
      setError(reason || 'Your join request was rejected');
    };
    
    socket.on('joinApproved', handleJoinApproved);
    socket.on('joinRejected', handleJoinRejected);
    
    return () => {
      socket.off('joinApproved', handleJoinApproved);
      socket.off('joinRejected', handleJoinRejected);
    };
  }, [isPending, username, navigate]);

  const handleCancelPending = () => {
    if (pendingRoom) {
      cancelJoinRequest(pendingRoom, () => {});
    }
    setIsPending(false);
    setPendingRoom('');
  };

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
        
        const normalizedUsername = username.trim().toLowerCase();
        const normalizedRoom = roomId.trim().toUpperCase();
        
        // Try to join the room
        socket.emit('join', { username: normalizedUsername, room: normalizedRoom }, (response) => {
          setIsLoading(false);
          
          if (response && response.error) {
            setError(response.error);
          } else if (response && response.pending) {
            // Waiting for admin approval
            setIsPending(true);
            setPendingRoom(normalizedRoom);
          } else {
            // Successfully joined
            navigate(`/chat?room=${normalizedRoom}&username=${normalizedUsername}&joinMethod=roomId`);
          }
        });
      } catch (err) {
        setIsLoading(false);
        setError('Connection failed. Try again.');
      }
    } else {
      handleJoinByLocation();
    }
  };

  // Pending approval overlay
  if (isPending) {
    return (
      <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
        {/* Same wave background */}
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
          </svg>
        </div>
        
        <div className="w-full max-w-[360px] relative z-10 text-center">
          <div className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-xl p-8">
            <div className="mb-6">
              <FaSpinner className="text-4xl text-neutral-300 animate-spin mx-auto mb-4" />
              <h2 className="text-xl font-bold text-neutral-100 mb-2">Waiting for Approval</h2>
              <p className="text-neutral-400 text-sm">
                Requesting to join room <span className="text-neutral-200 font-mono">{pendingRoom}</span>
              </p>
            </div>
            
            <p className="text-neutral-500 text-xs mb-6">
              The room admin will decide whether to let you in. Please wait...
            </p>
            
            <button
              onClick={handleCancelPending}
              className="flex items-center justify-center gap-2 w-full py-2.5 bg-neutral-800 hover:bg-neutral-700 text-neutral-300 rounded-lg transition-colors text-sm"
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
    <div className="min-h-screen bg-neutral-950 flex items-center justify-center p-4 sm:p-6 relative overflow-hidden">
      {/* Animated Shiny Waves Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Bottom Wave layers */}
        <svg className="absolute w-full h-full" preserveAspectRatio="none" viewBox="0 0 1440 800">
          {/* Wave 1 - Bottom */}
          <path 
            className="animate-wave-path-1"
            fill="rgba(255,255,255,0.03)"
            d="M0,600 C320,700 420,500 720,550 C1020,600 1200,700 1440,650 L1440,800 L0,800 Z"
          />
          {/* Wave 2 - Middle */}
          <path 
            className="animate-wave-path-2"
            fill="rgba(255,255,255,0.04)"
            d="M0,650 C280,550 520,700 720,600 C920,500 1160,650 1440,580 L1440,800 L0,800 Z"
          />
          {/* Wave 3 - Top */}
          <path 
            className="animate-wave-path-3"
            fill="rgba(255,255,255,0.025)"
            d="M0,700 C360,600 600,750 900,680 C1200,610 1320,720 1440,700 L1440,800 L0,800 Z"
          />
        </svg>
        
        {/* Pulsing Glow orbs - more visible */}
        <div className="absolute top-20 left-10 w-32 h-32 bg-white/[0.04] rounded-full blur-3xl animate-pulse-slow" />
        <div className="absolute bottom-32 right-16 w-40 h-40 bg-white/[0.03] rounded-full blur-3xl animate-pulse-slow animation-delay-2000" />
      </div>

      <div className="w-full max-w-[360px] relative z-10">
        {/* Logo */}
        <div className="text-center mb-6 sm:mb-8">
          <div className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 bg-neutral-200 rounded-lg flex items-center justify-center">
              <HiLightningBolt className="text-lg text-neutral-900" />
            </div>
            <span className="text-xl font-bold text-neutral-100 tracking-tight">FlashChat</span>
          </div>
          <p className="text-neutral-500 text-xs">Anonymous instant messaging</p>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 py-2.5 px-3 bg-neutral-900 border border-neutral-800 rounded-lg text-neutral-400 text-xs animate-shake">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Username */}
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

          {/* Connection Type */}
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

          {/* Room Code */}
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

          {/* Submit */}
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

        {/* Footer */}
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