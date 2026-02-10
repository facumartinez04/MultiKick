import React, { useState, useEffect, useCallback } from 'react';
import { Plus, MonitorPlay, MessageSquare, ArrowLeft, X, Play, VolumeX, LogOut, Maximize2, Minimize2, Share2, Copy, Check } from 'lucide-react';
import KickPlayer from './components/KickPlayer';
import KickChat from './components/KickChat';
import ChatInput from './components/ChatInput';
import LandingPage from './components/LandingPage';
import AdminPage from './components/AdminPage';
import AdminTopGlobales from './components/AdminTopGlobales';
import { initiateLogin, handleCallback, fetchCurrentUser, refreshAccessToken } from './utils/kickAuth';

function App() {
  const [channels, setChannels] = useState([]);
  const [inputChannel, setInputChannel] = useState('');
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [activeChat, setActiveChat] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(() => window.innerWidth >= 768);
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
  const [isTopGlobales, setIsTopGlobales] = useState(false);
  const [chatPermissions, setChatPermissions] = useState({ isSubscriber: false, isBroadcaster: false, isModerator: false });
  const [channelAvatars, setChannelAvatars] = useState({});
  const [channelViewers, setChannelViewers] = useState({});
  const [showShareModal, setShowShareModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isInitializing, setIsInitializing] = useState(true);

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleMetaUpdate = (channel, profilePic) => {
    setChannelAvatars(prev => {
      if (prev[channel] === profilePic) return prev;
      return { ...prev, [channel]: profilePic };
    });
  };

  const handleViewersUpdate = useCallback((channel, count) => {
    setChannelViewers(prev => {
      if (prev[channel] === count) return prev;
      return { ...prev, [channel]: count };
    });
  }, []);

  useEffect(() => {
    setChatPermissions({ isSubscriber: false, isBroadcaster: false, isModerator: false });
  }, [activeChat]);

  useEffect(() => {
    const initializeChannels = async () => {
      setIsInitializing(true);
      const params = new URLSearchParams(window.location.search);
      const queryChannels = params.get('channels')?.split(',') || [];
      const pathSegments = window.location.pathname.split('/')
        .map(c => c.trim())
        .filter(c => c.length > 0 && c !== 'index.html' && c !== 'viewadmin' && c !== 'admin-topglobales');

      // Check for custom slug if there's exactly one path segment and no query channels
      let slugFound = false;
      if (pathSegments.length === 1 && queryChannels.length === 0) {
        const potentialSlug = pathSegments[0];
        try {
          const res = await fetch(`https://kickplayer-ahzd.onrender.com/api/slug/${potentialSlug}`);
          if (res.ok) {
            const data = await res.json();
            if (data.channels && Array.isArray(data.channels) && data.channels.length > 0) {
              setChannels(data.channels);
              setActiveChat(data.channels[0]);
              setIsStreamActive(true);
              if (potentialSlug.toLowerCase() === 'lostopglobales') {
                setIsTopGlobales(true);
              }
              slugFound = true;
            }
          }
        } catch (e) {
          console.error("Error checking slug:", e);
        }
      }

      if (!slugFound) {
        // Existing fallback logic
        let allChannels = [...pathSegments, ...queryChannels]
          .map(c => c.trim())
          .filter(c => c.length > 0);

        if (allChannels.some(c => c.toLowerCase() === 'lostopglobales')) {
          allChannels = ['duendepablo', 'zeko', 'goncho', 'coker', 'coscu', 'robergalati'];
          setIsTopGlobales(true);
        }

        const uniqueChannels = [...new Set(allChannels)].slice(0, 9);

        if (uniqueChannels.length > 0) {
          setChannels(uniqueChannels);
          setActiveChat(uniqueChannels[0]);
          setIsStreamActive(true);
        }
      }

      setIsInitializing(false);
    };

    const adminRoutes = ['/viewadmin', '/admin-topglobales'];
    if (!adminRoutes.includes(window.location.pathname)) {
      initializeChannels();
    } else {
      setIsInitializing(false);
    }

  }, []);

  useEffect(() => {
    if (userToken && !userData) {
      fetchCurrentUser(userToken)
        .then(user => {
          if (user) {
            setUserData(user);
            localStorage.setItem('kick_user', JSON.stringify(user));
          }
        })
        .catch(async (err) => {
          console.error("Failed to repair user data (" + err.message + "). Attempting refresh...");
          const refreshToken = localStorage.getItem('kick_refresh_token');
          if (refreshToken) {
            try {
              const newData = await refreshAccessToken(refreshToken);
              if (newData.access_token) {
                localStorage.setItem('kick_access_token', newData.access_token);
                if (newData.refresh_token) {
                  localStorage.setItem('kick_refresh_token', newData.refresh_token);
                }
                setUserToken(newData.access_token);

                const user = await fetchCurrentUser(newData.access_token);
                if (user) {
                  setUserData(user);
                  localStorage.setItem('kick_user', JSON.stringify(user));
                }
              }
            } catch (refreshErr) {
              console.error("Auto-refresh failed during startup", refreshErr);
              localStorage.removeItem('kick_access_token');
              localStorage.removeItem('kick_refresh_token');
              localStorage.removeItem('kick_user');
              setUserToken(null);
            }
          } else {
            localStorage.removeItem('kick_access_token');
            setUserToken(null);
          }
        });
    }
  }, [userToken, userData]);

  useEffect(() => {
    const savedState = localStorage.getItem('kick_pre_login_state');
    if (savedState) {
      try {
        const parsed = JSON.parse(savedState);
        if (parsed && parsed.channels && parsed.channels.length > 0) {
          setChannels(parsed.channels);
          if (parsed.activeChat) setActiveChat(parsed.activeChat);
          if (parsed.isStreamActive) setIsStreamActive(parsed.isStreamActive);
          if (parsed.isTopGlobales) setIsTopGlobales(parsed.isTopGlobales);
          updateUrl(parsed.channels);
        }
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
      localStorage.removeItem('kick_pre_login_state');
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');

    if (code) {
      window.history.replaceState({}, document.title, window.location.pathname);
      handleCallback(code)
        .then(data => {
          if (data.access_token) {
            localStorage.setItem('kick_access_token', data.access_token);
            if (data.refresh_token) {
              localStorage.setItem('kick_refresh_token', data.refresh_token);
            }
            setUserToken(data.access_token);
            if (data.user) {
              localStorage.setItem('kick_user', JSON.stringify(data.user));
              setUserData(data.user);
            }
          }
        })
        .catch(err => {
          console.error("Auth Error", err);
          setAuthError("Login failed: " + err.message);
        });
    }
  }, []);

  const handleLoginClick = () => {
    const appState = { channels, activeChat, isStreamActive, isTopGlobales };
    localStorage.setItem('kick_pre_login_state', JSON.stringify(appState));
    initiateLogin();
  };

  const handleReset = () => {
    localStorage.removeItem('kick_access_token');
    localStorage.removeItem('kick_refresh_token');
    localStorage.removeItem('kick_user');
    localStorage.removeItem('kick_pre_login_state');
    setUserToken(null);
    setUserData(null);
    setChannels([]);
    setActiveChat('');
    setIsStreamActive(false);
    setMaximizedChannel(null);
    updateUrl([]);
    setIsTopGlobales(false);
  };

  const handleUserLogout = () => {
    localStorage.removeItem('kick_access_token');
    localStorage.removeItem('kick_refresh_token');
    localStorage.removeItem('kick_user');
    setUserToken(null);
    setUserData(null);
  };

  const handleTokenUpdate = (newData) => {
    if (newData.access_token) {
      localStorage.setItem('kick_access_token', newData.access_token);
      setUserToken(newData.access_token);
    }
    if (newData.refresh_token) {
      localStorage.setItem('kick_refresh_token', newData.refresh_token);
    }
  };

  const handlePermissionsUpdate = (perms) => {
    setChatPermissions(prev => ({ ...prev, ...perms }));
  };

  const updateUrl = (newChannels) => {
    const url = new URL(window.location);
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
    updateUrl(currentChannels);

    if (currentChannels.length === 1 || (currentChannels.length > 0 && !activeChat)) {
      setActiveChat(currentChannels[0]);
    }
  };

  const removeChannel = (channelToRemove) => {
    setChannelViewers(prev => {
      const copy = { ...prev };
      delete copy[channelToRemove];
      return copy;
    });
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

  const triggerMuteAll = () => setShouldMuteAll(Date.now());

  const getGridClass = () => "flex flex-wrap justify-center content-start w-full h-full";

  const getItemClasses = (total) => {
    if (maximizedChannel) return 'w-full h-full';
    let classes = "w-1/2";
    if (total === 1) classes = "w-full";

    if (total <= 2) classes += " h-full";
    else if (total <= 4) classes += " h-1/2";
    else if (total <= 6) classes += " h-1/3";
    else if (total <= 8) classes += " h-1/4";
    else classes += " h-[20%]";

    if (!isChatOpen && (total === 7 || total === 8)) {
      classes += " md:w-1/4 md:h-1/2";
    } else {
      if (total === 1) classes += " md:w-full";
      else if (total <= 4) classes += " md:w-1/2";
      else classes += " md:w-1/3";

      if (total <= 2) classes += " md:h-full";
      else if (total <= 6) classes += " md:h-1/2";
      else classes += " md:h-1/3";
    }
    return classes;
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-kick-dark flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-kick-green border-t-transparent rounded-full animate-spin"></div>
          <p className="text-kick-green font-bold animate-pulse">Cargando...</p>
        </div>
      </div>
    );
  }

  if (window.location.pathname === '/viewadmin') {
    return <AdminPage />;
  }

  if (window.location.pathname === '/admin-topglobales') {
    return <AdminTopGlobales />;
  }

  if (!isStreamActive) {
    return (
      <LandingPage
        channels={channels}
        inputChannel={inputChannel}
        setInputChannel={setInputChannel}
        addChannel={addChannel}
        removeChannel={removeChannel}
        startStream={startStream}
      />
    );
  }

  return (
    <div className="flex h-screen w-full bg-kick-dark text-white overflow-hidden relative">
      <div className="flex-1 flex flex-col h-full min-w-0 transition-all duration-300">
        <header className="relative h-14 bg-kick-gray border-b border-white/5 grid grid-cols-[1fr_auto_1fr] items-center px-4 shrink-0 z-20">
          <div className="flex items-center gap-4 justify-self-start min-w-0">
            <button onClick={() => setIsStreamActive(false)} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white cursor-pointer" title="Volver al inicio">
              <ArrowLeft size={20} />
            </button>
            <div className="h-6 w-px bg-white/10"></div>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8"><img src="https://kick.com/img/kick-logo.svg" alt="Kick Logo" className="w-full h-full object-contain" /></div>
              {!isTopGlobales && <span className="font-bold text-white/90 hidden sm:block">MultiKick</span>}
            </div>
          </div>

          <div className="justify-self-center flex justify-center min-w-0">
            {isTopGlobales && (
              <div className="hidden md:flex items-center gap-2 pointer-events-none z-30 whitespace-nowrap">
                <span className="text-lg font-black italic tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-kick-green via-white to-kick-green animate-pulse">
                  ★ LOS TOP GLOBALES ({Object.values(channelViewers).reduce((a, b) => a + b, 0).toLocaleString()} VIEWERS) ★
                </span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 justify-self-end shrink-0">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex items-center justify-center p-2 rounded-lg bg-kick-green text-black hover:bg-kick-green/80 transition-all mr-2 cursor-pointer"
              title="Compartir Multi Stream"
            >
              <Share2 size={20} />
            </button>

            <button onClick={handleReset} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-white/5 text-red-400 hover:bg-red-500/20 transition-all mr-2 cursor-pointer">
              <LogOut size={16} /><span className="hidden sm:inline">Salir</span>
            </button>
            <button onClick={triggerMuteAll} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold bg-white/5 text-gray-200 hover:text-red-400 transition-all cursor-pointer">
              <VolumeX size={16} /><span className="hidden sm:inline">Mutear Todos</span>
            </button>
            <button onClick={() => setIsChatOpen(!isChatOpen)} className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-bold transition-all cursor-pointer ${isChatOpen ? 'bg-kick-green text-black' : 'bg-white/5 text-gray-400'}`}>
              <MessageSquare size={16} /><span className="hidden sm:inline">Chat</span>
            </button>
          </div>
        </header>

        <main className={`flex-1 relative overflow-hidden bg-black/50 ${getGridClass()}`}>
          {channels.map((channel) => {
            if (maximizedChannel && maximizedChannel !== channel) return null;
            return (
              <div key={channel} className={`${getItemClasses(channels.length)} p-0.5 border-2 border-transparent hover:border-white/5 transition-all`}>
                <KickPlayer
                  channel={channel}
                  onRemove={removeChannel}
                  shouldMuteAll={shouldMuteAll}
                  isMaximized={maximizedChannel === channel}
                  onToggleMaximize={() => {
                    setMaximizedChannel(maximizedChannel === channel ? null : channel);
                    setActiveChat(channel);
                  }}
                  onMetaUpdate={handleMetaUpdate}
                  onViewersUpdate={handleViewersUpdate}
                />
              </div>
            );
          })}
        </main>
      </div>

      <div className={`flex-shrink-0 bg-kick-gray border-l border-white/5 transition-all duration-300 flex flex-col overflow-hidden fixed inset-0 z-50 md:relative md:inset-auto md:h-full md:z-0 ${isChatOpen ? 'w-full md:w-64 lg:w-96 translate-x-0' : 'w-0 translate-x-full opacity-0 pointer-events-none md:pointer-events-auto'}`}>
        <div className="h-14 border-b border-white/5 flex items-center px-3 py-2 shrink-0 gap-2 z-50 bg-kick-gray">
          <button onClick={() => setIsChatOpen(false)} className="md:hidden p-2 text-gray-400 hover:text-white"><ArrowLeft size={20} /></button>
          <div className="relative w-full">
            <button onClick={() => setIsChatOpen(prev => prev === 'dropdown' ? true : 'dropdown')} className="w-full flex items-center justify-between bg-white/5 border border-white/10 rounded-lg px-3 py-2 transition-all cursor-pointer">
              <div className="flex items-center gap-3 overflow-hidden">
                {activeChat && channelAvatars[activeChat] ? (
                  <img src={channelAvatars[activeChat]} alt={activeChat} className="w-6 h-6 rounded-full object-cover" />
                ) : (
                  <div className="w-6 h-6 rounded-full bg-kick-green flex items-center justify-center text-black text-[10px] font-bold uppercase">{activeChat?.substring(0, 2)}</div>
                )}
                <span className="font-bold text-sm text-white truncate">{activeChat ? `chat de ${activeChat}` : 'Selecciona un chat'}</span>
              </div>
            </button>
            {isChatOpen === 'dropdown' && (
              <div className="absolute top-full left-0 w-full mt-2 bg-kick-dark border border-white/10 rounded-lg shadow-2xl z-[100] flex flex-col max-h-[60vh] overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                {channels.map(c => (
                  <button key={c} onClick={() => { setActiveChat(c); setIsChatOpen(true); }} className={`flex items-center gap-3 px-3 py-3 text-sm transition-colors hover:bg-white/5 ${activeChat === c ? 'bg-white/10 text-white' : 'text-gray-400'}`}>
                    {channelAvatars[c] ? (
                      <img src={channelAvatars[c]} alt={c} className={`w-6 h-6 rounded-full object-cover border border-white/10 ${activeChat === c ? 'ring-2 ring-kick-green' : ''}`} />
                    ) : (
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-[10px] font-bold uppercase border border-white/10 ${activeChat === c ? 'bg-kick-green text-black' : 'bg-black text-gray-500'}`}>
                        {c.substring(0, 2)}
                      </div>
                    )}
                    <span className={activeChat === c ? 'font-bold' : ''}>chat de {c}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex-1 bg-black flex flex-col min-h-0 relative">
          <div className="relative flex-1 min-h-0 flex flex-col">
            {activeChat ? <KickChat channel={activeChat} active={true} userData={userData} onPermissionsUpdate={handlePermissionsUpdate} /> : <div className="flex items-center justify-center h-full text-gray-500 text-sm">No chat selected</div>}
          </div>
          <ChatInput activeChat={activeChat} userToken={userToken} userData={userData} onLogout={handleUserLogout} onLogin={handleLoginClick} onTokenUpdate={handleTokenUpdate} permissions={chatPermissions} />
        </div>
      </div>

      {showShareModal && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-kick-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-bold text-white flex items-center gap-2">
                <Share2 size={24} className="text-kick-green" />
                Compartir Multi Kick
              </h3>
              <button
                onClick={() => setShowShareModal(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <X size={24} />
              </button>
            </div>

            <p className="text-gray-400 text-sm mb-4">
              Copia este enlace para compartir tu configuración actual de streams con amigos.
            </p>

            <div className="relative group">
              <div className="w-full bg-black/50 border border-white/10 rounded-xl p-4 text-gray-300 font-mono text-sm break-all pr-12 focus-within:border-kick-green/50 transition-colors">
                {window.location.href}
              </div>
              <button
                onClick={handleCopyUrl}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white transition-all active:scale-95"
                title="Copiar enlace"
              >
                {copied ? <Check size={18} className="text-kick-green" /> : <Copy size={18} />}
              </button>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setShowShareModal(false)}
                className="bg-white/5 hover:bg-white/10 text-white font-bold py-2 px-4 rounded-xl transition-colors text-sm"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;