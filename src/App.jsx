import React, { useState, useEffect } from 'react';
import { Plus, MonitorPlay, MessageSquare, ArrowLeft, X, Play, VolumeX } from 'lucide-react';
import KickPlayer from './components/KickPlayer';
import { initiateLogin, handleCallback } from './utils/kickAuth';

function App() {
  const [channels, setChannels] = useState([]);
  const [inputChannel, setInputChannel] = useState('');
  const [isStreamActive, setIsStreamActive] = useState(false);
  const [activeChat, setActiveChat] = useState('');
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [shouldMuteAll, setShouldMuteAll] = useState(0);
  const [userToken, setUserToken] = useState(localStorage.getItem('kick_access_token'));
  const [authError, setAuthError] = useState(null);

  // Load from URL (Path or Query) on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const queryChannels = params.get('channels')?.split(',') || [];

    // Parse path segments, ignoring common non-channel paths if any (though usually empty on root)
    const pathChannels = window.location.pathname.split('/')
      .map(c => c.trim())
      .filter(c => c.length > 0 && c !== 'index.html'); // Basic filter

    const allChannels = [...pathChannels, ...queryChannels]
      .map(c => c.trim())
      .filter(c => c.length > 0);

    const uniqueChannels = [...new Set(allChannels)].slice(0, 9);

    if (uniqueChannels.length > 0) {
      setChannels(uniqueChannels);
      setActiveChat(uniqueChannels[0]);
      setIsStreamActive(true);
    }
  }, []);

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
            alert("Logged in successfully! You can now use the API chat.");
          }
        })
        .catch(err => {
          console.error("Auth Error", err);
          setAuthError("Login failed: " + err.message);
        });
    }
  }, [userToken]);

  const updateUrl = (newChannels) => {
    const url = new URL(window.location);
    // We will favor the query param for updates to avoid navigation issues, 
    // but the app supports reading the path format /c1/c2/c3
    if (newChannels.length > 0) {
      url.searchParams.set('channels', newChannels.join(','));
    } else {
      url.searchParams.delete('channels');
    }
    // If we want to support the "/a/b/c" URL style on update, we'd do this:
    // window.history.pushState({}, '', '/' + newChannels.join('/'));
    // But for safety with reload/refresh on static hosts, sticking to query params for internal updates is often safer.
    // However, the user specifically asked for that format. Let's try to support writing it too if possible, 
    // but mixing path and query can be complex. 
    // Let's strictly follow the request "dejarme poner los canales asi". 
    // I will stick to query params for *saving* state to avoid breaking relative asset paths,
    // unless the user insists on the URL bar updating to slashes. 
    // The request says "leave me put channels like that AND it opens". This implies reading.
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
      alert("Maximum 9 channels allowed.");
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
    const count = channels.length;
    switch (count) {
      case 0: return 'flex items-center justify-center';
      case 1: return 'grid grid-cols-1';
      case 2: return 'grid grid-cols-1 md:grid-cols-2';
      case 3: return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3';
      case 4: return 'grid grid-cols-2';
      case 5:
      case 6: return 'grid grid-cols-2 lg:grid-cols-3';
      case 7:
      case 8:
      case 9: return 'grid grid-cols-2 md:grid-cols-3';
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
              Build your ultimate command center. Watch up to 9 streams simultaneously with zero lag.
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
                placeholder="Add Channel (e.g. adinross)"
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
        <div className="absolute bottom-6 text-gray-600 text-sm">
          Powered by Kick.com
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
              title="Back to Setup"
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
          {channels.map((channel) => (
            <div key={channel} className="w-full h-full p-0.5 border-2 border-transparent hover:border-white/5 transition-all">
              <KickPlayer channel={channel} onRemove={removeChannel} shouldMuteAll={shouldMuteAll} />
            </div>
          ))}
        </main>
      </div>

      {/* Right Sidebar (Chat) */}
      <div
        className={`flex-shrink-0 bg-kick-gray border-l border-white/5 transition-all duration-300 flex flex-col ${isChatOpen ? 'w-80 md:w-96 translate-x-0' : 'w-0 translate-x-full opacity-0'
          }`}
      >
        {/* Chat Header / Dropdown */}
        <div className="h-14 border-b border-white/5 flex items-center p-3 shrink-0 gap-2">
          <MessageSquare size={18} className="text-kick-green" />
          <div className="flex-1 relative">
            <select
              value={activeChat}
              onChange={(e) => setActiveChat(e.target.value)}
              className="w-full bg-black/30 border border-white/10 text-white text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-kick-green appearance-none cursor-pointer hover:bg-black/50 transition-colors"
            >
              {channels.map(c => (
                <option key={c} value={c} className="bg-kick-gray text-white">
                  {c}'s Chat
                </option>
              ))}
            </select>
            {/* Custom Arrow */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-400">
              <svg width="10" height="6" viewBox="0 0 10 6" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          </div>
        </div>

        {/* Chat Embed */}
        <div className="flex-1 bg-black flex flex-col min-h-0">
          <div className="bg-yellow-500/10 border-b border-yellow-500/20 p-4 text-center text-xs text-yellow-200 shrink-0">
            {userToken ? (
              <div className="text-green-400 font-bold mb-2">
                ✅ Conectado con API
              </div>
            ) : (
              <>
                <p className="font-bold text-sm mb-1">⚠ ¿No apareces logueado?</p>
                <p className="mb-2 opacity-80">Los navegadores bloquean la sesión en iframes.</p>
                <button
                  onClick={initiateLogin}
                  className="block w-full bg-kick-green hover:bg-kick-green/90 text-black py-2 rounded font-bold transition-colors mb-2"
                >
                  🔐 Conectar tu Cuenta (API)
                </button>
                <p className="text-[10px] opacity-60 mb-2">Esto habilitará el envío de mensajes desde aquí.</p>
              </>
            )}

            <p className="mb-1 opacity-80 border-t border-white/10 pt-2">Alternativa:</p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => window.open(`https://kick.com/popout/${activeChat}/chat`, 'KickChat', 'width=400,height=600')}
                className="block w-full bg-white/10 hover:bg-white/20 text-white py-1.5 rounded font-semibold transition-colors"
              >
                Abrir Chat en Popout
              </button>
            </div>
          </div>

          <div className="relative flex-1 min-h-0">
            {activeChat ? (
              <iframe
                title={`${activeChat} chat`}
                src={`https://kick.com/popout/${activeChat}/chat`}
                className="absolute inset-0 w-full h-full border-none"
              />
            ) : (
              <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                No chat selected
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}

export default App;
