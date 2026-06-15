import React, { useState, useEffect, useRef } from 'react';
import Pusher from 'pusher-js';
import { Plus, ArrowLeft, X, Share2, Copy, Check, LogOut, MessageSquare, ShieldCheck, Gem, Star, Crown } from 'lucide-react';
import ChatInput from './ChatInput';
import { initiateLogin, fetchCurrentUser, refreshAccessToken } from '../utils/kickAuth';
import { getChannelInfo, get7TVEmotes, get7TVGlobalEmotes, getChannelEmotes } from '../utils/kickApi';

const KICK_PUSHER_KEY = '32cbd69e4b950bf97679';
const KICK_PUSHER_CLUSTER = 'us2';

const DobleChatPage = () => {
    const [channels, setChannels] = useState([]);
    const [inputChannel, setInputChannel] = useState('');
    const [channelAvatars, setChannelAvatars] = useState({});
    const [chatroomIds, setChatroomIds] = useState({});
    const [connectionStatuses, setConnectionStatuses] = useState({});
    const [emoteMap, setEmoteMap] = useState({});
    const [messages, setMessages] = useState([]);
    const [permissionsMap, setPermissionsMap] = useState({});
    const [activeSendChannel, setActiveSendChannel] = useState('');
    
    const [copied, setCopied] = useState(false);
    const [showShareModal, setShowShareModal] = useState(false);

    // Scroll States
    const containerRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);

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

    const userDataRef = useRef(userData);
    useEffect(() => {
        userDataRef.current = userData;
    }, [userData]);

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

            // Extract path segments after '/doblechat'
            const pathname = window.location.pathname;
            let pathChannels = [];
            if (pathname.startsWith('/doblechat/')) {
                const afterChat = pathname.substring(11); // length of '/doblechat/' is 11
                pathChannels = afterChat.split(/[\/, ]+/).map(c => c.trim()).filter(c => c.length > 0);
            }

            const allChannels = [...pathChannels, ...queryChannels]
                .map(c => c.trim())
                .filter(c => c.length > 0);

            // Cap at 9 unique channels
            const uniqueChannels = [...new Set(allChannels)].slice(0, 9);
            setChannels(uniqueChannels);
            if (uniqueChannels.length > 0) {
                setActiveSendChannel(uniqueChannels[0]);
            }
        };

        initializeChannels();
    }, []);

    // Resolve channel information & emotes per channel
    useEffect(() => {
        let isMounted = true;

        channels.forEach(async (channel) => {
            if (chatroomIds[channel]) return; // already fetched

            try {
                setConnectionStatuses(prev => ({ ...prev, [channel]: 'Obteniendo info...' }));
                const data = await getChannelInfo(channel);
                if (!isMounted) return;

                if (data && data.chatroom && data.chatroom.id) {
                    const cid = data.chatroom.id;
                    setChatroomIds(prev => ({ ...prev, [channel]: cid }));
                    setConnectionStatuses(prev => ({ ...prev, [channel]: 'Conectando...' }));

                    if (data.user?.profile_pic) {
                        setChannelAvatars(prev => ({ ...prev, [channel]: data.user.profile_pic }));
                    }

                    // Load Emotes
                    const userId = data.user_id || data.id;
                    const channelEmotes = await get7TVEmotes(userId);
                    const globalEmotes = await get7TVGlobalEmotes();
                    const kickChannelEmotes = await getChannelEmotes(channel);

                    const map = {};
                    [...globalEmotes, ...channelEmotes].forEach(e => {
                        map[e.name] = e.data.host.url + '/2x.webp';
                    });

                    if (Array.isArray(kickChannelEmotes)) {
                        const allEmotes = kickChannelEmotes.flatMap(category => category.emotes || []);
                        allEmotes.forEach(e => {
                            if (e.id && e.name) {
                                map[e.name] = `https://files.kick.com/emotes/${e.id}/fullsize`;
                            }
                        });
                    }

                    setEmoteMap(prev => ({ ...prev, ...map }));
                } else {
                    setConnectionStatuses(prev => ({ ...prev, [channel]: 'Error: Sin Chat' }));
                }
            } catch (e) {
                console.error("Error resolving channel in DobleChatPage", channel, e);
                if (isMounted) {
                    setConnectionStatuses(prev => ({ ...prev, [channel]: 'Error' }));
                }
            }
        });

        return () => { isMounted = false; };
    }, [channels, chatroomIds]);

    // Handle Pusher Subscriptions
    useEffect(() => {
        // Filter chatroomIds down to active channels only
        const activeChannels = Object.keys(chatroomIds).filter(c => channels.includes(c));
        if (activeChannels.length === 0) return;

        const pusher = new Pusher(KICK_PUSHER_KEY, {
            cluster: KICK_PUSHER_CLUSTER,
            encrypted: true,
            forceTLS: true,
            disableStats: true,
            enabledTransports: ['ws', 'wss']
        });

        const subscriptions = [];

        activeChannels.forEach(channelName => {
            const chatroomId = chatroomIds[channelName];
            const pusherChannelName = `chatrooms.${chatroomId}.v2`;
            const sub = pusher.subscribe(pusherChannelName);
            subscriptions.push({ sub, name: pusherChannelName, channelName });

            sub.bind('pusher:subscription_succeeded', () => {
                setConnectionStatuses(prev => ({ ...prev, [channelName]: 'Conectado' }));
            });

            sub.bind('App\\Events\\ChatMessageEvent', (data) => {
                let parsed = data;
                if (typeof data === 'string') {
                    try { parsed = JSON.parse(data); } catch (e) { }
                }

                // Stamp with source channel
                const messageWithChannel = {
                    ...parsed,
                    channel: channelName
                };

                setMessages(prev => {
                    const newMsgs = [...prev, messageWithChannel];
                    if (newMsgs.length > 200) return newMsgs.slice(-200);
                    return newMsgs;
                });

                // Permissions detection (for self user)
                const currentUser = userDataRef.current;
                if (currentUser && parsed?.sender?.username?.toLowerCase() === currentUser?.username?.toLowerCase()) {
                    const badges = parsed.sender.identity?.badges || [];
                    let isSub = false;
                    let isMod = false;
                    let isBroadcaster = false;

                    badges.forEach(b => {
                        const t = (b.type || b.name || '').toLowerCase();
                        if (t === 'subscriber' || t === 'founder' || t === 'og') isSub = true;
                        if (t === 'moderator') isMod = true;
                        if (t === 'broadcaster') isBroadcaster = true;
                    });

                    setPermissionsMap(prev => ({
                        ...prev,
                        [channelName]: { ...prev[channelName], isSubscriber: isSub, isModerator: isMod, isBroadcaster: isBroadcaster }
                    }));
                }
            });
        });

        return () => {
            subscriptions.forEach(s => {
                pusher.unsubscribe(s.name);
            });
            pusher.disconnect();
        };
    }, [chatroomIds, channels]);

    const autoScrollRef = useRef(autoScroll);
    useEffect(() => {
        autoScrollRef.current = autoScroll;
    }, [autoScroll]);

    const handleImageLoad = () => {
        if (autoScrollRef.current && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    };

    // Auto Scroll effect
    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
            const timer = setTimeout(() => {
                if (containerRef.current) {
                    containerRef.current.scrollTop = containerRef.current.scrollHeight;
                }
            }, 50);
            return () => clearTimeout(timer);
        }
    }, [messages, autoScroll]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 150;
        setAutoScroll(isAtBottom);
    };

    const scrollToBottom = () => {
        setAutoScroll(true);
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    };

    const updateUrl = (newChannels) => {
        const path = newChannels.length > 0 ? `/doblechat/${newChannels.join(',')}` : '/doblechat';
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
            alert("Máximo 9 canales permitidos.");
            return;
        }

        setChannels(currentChannels);
        setInputChannel('');
        updateUrl(currentChannels);
        if (!activeSendChannel && currentChannels.length > 0) {
            setActiveSendChannel(currentChannels[0]);
        }
    };

    const removeChannel = (channelToRemove) => {
        const newChannels = channels.filter(c => c !== channelToRemove);
        setChannels(newChannels);
        updateUrl(newChannels);

        // Reset active send channel if removed
        if (activeSendChannel === channelToRemove) {
            setActiveSendChannel(newChannels.length > 0 ? newChannels[0] : '');
        }

        // Clean up metadata states
        setChatroomIds(prev => { const copy = { ...prev }; delete copy[channelToRemove]; return copy; });
        setConnectionStatuses(prev => { const copy = { ...prev }; delete copy[channelToRemove]; return copy; });
        setPermissionsMap(prev => { const copy = { ...prev }; delete copy[channelToRemove]; return copy; });
    };

    const handleCopyUrl = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleLoginClick = () => {
        const appState = { channels, isChatPage: false, isDobleChatPage: true };
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

    // Chat Message Helpers (Emotes, badging, text parsing)
    const renderTextWith7TV = (text, keyPrefix) => {
        if (!text) return null;
        const words = text.split(' ');
        const urlRegex = /^(https?:\/\/[^\s]+)/;

        return words.map((word, i) => {
            if (emoteMap[word]) {
                return (
                    <img
                        key={`${keyPrefix}-${i}`}
                        src={emoteMap[word]}
                        alt={word}
                        title={word}
                        className="inline-block h-8 align-middle mx-1"
                        onLoad={handleImageLoad}
                    />
                );
            }

            if (urlRegex.test(word)) {
                return (
                    <span key={`${keyPrefix}-${i}`}>
                        <a
                            href={word}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-kick-green hover:underline break-all"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {word}
                        </a>
                        {i < words.length - 1 ? ' ' : ''}
                    </span>
                );
            }

            return word + (i < words.length - 1 ? ' ' : '');
        });
    };

    const renderContent = (content) => {
        if (!content) return null;

        const kickEmoteRegex = /\[emote:(\d+):([\w]+)\]/g;
        const result = [];
        let lastIndex = 0;
        let match;

        while ((match = kickEmoteRegex.exec(content)) !== null) {
            if (match.index > lastIndex) {
                const textBefore = content.substring(lastIndex, match.index);
                result.push(renderTextWith7TV(textBefore, `text-${lastIndex}`));
            }

            const emoteId = match[1];
            const emoteName = match[2];
            result.push(
                <img
                    key={`kick-${match.index}`}
                    src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
                    alt={emoteName}
                    title={emoteName}
                    className="inline-block h-6 align-middle mx-0.5"
                    onLoad={handleImageLoad}
                />
            );

            lastIndex = kickEmoteRegex.lastIndex;
        }

        if (lastIndex < content.length) {
            const remainingText = content.substring(lastIndex);
            result.push(renderTextWith7TV(remainingText, `text-end-${lastIndex}`));
        }

        return result;
    };

    const renderBadges = (badges) => {
        if (!badges || !Array.isArray(badges)) return null;

        return badges.map((badge, i) => {
            const type = (badge.type || badge.name || '').toLowerCase();

            switch (type) {
                case 'broadcaster':
                    return (
                        <span key={i} title="Broadcaster" className="mr-1">
                            <Crown size={14} className="text-yellow-500 fill-yellow-500/20" />
                        </span>
                    );
                case 'moderator':
                    return (
                        <img key={i} src="/iconos/mod.svg" alt="Moderator" title="Moderator" className="w-3.5 h-3.5 mr-1 inline-block align-middle" />
                    );
                case 'verified':
                case 'partner':
                    return (
                        <img key={i} src="/iconos/verified.svg" alt="Verified" title="Verified" className="w-3.5 h-3.5 mr-1 inline-block align-middle" />
                    );
                case 'vip':
                    return (
                        <span key={i} title="VIP" className="mr-1">
                            <Gem size={14} className="text-pink-500 fill-pink-500/20" />
                        </span>
                    );
                case 'subscriber':
                case 'founder':
                    return (
                        <span key={i} title="Subscriber" className="mr-1">
                            <Star size={14} className="text-kick-green" />
                        </span>
                    );
                case 'og':
                    return (
                        <span key={i} title="OG" className="mr-1 inline-flex items-center justify-center bg-zinc-700 text-white rounded text-[8px] font-bold px-1 h-3.5">
                            OG
                        </span>
                    );
                default:
                    return null;
            }
        });
    };

    return (
        <div className="flex flex-col h-screen w-full bg-kick-dark text-white overflow-hidden relative font-sans">
            {/* Background glow elements */}
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
                        <span className="font-bold text-white/95 hidden sm:block whitespace-nowrap">MultiKick <span className="text-kick-green">Doble Chat</span></span>
                    </div>
                </div>

                {channels.length > 0 && (
                    <div className="flex-1 flex justify-center max-w-md px-4">
                        <form onSubmit={addChannel} className="relative flex items-center gap-1.5 w-full bg-white/5 border border-white/10 rounded-xl px-3 py-1.5 focus-within:border-kick-green/50 transition-colors">
                            <input
                                type="text"
                                value={inputChannel}
                                onChange={(e) => setInputChannel(e.target.value)}
                                placeholder="Agregar canal (ej. goncho)"
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
                            title="Compartir Doble Chat"
                        >
                            <Share2 size={18} />
                        </button>
                    )}
                </div>
            </header>

            {/* Main Content Dashboard */}
            <main className="flex-grow relative overflow-hidden z-10 flex flex-col h-[calc(100vh-3.5rem)]">
                {channels.length === 0 ? (
                    /* Empty Landing State */
                    <div className="flex-1 flex flex-col items-center justify-center p-6 animate-in fade-in zoom-in duration-500">
                        <div className="mb-8 flex flex-col items-center">
                            <div className="w-20 h-20 flex items-center justify-center mb-4">
                                <MessageSquare size={64} className="text-kick-green" />
                            </div>
                            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-center">
                                MultiKick <span className="text-kick-green">Doble Chat</span>
                            </h1>
                            <p className="text-gray-400 mt-2 text-center max-w-md text-sm">
                                Combina múltiples salas de chat de Kick en una única pantalla unificada. Cada mensaje indica claramente a qué canal pertenece.
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
                                    placeholder="Agregar canales separados por comas"
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
                                <span className="text-gray-500 select-none">multikick.lat/doblechat/</span>
                                <span className="text-kick-green font-bold">pablo</span>
                                <span className="text-gray-600">,</span>
                                <span className="text-kick-green font-bold">coker</span>
                            </div>
                        </div>
                    </div>
                ) : (
                    /* Unified Single Chat Column */
                    <div className="flex-1 p-4 flex flex-col justify-center items-center h-full">
                        <div className="w-full max-w-3xl h-full bg-kick-surface border border-white/10 rounded-2xl flex flex-col overflow-hidden shadow-2xl relative">
                            {/* Connected Channels List */}
                            <div className="bg-white/5 border-b border-white/5 px-4 py-2 flex flex-wrap items-center gap-2 shrink-0 select-none max-h-20 overflow-y-auto">
                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide mr-1">Conectados:</span>
                                {channels.map(c => {
                                    const status = connectionStatuses[c]?.toLowerCase() || '';
                                    const isConnected = status.includes('conectado') || status.includes('online');
                                    const isErr = status.includes('error');
                                    let dotColor = 'bg-yellow-500';
                                    if (isConnected) dotColor = 'bg-kick-green';
                                    if (isErr) dotColor = 'bg-red-500';

                                    return (
                                        <div key={c} className="flex items-center gap-1.5 bg-black/30 border border-white/5 rounded-full pl-1.5 pr-2.5 py-0.5 text-[10px] font-bold">
                                            <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`}></span>
                                            {channelAvatars[c] && <img src={channelAvatars[c]} className="w-3 h-3 rounded-full object-cover" />}
                                            <span className="text-white/95">{c}</span>
                                            <button onClick={() => removeChannel(c)} className="ml-1 text-gray-500 hover:text-red-400 transition-colors">
                                                <X size={10} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Unified Live Messages list */}
                            <div className="flex-1 bg-black flex flex-col min-h-0 relative">
                                <div
                                    ref={containerRef}
                                    onScroll={handleScroll}
                                    className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar relative font-sans text-sm"
                                >
                                    {messages.length === 0 && (
                                        <div className="text-center text-gray-500 mt-16 italic opacity-55">
                                            Esperando mensajes unificados de {channels.join(', ')}...
                                        </div>
                                    )}

                                    {messages.map((msg, i) => (
                                        <div key={msg.id || i} className="group break-words leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                                            {/* Channel Capsule */}
                                            <span className="inline-flex items-center gap-1.5 bg-white/5 border border-white/10 rounded-full pl-1 pr-2 py-0.5 text-[10px] font-black text-gray-300 select-none mr-2.5 relative -top-[1px] align-middle">
                                                {channelAvatars[msg.channel] ? (
                                                    <img src={channelAvatars[msg.channel]} className="w-3.5 h-3.5 rounded-full object-cover" onLoad={handleImageLoad} />
                                                ) : (
                                                    <div className="w-3.5 h-3.5 rounded-full bg-kick-green text-black text-[8px] flex items-center justify-center uppercase font-black">{msg.channel.substring(0, 2)}</div>
                                                )}
                                                {msg.channel}
                                            </span>

                                            {/* Standard Badges */}
                                            <span className="mr-1.5 align-middle inline-flex items-center gap-0.5 select-none relative -top-[1px]">
                                                {renderBadges(msg.sender?.identity?.badges)}
                                            </span>

                                            {/* Username */}
                                            <span
                                                className="font-bold hover:underline cursor-pointer mr-0.5 align-middle"
                                                style={{ color: msg.sender?.identity?.color || '#53fc18' }}
                                            >
                                                {msg.sender?.username}
                                            </span>
                                            <span className="text-gray-400 mr-1.5 align-middle">:</span>

                                            {/* Message Content */}
                                            <span className="text-gray-300 align-middle">
                                                {renderContent(msg.content)}
                                            </span>
                                        </div>
                                    ))}
                                </div>

                                {/* Pause Chat/Scroll back to bottom banner */}
                                {!autoScroll && (
                                    <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
                                        <button
                                            onClick={scrollToBottom}
                                            className="pointer-events-auto bg-black/90 text-white border border-kick-green/50 px-4 py-2 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(83,252,24,0.35)] hover:bg-kick-green hover:text-black transition-all flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2 cursor-pointer"
                                        >
                                            <span>Chat Pausado</span>
                                            <span className="w-1 h-3 bg-white/20 mx-1"></span>
                                            <span>Volver al final ⬇</span>
                                        </button>
                                    </div>
                                )}
                            </div>

                            {/* Chat Target Channel Selector pills */}
                            <div className="bg-kick-surface border-t border-white/5 px-4 py-2 flex items-center gap-2 overflow-x-auto shrink-0 select-none scrollbar-none">
                                <span className="text-xs font-bold text-gray-400 whitespace-nowrap mr-1">Chatear en:</span>
                                {channels.map(c => (
                                    <button
                                        key={c}
                                        onClick={() => setActiveSendChannel(c)}
                                        className={`px-3 py-1 rounded-full text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer shrink-0 ${activeSendChannel === c ? 'bg-kick-green text-black border-kick-green' : 'bg-white/5 text-gray-400 border-white/5 hover:text-white'}`}
                                    >
                                        {channelAvatars[c] && <img src={channelAvatars[c]} className="w-3.5 h-3.5 rounded-full object-cover" />}
                                        <span>{c}</span>
                                    </button>
                                ))}
                            </div>

                            {/* Chat Input */}
                            <div className="shrink-0 bg-kick-surface">
                                <ChatInput
                                    activeChat={activeSendChannel}
                                    userToken={userToken}
                                    userData={userData}
                                    onLogout={handleUserLogout}
                                    onLogin={handleLoginClick}
                                    onTokenUpdate={handleTokenUpdate}
                                    permissions={permissionsMap[activeSendChannel] || { isSubscriber: false, isBroadcaster: false, isModerator: false }}
                                />
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* Share link Modal */}
            {showShareModal && (
                <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-kick-surface border border-white/10 rounded-2xl w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <Share2 size={24} className="text-kick-green" />
                                Compartir Doble Chat
                            </h3>
                            <button
                                onClick={() => setShowShareModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        <p className="text-gray-400 text-sm mb-4">
                            Copia este enlace para compartir tu configuración actual de chat unificado.
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

export default DobleChatPage;
