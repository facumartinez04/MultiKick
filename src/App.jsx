import React, { useState, useEffect } from 'react';
import { Plus, MonitorPlay, MessageSquare, ArrowLeft, X, Play, VolumeX, LogOut, Maximize2, Minimize2 } from 'lucide-react';
import KickPlayer from './components/KickPlayer';
import KickChat from './components/KickChat';
import ChatInput from './components/ChatInput';
import { initiateLogin, handleCallback, fetchCurrentUser } from './utils/kickAuth';

function App() {
  const [channels, setChannels] = useState([]);
  const [inputChannel, setInputChannel] = useState('');
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [activeChat, setActiveChat] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [shouldMuteAll, setShouldMuteAll] = useState(0);
  const [userToken, setUserToken] = useState(localStorage.getItem('kick_access_token'));
  const [userData, setUserData] = useState(() => {
    try {
      const stored = localStorage.getItem('kick_user');
      return stored ? JSON.parse(stored) : null;
    } catch (e) { return null; }
  });
  const [authError, setAuthError] = useState(null);
  const [maximizedChannel, setMaximizedChannel] = useState(null);
  const [pendingRestore, setPendingRestore] = useState(null); // State for restoration modal

  // ... useEffects ...
  // Load from URL (Path or Query) on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryChannels = params.get('channels')?.split(',') || [];

    // Parse path segments, ignoring common non-channel paths if any (though usually empty on root)
    const pathChannels = window.location.pathname.split('/')
      .map(c => c.trim())
      .filter(c => c.length > 0 && c !== 'index.html'); // Basic filter

    let allChannels = [...pathChannels, ...queryChannels]
      .map(c => c.trim())
      .filter(c => c.length > 0);

    // --- Custom Shortcut Logic ---
    if (allChannels.some(c => c.toLowerCase() === 'lostopglobales')) {
      allChannels = ['duendepablo', 'zeko', 'goncho', 'coker', 'coscu', 'robergalati'];
    }

    const uniqueChannels = [...new Set(allChannels)].slice(0, 9);

    if (uniqueChannels.length > 0) {
      setChannels(uniqueChannels);
      setActiveChat(uniqueChannels[0]);
      setIsStreamActive(true);
    }
  }, []);

  // Self-Repair User Data
  useEffect(() => {
    if (userToken && !userData) {
      console.log("Attempting to repair user data...");
      fetchCurrentUser(userToken)
        .then(user => {
          if (user) {
            console.log("User data repaired:", user.username);
            setUserData(user);
            localStorage.setItem('kick_user', JSON.stringify(user));
          }
        })
        .catch(err => {
          console.error("Failed to repair user data", err);
          // If 401, maybe logout? For now just log.
        });
    }
  }, [userToken, userData]);

  // Handle OAuth Callback
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    if (code && !userToken) {
      // Clear URL clean
      window.history.replaceState({}, document.title, window.location.pathname);

      handleCallback(code)
        .then(data => {
          if (data.access_token) {
            localStorage.setItem('kick_access_token', data.access_token);
            setUserToken(data.access_token);

            if (data.user) {
              localStorage.setItem('kick_user', JSON.stringify(data.user));
              setUserData(data.user);
            }

            // Check for previous session to restore
            const savedState = localStorage.getItem('kick_pre_login_state');
            if (savedState) {
              try {
                const parsed = JSON.parse(savedState);
                if (parsed.channels && parsed.channels.length > 0) {
                  setPendingRestore(parsed); // Trigger Modal
                }
              } catch (e) {
                console.error("Failed to restore state", e);
              }
              localStorage.removeItem('kick_pre_login_state');
            } else {
              // No state? Just show success toast or nothing
            }
          }
        })
        .catch(err => {
          console.error("Auth Error", err);
          setAuthError("Login failed: " + err.message);
        });
    }
  }, [userToken]);

  const handleLoginClick = () => {
    // Save current state before redirects
    const appState = {
      channels,
      activeChat,
      isStreamActive
    };
    localStorage.setItem('kick_pre_login_state', JSON.stringify(appState));
    initiateLogin();
  };

  const handleReset = () => {
    // Clear Auth
    localStorage.removeItem('kick_access_token');
    localStorage.removeItem('kick_user');
    localStorage.removeItem('kick_pre_login_state');
    setUserToken(null);
    setUserData(null);

    // Clear App State
    setChannels([]);
    setActiveChat('');
    setIsStreamActive(false);
    setMaximizedChannel(null);
    updateUrl([]);
  };

  const handleUserLogout = () => {
    // Only Clear Auth
    localStorage.removeItem('kick_access_token');
    localStorage.removeItem('kick_user');
    setUserToken(null);
    setUserData(null);
  };

  const updateUrl = (newChannels) => {
    const url = new URL(window.location);
    // We will favor the query param for updates to avoid navigation issues,
    // but the app supports reading the path format /c1/c2/c3
    if (newChannels.length > 0) {
      url.searchParams.set('channels', newChannels.join(','));
    } else {
      url.searchParams.delete('channels');
    }
    window.history.pushState({}, '', url);
  };

  const addChannel = (e) => {
    e.preventDefault();
    if (!inputChannel.trim()) return;

    // Support: "chan1/chan2" or "chan1, chan2"
    const potentialChannels = inputChannel.split(/[\/, ]+/)
      .map(c => c.trim())
      .filter(c => c.length > 0);

    if (potentialChannels.length === 0) return;

    const currentChannels = [...channels];
    let addedCount = 0;

    potentialChannels.forEach(channelName => {
      if (currentChannels.length >= 9) return;
      if (!currentChannels.some(c => c.toLowerCase() === channelName.toLowerCase())) {
        currentChannels.push(channelName);
        addedCount++;
      }
    });

    if (addedCount === 0 && currentChannels.length >= 9) {
      alert("Máximo 9 canales permitidos.");
      return;
    }

    setChannels(currentChannels);
    setInputChannel('');
    updateUrl(currentChannels); // Updates URL with accumulated channels

    if (currentChannels.length === 1 || (currentChannels.length > 0 && !activeChat)) {
      setActiveChat(currentChannels[0]);
    }
  };

  const removeChannel = (channelToRemove) => {
    const newChannels = channels.filter(c => c !== channelToRemove);
    setChannels(newChannels);
    updateUrl(newChannels);

    if (activeChat === channelToRemove && newChannels.length > 0) {
      setActiveChat(newChannels[0]);
    } else if (newChannels.length === 0) {
      setActiveChat('');
      setIsStreamActive(false);
    }

    if (maximizedChannel === channelToRemove) {
      setMaximizedChannel(null);
    }
  };

  const startStream = () => {
    if (channels.length > 0) {
      setIsStreamActive(true);
      if (!activeChat) setActiveChat(channels[0]);
    }
  };

  const triggerMuteAll = () => {
    setShouldMuteAll(Date.now());
  };

  const getGridClass = () => {
    if (maximizedChannel) return 'grid grid-cols-1'; // Full screen override
    const count = channels.length;

    // Improved Responsive Grid Logic
    switch (count) {
      case 0: return 'flex items-center justify-center';
      case 1: return 'grid grid-cols-1';
      case 2: return 'grid grid-cols-1 sm:grid-cols-2'; // 1 col mobile, 2 col sm+
      case 3: return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'; // 1->2->3
      case 4: return 'grid grid-cols-2'; // 2x2 always (unless very small, but 2 cols usually fits)
      case 5:
      case 6: return 'grid grid-cols-2 lg:grid-cols-3'; // 2 cols mobile/tablet, 3 cols desktop
      case 7:
      case 8:
      case 9: return 'grid grid-cols-2 md:grid-cols-3'; // 2 cols mobile, 3 cols tablet+
      default: return 'flex items-center justify-center';
    }
  };

  // --- Views ---

  if (!isStreamActive) {
    // INDEX / SETUP VIEW
    return (
      <div className="min-h-screen w-full bg-kick-dark flex flex-col items-center justify-center text-white relative overflow-hidden font-sans">

        {/* Background Decorative Elements */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-kick-green/5 rounded-full blur-[120px]"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]"></div>
        </div>

        <div className="z-10 w-full max-w-3xl px-6 flex flex-col items-center animate-in fade-in zoom-in duration-500">

          {/* Logo */}
          <div className="mb-12 flex flex-col items-center">
            <div className="w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center mb-6">
              <img src="https://kick.com/img/kick-logo.svg" alt="Kick Logo" className="w-full h-full object-contain" />
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
              Multi<span className="text-kick-green">Kick</span>
            </h1>
            <p className="text-gray-400 mt-4 text-center max-w-lg text-lg">
              Arma tu centro de comando definitivo. Mira hasta 9 streams a la vez con cero lag.
            </p>
          </div>

          {/* Input Area */}
          <div className="w-full max-w-md bg-kick-surface/50 p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl mb-8">
            <form onSubmit={addChannel} className="relative flex items-center gap-2">
              <div className="absolute left-4 text-gray-500">
                <MonitorPlay size={20} />
              </div>
              <input
                type="text"
                value={inputChannel}
                onChange={(e) => setInputChannel(e.target.value)}
                placeholder="Agregar Canal (ej. Coscu)"
                className="w-full bg-transparent border-none text-white placeholder-gray-500 pl-12 pr-4 py-3 focus:outline-none focus:ring-0 text-lg"
                autoFocus
              />
              <button
                type="submit"
                disabled={!inputChannel || channels.length >= 9}
                className="bg-kick-green hover:bg-kick-green/90 text-black font-bold p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Plus size={24} strokeWidth={3} />
              </button>
            </form>
          </div>

          {/* Added Channels List */}
          {channels.length > 0 && (
            <div className="w-full max-w-2xl mb-10">
              <div className="flex flex-wrap items-center justify-center gap-3">
                {channels.map(channel => (
                  <div key={channel} className="group relative bg-kick-surface border border-white/5 hover:border-kick-green/50 px-4 py-2 rounded-lg flex items-center gap-3 transition-all">
                    <span className="w-2 h-2 rounded-full bg-kick-green"></span>
                    <span className="font-semibold">{channel}</span>
                    <button
                      onClick={() => removeChannel(channel)}
                      className="ml-2 text-gray-500 hover:text-red-500 transition-colors"
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Start Button */}
          <button
            onClick={startStream}
            disabled={channels.length === 0}
            className="group relative px-8 py-4 bg-white text-black font-black text-xl rounded-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed overflow-hidden"
          >
            <div className="absolute inset-0 bg-kick-green translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 origin-bottom z-0"></div>
            <div className="relative z-10 flex items-center gap-3">
              <span>ARMAR MULTI STREAM</span>
              <Play size={24} fill="currentColor" />
            </div>
          </button>

        </div>

        {/* Footer */}
        <div className="absolute bottom-6 text-gray-600 text-sm flex flex-col items-center gap-1">
          <span>Powered by Kick.com</span>
          <span className="opacity-80">
            Hecho por <a href="https://x.com/_mahada_" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-kick-green font-bold transition-colors">Mahada</a>
          </span>
          <span className="text-[10px] opacity-50 mt-1">
            No estamos afiliados con Kick.com
          </span>
        </div>
      </div>
    );
  }

  // STREAM VIEW
  return (
    <div className="flex h-screen w-full bg-kick-dark text-white overflow-hidden">

      {/* Main Content (Streams) */}
      <div className="flex-1 flex flex-col h-full min-w-0 transition-all duration-300">
        {/* Minimal Header */}
        <header className="h-14 bg-kick-gray border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-20">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setIsStreamActive(false)}
              className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
              title="Volver al inicio"
            >
              <ArrowLeft size={20} />
            </button>
            <div className="h-6 w-px bg-white/10"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 flex items-center justify-center">
                <img src="https://kick.com/img/kick-logo.svg" alt="Kick Logo" className="w-full h-full object-contain" />
              </div>
              <span className="font-bold text-white/90 hidden sm:block">MultiKick</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleReset}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-white/5 text-red-400 hover:bg-red-500/20 hover:text-red-300 border border-transparent transition-all mr-2"
              title="Cerrar canales y Salir"
            >
              <LogOut size={16} />
              <span className="hidden sm:inline">Salir</span>
            </button>

            <button
              onClick={triggerMuteAll}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-white/5 text-gray-200 hover:bg-red-500/20 hover:text-red-400 hover:border-red-500/50 border border-transparent transition-all"
            >
              <VolumeX size={16} />
              <span className="hidden sm:inline">Mutear Todos</span>
            </button>

            <button
              onClick={() => setIsChatOpen(!isChatOpen)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all ${isChatOpen
                ? 'bg-kick-green text-black'
                : 'bg-white/5 text-gray-400 hover:bg-white/10'
                }`}
            >
              <MessageSquare size={16} />
              <span className="hidden sm:inline">Chat</span>
            </button>
          </div>
        </header>

        {/* Grid */}
        <main className={`flex-1 relative overflow-hidden bg-black/50 ${getGridClass()}`}>
          {channels.map((channel) => {
            // If focused, hide others
            if (maximizedChannel && maximizedChannel !== channel) return null;

            return (
              <div key={channel} className="w-full h-full p-0.5 border-2 border-transparent hover:border-white/5 transition-all">
                <KickPlayer
                  channel={channel}
                  onRemove={removeChannel}
                  shouldMuteAll={shouldMuteAll}
                  isMaximized={maximizedChannel === channel}
                  onToggleMaximize={() => setMaximizedChannel(maximizedChannel === channel ? null : channel)}
                />
              </div>
            );
          })}
        </main>
      </div>

      {/* Right Sidebar (Chat) */}
      <div
        className={`flex-shrink-0 bg-kick-gray border-l border-white/5 transition-all duration-300 flex flex-col ${isChatOpen ? 'w-80 md:w-96 translate-x-0' : 'w-0 translate-x-full opacity-0'
          }`}
      >
        {/* Chat Header / Dropdown */}
        <div className="h-14 border-b border-white/5 flex items-center px-3 py-2 shrink-0 gap-2 z-50">
          <div className="relative w-full">
            <button
              onClick={() => setIsChatOpen(prev => prev === 'dropdown' ? true : 'dropdown')}
              className="w-full flex items-center justify-between bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg px-3 py-2 transition-all group"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {/* Avatar Placeholder / or actual if we had it. Using UI Avatars for consistent "Icono" feel */}
                <div className="w-6 h-6 rounded-full bg-kick-green flex items-center justify-center shrink-0 text-black text-[10px] font-bold uppercase">
                  {activeChat ? activeChat.substring(0, 2) : '??'}
                </div>
                <span className="font-bold text-sm text-white truncate">
                  {activeChat ? `chat de ${activeChat}` : 'Selecciona un chat'}
                </span>
              </div>

              {/* Arrow */}
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg" className={`text-gray-400 group-hover:text-white transition-transform duration-200 ${isChatOpen === 'dropdown' ? 'rotate-180' : ''}`}>
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>

            {/* Dropdown Menu */}
            {isChatOpen === 'dropdown' && (
              <div className="absolute top-full left-0 w-full mt-2 bg-kick-dark border border-white/10 rounded-lg shadow-2xl overflow-hidden z-50 flex flex-col animate-in fade-in zoom-in-95 duration-150">
                {channels.map(c => (
                  <button
                    key={c}
                    onClick={() => {
                      setActiveChat(c);
                      setIsChatOpen(true); // Close dropdown (return to 'true' state means open sidebar)
                    }}
                    className={`flex items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-white/5 ${activeChat === c ? 'bg-white/10 text-white' : 'text-gray-400'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold uppercase border border-white/10 ${activeChat === c ? 'bg-kick-green text-black' : 'bg-black text-gray-500'}`}>
                      {c.substring(0, 2)}
                    </div>
                    <span className={activeChat === c ? 'font-bold' : ''}>
                      chat de {c}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Chat Embed */}
        <div className="flex-1 bg-black flex flex-col min-h-0">
          <div className="relative flex-1 min-h-0 flex flex-col">
            {activeChat ? (
              <KickChat channel={activeChat} active={true} />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No chat selected
              </div>
            )}
          </div>

          {/* Custom API Chat Input */}
          <ChatInput
            activeChat={activeChat}
            userToken={userToken}
            userData={userData}
            onLogout={handleUserLogout}
            onLogin={handleLoginClick}
          />
        </div>

      </div>

      {/* Restore Session Modal */}
      {pendingRestore && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
          <div className="bg-kick-dark border border-white/10 p-6 rounded-2xl shadow-2xl max-w-md w-full text-center space-y-4">
            <div className="w-16 h-16 bg-kick-green/20 text-kick-green rounded-full flex items-center justify-center mx-auto mb-2">
              <MonitorPlay size={32} />
            </div>
            <h2 className="text-2xl font-bold text-white">¡Sesión Recuperada!</h2>
            <p className="text-gray-400">
              Encontramos tu sesión anterior con
              <span className="text-white font-bold mx-1">{pendingRestore.channels.length} stream(s)</span>
              abiertos.
            </p>

            <div className="flex flex-col gap-2 mt-4">
              <button
                onClick={() => {
                  setChannels(pendingRestore.channels);
                  if (pendingRestore.activeChat) setActiveChat(pendingRestore.activeChat);
                  if (pendingRestore.isStreamActive) setIsStreamActive(pendingRestore.isStreamActive);
                  updateUrl(pendingRestore.channels);
                  setPendingRestore(null);
                }}
                className="w-full bg-kick-green text-black font-bold py-3 rounded-xl hover:scale-[1.02] transition-transform text-lg"
              >
                Volver a ver streams ({pendingRestore.channels.join(', ')})
              </button>
              <button
                onClick={() => setPendingRestore(null)}
                className="w-full bg-white/5 text-gray-400 font-bold py-3 rounded-xl hover:bg-white/10 hover:text-white transition-colors"
              >
                Empezar de cero
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
