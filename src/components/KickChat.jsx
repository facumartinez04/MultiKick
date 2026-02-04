import React, { useEffect, useState, useRef } from 'react';
import Pusher from 'pusher-js';
import { getChannelInfo } from '../utils/kickApi';
import { MessageSquare, Users } from 'lucide-react';

const KICK_PUSHER_KEY = '32cbd69e4b950bf97679';
const KICK_PUSHER_CLUSTER = 'us2';

const KickChat = ({ channel, active }) => {
    const [messages, setMessages] = useState([]);
    const [chatroomId, setChatroomId] = useState(null);
    const [connectionStatus, setConnectionStatus] = useState('Disconnected');
    const bottomRef = useRef(null);
    const pusherRef = useRef(null);
    const channelRef = useRef(null);

    // 1. Fetch Chatroom ID
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

        console.log(`[KickChat] Initializing Pusher for Chatroom: ${chatroomId}`);

        const pusher = new Pusher(KICK_PUSHER_KEY, {
            cluster: KICK_PUSHER_CLUSTER,
            encrypted: true,
            forceTLS: true,
            disableStats: true,
            enabledTransports: ['ws', 'wss'] // Force WS to avoid HTTP fallbacks that might lag
        });

        pusherRef.current = pusher;

        // Debug Connection States
        pusher.connection.bind('state_change', (states) => {
            console.log(`[KickChat] Connection state: ${states.current}`);
            setConnectionStatus(`State: ${states.current}`);
        });

        pusher.connection.bind('connected', () => {
            console.log('[KickChat] Connected to Pusher Server.');
        });

        pusher.connection.bind('error', (err) => {
            console.error('[KickChat] Connection Error:', err);
            setConnectionStatus('Connection Error');
        });

        // Channel Subscription
        const channelName = `chatrooms.${chatroomId}.v2`;
        console.log(`[KickChat] Subscribing to ${channelName}`);

        const channelSub = pusher.subscribe(channelName);
        channelRef.current = channelSub;

        channelSub.bind('pusher:subscription_succeeded', () => {
            setConnectionStatus('Online & Listening');
            console.log("[KickChat] Subscription Succeeded!");
        });

        channelSub.bind('pusher:subscription_error', (status) => {
            setConnectionStatus('Auth/Sub Error');
            console.error("[KickChat] Subscription Error:", status);
        });

        // Listen for messages
        channelSub.bind('App\\Events\\ChatMessageEvent', (data) => {
            // console.log("Raw Message:", data);
            // Ensure data is parsed if string
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
                console.log('[KickChat] Disconnecting...');
                pusherRef.current.unsubscribe(channelName);
                pusherRef.current.disconnect();
            }
        };
    }, [chatroomId]);

    const containerRef = useRef(null);
    const [autoScroll, setAutoScroll] = useState(true);
    const [showScrollButton, setShowScrollButton] = useState(false);

    // ... (existing effects)

    // 3. Auto-scroll Logic
    useEffect(() => {
        if (autoScroll && containerRef.current) {
            // Use instant scroll for performance/snappiness on high traffic
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [messages, autoScroll]);

    // Detect manual scroll
    const handleScroll = () => {
        if (!containerRef.current) return;
        const { scrollTop, scrollHeight, clientHeight } = containerRef.current;

        // If user scrolls up (distance > 50px from bottom)
        const distanceToBottom = scrollHeight - scrollTop - clientHeight;
        const isAtBottom = distanceToBottom < 50;

        if (isAtBottom) {
            setAutoScroll(true);
            setShowScrollButton(false);
        } else {
            setAutoScroll(false);
            setShowScrollButton(true);
        }
    };

    const scrollToBottom = () => {
        setAutoScroll(true);
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    };

    // Render Message Content (text + emotes)
    const renderContent = (content) => {
        if (!content) return null;

        // Regex for Kick Emotes: [emote:37230:POLICE]
        const emoteRegex = /\[emote:(\d+):([\w]+)\]/g;

        const parts = [];
        let lastIndex = 0;
        let match;

        while ((match = emoteRegex.exec(content)) !== null) {
            // Push text before the emote
            if (match.index > lastIndex) {
                parts.push(content.substring(lastIndex, match.index));
            }

            // Push the emote image
            const emoteId = match[1];
            const emoteName = match[2];
            parts.push(
                <img
                    key={`${emoteId}-${match.index}`}
                    src={`https://files.kick.com/emotes/${emoteId}/fullsize`}
                    alt={emoteName}
                    title={emoteName}
                    className="inline-block h-6 align-middle mx-0.5"
                />
            );

            lastIndex = emoteRegex.lastIndex;
        }

        // Push remaining text
        if (lastIndex < content.length) {
            parts.push(content.substring(lastIndex));
        }

        return parts.length > 0 ? parts : content;
    };

    if (!active) return null;

    return (
        <div className="flex-1 bg-black flex flex-col h-full overflow-hidden font-sans text-sm relative">
            {/* Status Bar */}
            <div className="bg-white/5 px-3 py-1 text-[10px] text-gray-500 flex justify-between uppercase tracking-wider shrink-0">
                <span>{connectionStatus}</span>
                <span>{chatroomId ? `RID: ${chatroomId}` : ''}</span>
            </div>

            {/* Messages Area */}
            <div
                ref={containerRef}
                onScroll={handleScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar relative"
            >
                {messages.length === 0 && connectionStatus === 'Connected' && (
                    <div className="text-center text-gray-500 mt-10 italic opacity-50">
                        Waiting for messages...
                    </div>
                )}

                {messages.map((msg, i) => {
                    const sender = msg.sender || {};
                    const identity = sender.identity || {};
                    // Colors
                    const color = identity.color || '#53fc18'; // Kick Green default

                    return (
                        <div key={msg.id || i} className="group break-words leading-relaxed animate-in fade-in slide-in-from-left-2 duration-200">
                            <span
                                className="font-bold mr-2 hover:underline cursor-pointer"
                                style={{ color: color }}
                            >
                                {sender.username}
                            </span>
                            <span className="text-gray-300">
                                {renderContent(msg.content)}
                            </span>
                        </div>
                    );
                })}
            </div>

            {/* Scroll Paused Alert / Resume Button */}
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
