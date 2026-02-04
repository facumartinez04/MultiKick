import React, { useEffect, useState, useRef } from 'react';
import Pusher from 'pusher-js';
import { getChannelInfo, get7TVEmotes, get7TVGlobalEmotes } from '../utils/kickApi';
import { ShieldCheck, Gem, Star, Crown } from 'lucide-react';

const KICK_PUSHER_KEY = '32cbd69e4b950bf97679';
const KICK_PUSHER_CLUSTER = 'us2';

const KickChat = ({ channel, active }) => {
    const [messages, setMessages] = useState([]);
    const [chatroomId, setChatroomId] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const [emoteMap, setEmoteMap] = useState({}); // { name: url }

    const bottomRef = useRef(null);
    const pusherRef = useRef(null);
    const channelRef = useRef(null);

    // 1. Fetch Chatroom ID & 7TV Emotes
    useEffect(() => {
        if (!channel) return;

        const fetchInfo = async () => {
            setConnectionStatus('Fetching Info...');
            setMessages([]); // Clear on channel switch
            try {
                const data = await getChannelInfo(channel);
                if (data && data.chatroom && data.chatroom.id) {
                    setChatroomId(data.chatroom.id);
                    setConnectionStatus('Connecting Socket...');

                    // Fetch 7TV Emotes for this channel
                    const userId = data.user_id || data.id;
                    const channelEmotes = await get7TVEmotes(userId);
                    const globalEmotes = await get7TVGlobalEmotes();

                    // Create lookup map
                    const map = {};
                    [...globalEmotes, ...channelEmotes].forEach(e => {
                        map[e.name] = e.data.host.url + '/2x.webp';
                    });
                    setEmoteMap(map);

                } else {
                    setConnectionStatus('Error: No Chatroom ID');
                }
            } catch (e) {
                console.error("Chat info error", e);
                setConnectionStatus('Error Fetching Info');
            }
        };

        fetchInfo();
    }, [channel]);

    // 2. Connect Pusher
    useEffect(() => {
        if (!chatroomId) return;

        // Cleanup old connection
        if (pusherRef.current) {
            pusherRef.current.disconnect();
        }

        const pusher = new Pusher(KICK_PUSHER_KEY, {
            cluster: KICK_PUSHER_CLUSTER,
            encrypted: true,
            forceTLS: true,
            disableStats: true,
            enabledTransports: ['ws', 'wss']
        });

        pusherRef.current = pusher;

        pusher.connection.bind('state_change', (states) => {
            setConnectionStatus(`State: ${states.current}`);
        });

        const channelName = `chatrooms.${chatroomId}.v2`;
        const channelSub = pusher.subscribe(channelName);
        channelRef.current = channelSub;

        channelSub.bind('pusher:subscription_succeeded', () => {
            setConnectionStatus('Online & Listening');
        });

        channelSub.bind('App\\Events\\ChatMessageEvent', (data) => {
            let parsed = data;
            if (typeof data === 'string') {
                try { parsed = JSON.parse(data); } catch (e) { }
            }

            setMessages(prev => {
                const newMsgs = [...prev, parsed];
                if (newMsgs.length > 100) return newMsgs.slice(-100);
                return newMsgs;
            });
        });

        return () => {
            if (pusherRef.current) {
                pusherRef.current.unsubscribe(channelName);
                pusherRef.current.disconnect();
            }
        };
    }, [chatroomId]);

    const containerRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);

    // 3. Auto-scroll Logic
    useEffect(() => {
        if (autoScroll && containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages, autoScroll]);

    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;
        const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
        setAutoScroll(isAtBottom);
    };

    const scrollToBottom = () => {
        setAutoScroll(true);
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    };

    // Render 7TV Emotes within a text part
    const renderTextWith7TV = (text, keyPrefix) => {
        if (!text) return null;
        const words = text.split(' ');

        return words.map((word, i) => {
            if (emoteMap[word]) {
                return (
                    <img
                        key={`${keyPrefix}-${i}`}
                        src={emoteMap[word]}
                        alt={word}
                        title={word}
                        className="inline-block h-8 align-middle mx-1"
                    />
                );
            }
            return word + (i < words.length - 1 ? ' ' : '');
        });
    };

    // Render Message Content (text + kick emotes + 7TV emotes)
    const renderContent = (content) => {
        if (!content) return null;

        // Regex for Kick Emotes: [emote:37230:POLICE]
        const kickEmoteRegex = /\[emote:(\d+):([\w]+)\]/g;
        const result = [];
        let lastIndex = 0;
        let match;

        while ((match = kickEmoteRegex.exec(content)) !== null) {
            // Text before Kick emote (check for 7TV here)
            if (match.index > lastIndex) {
                const textBefore = content.substring(lastIndex, match.index);
                result.push(renderTextWith7TV(textBefore, `text-${lastIndex}`));
            }

            // Push the Kick Emote
            const emoteId = match[1];
            const emoteName = match[2];
            result.push(
                <img
                    key={`kick-${match.index}`}
                    src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
                    alt={emoteName}
                    title={emoteName}
                    className="inline-block h-6 align-middle mx-0.5"
                />
            );

            lastIndex = kickEmoteRegex.lastIndex;
        }

        // Remaining text after last Kick emote (check for 7TV here)
        if (lastIndex < content.length) {
            const remainingText = content.substring(lastIndex);
            result.push(renderTextWith7TV(remainingText, `text-end-${lastIndex}`));
        }

        return result;
    };

    const getStatusInfo = () => {
        const s = connectionStatus.toLowerCase();
        if (s.includes('online') || s.includes('connected')) return { label: 'Conectado', color: 'text-kick-green', dot: 'bg-kick-green' };
        if (s.includes('error')) return { label: connectionStatus.includes('Chatroom') ? 'Error: Sin Chat' : 'Error de Conexión', color: 'text-red-500', dot: 'bg-red-500' };
        if (s.includes('fetching') || s.includes('connecting') || s.includes('state')) return { label: 'Conectando...', color: 'text-yellow-500', dot: 'bg-yellow-500 animate-pulse' };
        return { label: 'Desconectado', color: 'text-gray-500', dot: 'bg-gray-500' };
    };

    // Render Badges
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
                        <span key={i} title="Moderator" className="mr-1">
                            <ShieldCheck size={14} className="text-kick-green fill-kick-green/20" />
                        </span>
                    );
                case 'vip':
                    return (
                        <span key={i} title="VIP" className="mr-1">
                            <Gem size={14} className="text-pink-500 fill-pink-500/20" />
                        </span>
                    );
                case 'subscriber':
                case 'founder': // OG Subs often called founder
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

    const statusInfo = getStatusInfo();

    if (!active) return null;

    return (
        <div className="flex-1 bg-black flex flex-col h-full overflow-hidden font-sans text-sm relative">
            <div className="bg-white/5 px-3 py-1.5 text-[10px] flex justify-between uppercase tracking-wider shrink-0 border-b border-white/5">
                <div className="flex items-center gap-2">
                    <span className={`w-1.5 h-1.5 rounded-full ${statusInfo.dot}`}></span>
                    <span className={`font-bold ${statusInfo.color}`}>{statusInfo.label}</span>
                </div>
            </div>

            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative"
            >
                {messages.length === 0 && connectionStatus.includes('Online') && (
                    <div className="text-center text-gray-500 mt-10 italic opacity-50">
                        Esperando mensajes...
                    </div>
                )}

                {messages.map((msg, i) => {
                    const sender = msg.sender || {};
                    const identity = sender.identity || {};
                    const color = identity.color || '#53fc18';

                    return (
                        <div key={msg.id || i} className="group break-words leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                            <div className="flex items-start">
                                <div className="flex items-center mr-2 shrink-0 select-none">
                                    {renderBadges(identity.badges)}
                                    <span
                                        className="font-bold hover:underline cursor-pointer"
                                        style={{ color: color }}
                                    >
                                        {sender.username}
                                    </span>
                                    <span className="text-gray-400 mx-1">:</span>
                                </div>
                            </div>
                            <span className="text-gray-300 break-all">
                                {renderContent(msg.content)}
                            </span>
                        </div>
                    );
                })}
            </div>

            {!autoScroll && (
                <div className="absolute bottom-4 left-0 right-0 flex justify-center z-10 pointer-events-none">
                    <button
                        onClick={scrollToBottom}
                        className="pointer-events-auto bg-black/80 text-white border border-kick-green/50 px-4 py-2 rounded-full text-xs font-bold shadow-[0_0_15px_rgba(83,252,24,0.3)] hover:bg-kick-green hover:text-black transition-all flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
                    >
                        <span>Chat Pausado</span>
                        <span className="w-1 h-3 bg-white/20 mx-1"></span>
                        <span>Volver al final ⬇</span>
                    </button>
                </div>
            )}
        </div>
    );
};

export default KickChat;

