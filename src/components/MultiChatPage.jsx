import React, { useState, useEffect, useCallback } from 'react';
import { Plus, ArrowLeft, X, Share2, Copy, Check, LogOut, MessageSquare, User } from 'lucide-react';
import KickChat from './KickChat';
import ChatInput from './ChatInput';
import { initiateLogin, fetchCurrentUser, refreshAccessToken } from '../utils/kickAuth';
import { getChannelInfo } from '../utils/kickApi';

const MultiChatPage = () => {
    const [channels, setChannels] = useState([]);
    const [inputChannel, setInputChannel] = useState('');
    const [channelAvatars, setChannelAvatars] = useState({});
    const [permissionsMap, setPermissionsMap] = useState({});
    const [copied, setCopied] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    // Auth States
    const [userToken, setUserToken] = useState(localStorage.getItem('kick_access_token'));
    const [userData, setUserData] = useState(() => {
        try {
            const stored = localStorage.getItem('kick_user');
            return stored ? JSON.parse(stored) : null;
        } catch (e) {
            return null;
        }
    });

    // Handle token refresh/load user data
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
                            setUserData(null);
                        }
                    } else {
                        localStorage.removeItem('kick_access_token');
                        setUserToken(null);
                        setUserData(null);
                    }
                });
        }
    }, [userToken, userData]);

    // Parse channels from URL on mount
    useEffect(() => {
        const initializeChannels = () => {
            const params = new URLSearchParams(window.location.search);
            const queryChannels = params.get('channels')?.split(',') || [];

            // Extract path segments after '/chat'
            const pathname = window.location.pathname;
            let pathChannels = [];
            if (pathname.startsWith('/chat/')) {
                const afterChat = pathname.substring(6); // length of '/chat/' is 6
                pathChannels = afterChat.split(/[\/, ]+/).map(c => c.trim()).filter(c => c.length > 0);
            }

            const allChannels = [...pathChannels, ...queryChannels]
                .map(c => c.trim())
                .filter(c => c.length > 0);

            // Cap at 9 unique channels
            const uniqueChannels = [...new Set(allChannels)].slice(0, 9);
            setChannels(uniqueChannels);
        };

        initializeChannels();
    }, []);

    // Fetch channel avatars when channels change
    useEffect(() => {
        channels.forEach(channel => {
            if (!channelAvatars[channel]) {
                getChannelInfo(channel).then(data => {
                    if (data?.user?.profile_pic) {
                        setChannelAvatars(prev => ({
                            ...prev,
                            [channel]: data.user.profile_pic
                        }));
                    }
                }).catch(err => {
                    console.error("Failed to fetch profile picture for", channel, err);
                });
            }
        });
    }, [channels, channelAvatars]);

    const updateUrl = (newChannels) => {
        const path = newChannels.length > 0 ? `/chat/${newChannels.join(',')}` : '/chat';
        window.history.pushState({}, '', path);
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
            alert("Máximo 9 chats permitidos.");
            return;
        }

        setChannels(currentChannels);
        setInputChannel('');
        updateUrl(currentChannels);
    };

    const removeChannel = (channelToRemove) => {
        const newChannels = channels.filter(c => c !== channelToRemove);
        setChannels(newChannels);
        updateUrl(newChannels);

        // Clean up permissions map
        setPermissionsMap(prev => {
            const copy = { ...prev };
            delete copy[channelToRemove];
            return copy;
        });
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLoginClick = () => {
        const appState = { channels, isChatPage: true };
        localStorage.setItem('kick_pre_login_state', JSON.stringify(appState));
        initiateLogin();
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

    const handlePermissionsUpdate = (channel, perms) => {
        setPermissionsMap(prev => ({
            ...prev,
            [channel]: { ...prev[channel], ...perms }
        }));
    };

    const getColumnWidthClass = () => {
        if (channels.length === 1) return 'w-full max-w-2xl mx-auto';
        return 'w-[90vw] sm:w-80 md:w-[350px] lg:w-[380px]';
    };

    return (
        <div className="flex flex-col h-screen w-full bg-kick-dark text-white overflow-hidden relative font-sans">
            {/* Background blur effects */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-kick-green/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]"></div>
            </div>

            {/* Header */}
            <header className="relative h-14 bg-kick-gray border-b border-white/5 flex items-center justify-between px-4 shrink-0 z-20">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={() => window.location.href = '/'}
                        className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white cursor-pointer transition-colors"
                        title="Volver al inicio"
                    >
                        <ArrowLeft size={20} />
                    </button>
                    <div className="h-6 w-px bg-white/10"></div>
                    <div className="flex items-center gap-2">
                        <img src="https://kick.com/img/kick-logo.svg" alt="Kick Logo" className="w-6 h-6 object-contain" />
                        <span className="font-bold text-white/95 hidden sm:block whitespace-nowrap">MultiKick <span className="text-kick-green">Chat</span></span>
                    </div>
                </div>

                {channels.length > 0 && (
                    <div className="flex-1 flex justify-center max-w-md px-4">
                        <form onSubmit={addChannel} className="relative flex items-center gap-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-kick-green/50 transition-colors">
                            <input
                                type="text"
                                value={inputChannel}
                                onChange={(e) => setInputChannel(e.target.value)}
                                placeholder="Agregar canal (ej. zeko)"
                                className="w-full bg-transparent border-none text-white placeholder-gray-500 py-0.5 focus:outline-none focus:ring-0 text-sm"
                            />
                            <button
                                type="submit"
                                disabled={!inputChannel.trim() || channels.length >= 9}
                                className="text-kick-green hover:bg-white/10 p-1 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                            >
                                <Plus size={16} />
                            </button>
                        </form>
                    </div>
                )}

                <div className="flex items-center gap-2 shrink-0">
                    {channels.length > 0 && (
                        <button
                            onClick={() => setShowShareModal(true)}
                            className="flex items-center justify-center p-2 rounded-lg bg-kick-green text-black hover:bg-kick-green/80 transition-all cursor-pointer"
                            title="Compartir Multi Chat"
                        >
                            <Share2 size={18} />
                        </button>
                    )}
                </div>
            </header>

            {/* Main Area */}
            <main className="flex-1 relative overflow-hidden z-10 flex flex-col h-[calc(100vh-3.5rem)]">
                {channels.length === 0 ? (
                    /* Empty Landing State */
                    <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
                        <div className="mb-8 flex flex-col items-center">
                            <div className="w-20 h-20 flex items-center justify-center mb-4">
                                <MessageSquare size={64} className="text-kick-green" />
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">
                                MultiKick <span className="text-kick-green">Chat</span>
                            </h1>
                            <p className="text-gray-400 mt-2 text-center max-w-md text-sm">
                                Mira y participa de múltiples chats de Kick.com a la vez en una grilla de columnas. Sin streams de video para ahorrar ancho de banda.
                            </p>
                        </div>

                        <div className="w-full max-w-md bg-kick-surface/50 p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl mb-8">
                            <form onSubmit={addChannel} className="relative flex items-center gap-2">
                                <div className="absolute left-4 text-gray-500">
                                    <MessageSquare size={20} />
                                </div>
                                <input
                                    type="text"
                                    value={inputChannel}
                                    onChange={(e) => setInputChannel(e.target.value)}
                                    placeholder="Nombre del canal o canales (ej. Coscu, zeko)"
                                    className="w-full bg-transparent border-none text-white placeholder-gray-500 pl-12 pr-4 py-3 focus:outline-none focus:ring-0 text-base"
                                    autoFocus
                                />
                                <button
                                    type="submit"
                                    disabled={!inputChannel.trim()}
                                    className="bg-kick-green hover:bg-kick-green/90 text-black font-bold p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                                >
                                    <Plus size={20} strokeWidth={3} />
                                </button>
                            </form>
                        </div>

                        <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2">
                            <p className="text-gray-400 text-xs text-center">Formato de URL directo:</p>
                            <div className="font-mono text-xs">
                                <span className="text-gray-500 select-none">multikick.lat/chat/</span>
                                <span className="text-kick-green font-bold">zeko</span>
                                <span className="text-gray-600">,</span>
                                <span className="text-kick-green font-bold">goncho</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Chats Columns Layout */
                    <div className="flex-1 flex gap-4 overflow-x-auto p-4 select-none h-full scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                        {channels.map((channel) => (
                            <div
                                key={channel}
                                className={`flex flex-col flex-shrink-0 bg-kick-surface border border-white/10 rounded-2xl overflow-hidden h-full shadow-2xl transition-all duration-300 ${getColumnWidthClass()}`}
                            >
                                {/* Column Header */}
                                <div className="h-12 border-b border-white/5 flex items-center justify-between px-3 py-2 bg-kick-gray/80 shrink-0">
                                    <div className="flex items-center gap-2.5 overflow-hidden">
                                        {channelAvatars[channel] ? (
                                            <img
                                                src={channelAvatars[channel]}
                                                alt={channel}
                                                className="w-6 h-6 rounded-full object-cover border border-white/10"
                                            />
                                        ) : (
                                            <div className="w-6 h-6 rounded-full bg-kick-green flex items-center justify-center text-black text-[10px] font-black uppercase shrink-0">
                                                {channel.substring(0, 2)}
                                            </div>
                                        )}
                                        <span className="font-bold text-sm text-white truncate">
                                            {channel}
                                        </span>
                                    </div>

                                    <button
                                        onClick={() => removeChannel(channel)}
                                        className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors cursor-pointer"
                                        title="Cerrar chat"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>

                                {/* Chat Body & Input */}
                                <div className="flex-1 bg-black flex flex-col min-h-0 relative">
                                    <div className="relative flex-1 min-h-0 flex flex-col">
                                        <KickChat
                                            channel={channel}
                                            active={true}
                                            userData={userData}
                                            onPermissionsUpdate={(perms) => handlePermissionsUpdate(channel, perms)}
                                        />
                                    </div>
                                    <ChatInput
                                        activeChat={channel}
                                        userToken={userToken}
                                        userData={userData}
                                        onLogout={handleUserLogout}
                                        onLogin={handleLoginClick}
                                        onTokenUpdate={handleTokenUpdate}
                                        permissions={permissionsMap[channel] || { isSubscriber: false, isBroadcaster: false, isModerator: false }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </main>

            {/* Share Link Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-kick-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Share2 size={24} className="text-kick-green" />
                                Compartir Multi Chat
                            </h3>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <p className="text-gray-400 text-sm mb-4">
                            Copia este enlace para compartir tu configuración actual de chats.
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
};

export default MultiChatPage;
