import React, { useEffect, useState, useRef } from 'react';
import Pusher from 'pusher-js';
import { getChannelInfo } from '../utils/kickApi';
import { MessageSquare, Users } from 'lucide-react';

const KICK_PUSHER_KEY = 'eb1d5f283081a78b932c';
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

        const pusher = new Pusher(KICK_PUSHER_KEY, {
            cluster: KICK_PUSHER_CLUSTER,
            encrypted: true,
        });

        pusherRef.current = pusher;

        const channelName = `chatrooms.${chatroomId}.v2`;
        const channelSub = pusher.subscribe(channelName);
        channelRef.current = channelSub;

        console.log(`[KickChat] Subscribing to ${channelName}`);

        channelSub.bind('pusher:subscription_succeeded', () => {
            setConnectionStatus('Connected');
            console.log("[KickChat] Subscription Succeeded");
        });

        channelSub.bind('App\\Events\\ChatMessageEvent', (data) => {
            // console.log("New Message:", data);
            setMessages(prev => {
                const newMsgs = [...prev, data];
                if (newMsgs.length > 100) return newMsgs.slice(-100); // Keep last 100
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

    // 3. Auto-scroll
    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages]);

    // Render Message Content (text + potentially emotes later)
    const renderContent = (content) => {
        // Simplistic text render for now. Kick sends raw structure sometimes or just string?
        // Usually it's a string, or structure. Let's inspect `data`. 
        // Kick V2 `ChatMessageEvent` normally has `message` and `sender` etc.
        return content;
    };

    if (!active) return null;

    return (
        <div className="flex-1 bg-black flex flex-col h-full overflow-hidden font-sans text-sm">
            {/* Status Bar */}
            <div className="bg-white/5 px-3 py-1 text-[10px] text-gray-500 flex justify-between uppercase tracking-wider">
                <span>{connectionStatus}</span>
                <span>{chatroomId ? `RID: ${chatroomId}` : ''}</span>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
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
                                {msg.content}
                            </span>
                        </div>
                    );
                })}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default KickChat;
