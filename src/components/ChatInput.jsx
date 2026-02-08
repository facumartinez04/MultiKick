import React, { useState, useEffect } from 'react';
import { Send, Loader2, AlertCircle, LogOut, User, Smile, X, Lock, Star } from 'lucide-react';
import { getChannelInfo, sendChatMessage, getKickEmotes, getChannelEmotes, get7TVEmotes, get7TVGlobalEmotes, getChannelUserRelationship } from '../utils/kickApi';
import { initiateLogin, refreshAccessToken } from '../utils/kickAuth';

const EMOJI_LIST = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😍', '🥰', '😘', '😋', '😛', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🤩', '🥳', '😏', '😒', '😞', '😔', '😟', '😕', '🙁', '☹️', '😣', '😖', '😫', '😩', '🥺', '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶', '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥', '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲', '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧', '😷', '🤒', '🤕', '🤑', '🤠', '😈', '👿', '👹', '👺', '🤡', '💩', '👻', '💀', '☠️', '👽', '👾', '🤖',
    '👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦵', '👂', '👃', '🧠', '🦷', '👀', '👅', '👄',
    '💋', '💘', '💝', '💖', '💗', '💓', '💞', '💕', '💌', '❣️', '💔', '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💯', '💢', '💥', '💫', '💦', '💨', '💣', '💬', '💭', '💤',
    '🔥', '✨', '🌟', '🌈', '⚡', '☄️', '💧', '🌊', '👑', '💎', '🎨', '🎬', '🎤', '🎧', '🎮', '🕹️', '🚀', '🛸', '🛰️', '💡', '💰', '💸', '🎁', '🎈', '🎉', '🎊', '🎀', '🪄'
];

const ChatInput = ({ activeChat, userToken, userData, onLogout, onLogin, onTokenUpdate, permissions }) => {
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [broadcasterId, setBroadcasterId] = useState(null);
    const [error, setError] = useState(null);
    const [isIdLoading, setIsIdLoading] = useState(false);
    const [showEmojis, setShowEmojis] = useState(false);
    const [activeTab, setActiveTab] = useState('emojis');

    const [kickEmotes, setKickEmotes] = useState([]);
    const [kickChannelEmotes, setKickChannelEmotes] = useState([]);
    const [seventvEmotes, setSeventvEmotes] = useState([]);
    const [seventvGlobalEmotes, setSeventvGlobalEmotes] = useState([]);
    const [isSubscriber, setIsSubscriber] = useState(false);
    const [isBroadcaster, setIsBroadcaster] = useState(false);
    const [isModerator, setIsModerator] = useState(false);

    useEffect(() => {
        if (permissions) {
            if (permissions.isSubscriber) setIsSubscriber(true);
            if (permissions.isBroadcaster) setIsBroadcaster(true);
            if (permissions.isModerator) setIsModerator(true);
        }
    }, [permissions]);

    useEffect(() => {
        let isMounted = true;
        const fetchData = async () => {
            if (!activeChat) return;
            setIsIdLoading(true);
            setError(null);
            setBroadcasterId(null);
            setSeventvEmotes([]);
            setKickChannelEmotes([]);

            try {
                const token = localStorage.getItem('kick_access_token');

                const kChanData = await getChannelEmotes(activeChat, token);
                if (isMounted) {
                    if (Array.isArray(kChanData)) {
                        const channelSet = kChanData.find(x => x.slug || x.id === parseInt(broadcasterId)) || kChanData[0];
                        if (channelSet?.emotes) {
                            setKickChannelEmotes(channelSet.emotes);
                        }

                        const globalSet = kChanData.find(x => x.name === 'Global');
                        if (globalSet?.emotes) {
                            setKickEmotes(globalSet.emotes);
                        }
                    } else if (kChanData?.emotes) {
                        setKickChannelEmotes(kChanData.emotes);
                    }
                }

                const info = await getChannelInfo(activeChat, token);
                if (isMounted && info) {
                    const id = info.user_id || info.userId || info.id;
                    if (id) {
                        setBroadcasterId(id);
                        const tvEmotes = await get7TVEmotes(id);
                        if (isMounted) setSeventvEmotes(tvEmotes);
                    } else {
                        setError('Error ID');
                    }
                }

                // Removed /me call to prevent lag
                /*
                if (token) {
                    const relData = await getChannelUserRelationship(activeChat, token);
                    if (isMounted && relData) {
                        setIsSubscriber(!!relData.subscription);
                        setIsBroadcaster(!!relData.is_broadcaster);
                        setIsModerator(!!relData.is_moderator);
                    }
                }
                */
            } catch (e) {
                console.error(e);
                if (isMounted && (e.status === 401 || e.message?.toLowerCase().includes('unauthorized'))) {
                    const refreshTokenStr = localStorage.getItem('kick_refresh_token');
                    if (refreshTokenStr) {
                        try {
                            const newData = await refreshAccessToken(refreshTokenStr);
                            if (onTokenUpdate) {
                                onTokenUpdate(newData);
                                // The useEffect will re-run because userToken changed
                            }
                        } catch (refreshErr) {
                            console.error("Refresh failed in effect:", refreshErr);
                            if (onLogout) onLogout();
                        }
                    }
                }
            } finally {
                if (isMounted) setIsIdLoading(false);
            }
        };

        fetchData();
        return () => { isMounted = false; };
    }, [activeChat, userToken]);

    useEffect(() => {
        getKickEmotes().then(data => {
            if (data && Array.isArray(data)) setKickEmotes(data);
        });
        get7TVGlobalEmotes().then(data => {
            if (data && Array.isArray(data)) setSeventvGlobalEmotes(data);
        });
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const msgToSend = message.trim();
        if (!msgToSend || !userToken || !broadcasterId) return;

        setIsLoading(true);
        setError(null);
        setShowEmojis(false);

        const attemptSend = async (tokenToUse) => {
            await sendChatMessage(tokenToUse, broadcasterId, msgToSend);
        };

        try {
            await attemptSend(userToken);
            setMessage('');
        } catch (err) {
            console.error("Chat Error:", err);
            const errMsg = err.message?.toLowerCase() || '';

            if (err.status === 401 || errMsg.includes('401') || errMsg.includes('unauthenticated') || errMsg.includes('unauthorized')) {
                const refreshTokenStr = localStorage.getItem('kick_refresh_token');

                if (refreshTokenStr) {
                    try {
                        const newData = await refreshAccessToken(refreshTokenStr);
                        if (onTokenUpdate) {
                            onTokenUpdate(newData);
                        }
                        await attemptSend(newData.access_token);
                        setMessage('');
                        return;
                    } catch (refreshErr) {
                        console.error("Refresh failed:", refreshErr);
                        if (onLogout) onLogout();
                        alert("Tu sesión ha expirado. Por favor reconecta.");
                    }
                } else {
                    if (onLogout) onLogout();
                    alert("Tu sesión ha expirado.");
                }
            } else {
                setError('Error al enviar.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const insertText = (text) => {
        setMessage(prev => prev + (prev.endsWith(' ') || !prev ? '' : ' ') + text + ' ');
    };

    const handleLogin = () => {
        if (onLogin) onLogin();
        else initiateLogin();
    };

    if (!activeChat) return null;

    if (!userToken) {
        return (
            <div className="p-4 bg-kick-surface border-t border-white/10 flex flex-col items-center gap-2">
                <p className="text-xs text-gray-400">Inicia sesión para chatear</p>
                <button
                    onClick={handleLogin}
                    className="w-full bg-kick-green text-black font-bold py-2 rounded-lg hover:bg-kick-green/90 transition-colors text-sm cursor-pointer"
                >
                    Conectar con Kick
                </button>
            </div>
        );
    }

    return (
        <div className="p-3 bg-kick-surface border-t border-white/10 flex flex-col gap-2 relative">
            {showEmojis && (
                <div className="absolute bottom-[105%] left-3 right-3 bg-black/95 backdrop-blur-2xl border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50 animate-in fade-in slide-in-from-bottom-2 duration-200 flex flex-col max-h-80">
                    <div className="flex bg-white/5 p-1 shrink-0">
                        {['emojis', 'kick', '7tv'].map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-1.5 text-[10px] font-black uppercase tracking-widest rounded transition-all ${activeTab === tab ? 'bg-kick-green text-black' : 'text-gray-400 hover:text-white'}`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>

                    <div className="p-4 overflow-y-auto custom-scrollbar flex-grow">
                        {activeTab === 'emojis' && (
                            <div className="grid grid-cols-8 gap-2">
                                {EMOJI_LIST.map((emoji, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => insertText(emoji)}
                                        className="text-xl hover:bg-white/10 p-1 rounded-lg transition-transform hover:scale-125"
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}

                        {activeTab === 'kick' && (
                            <div className="flex flex-col gap-4">
                                {kickChannelEmotes.length > 0 && (
                                    <div>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-tighter mb-2 ml-1">Canal</p>
                                        <div className="grid grid-cols-6 gap-2">
                                            {kickChannelEmotes.map((emote, idx) => {
                                                const isSubOnly = emote.subscribers_only;
                                                const canUse = !isSubOnly || isSubscriber || isBroadcaster || isModerator;

                                                return (
                                                    <button
                                                        key={idx}
                                                        onClick={() => canUse && insertText(emote.name)}
                                                        disabled={!canUse}
                                                        className={`relative group/emote p-1.5 rounded-lg flex items-center justify-center transition-all ${canUse ? 'hover:bg-white/10 hover:scale-110 cursor-pointer' : 'opacity-40 grayscale cursor-not-allowed'}`}
                                                        title={isSubOnly && !canUse ? "Solo Suscriptores" : emote.name}
                                                    >
                                                        <img
                                                            src={`https://files.kick.com/emotes/${emote.id}/fullsize`}
                                                            alt={emote.name}
                                                            className="w-8 h-8 object-contain"
                                                        />
                                                        {isSubOnly && !canUse && (
                                                            <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
                                                                <Lock size={12} className="text-white" />
                                                            </div>
                                                        )}
                                                        {isSubOnly && canUse && (
                                                            <div className="absolute top-0 right-0">
                                                                <Star size={8} className="text-kick-green fill-kick-green" />
                                                            </div>
                                                        )}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                )}

                                {kickEmotes.length > 0 && (
                                    <div>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-tighter mb-2 ml-1 border-t border-white/5 pt-3">Global</p>
                                        <div className="grid grid-cols-6 gap-2">
                                            {kickEmotes.map((emote, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => insertText(emote.name)}
                                                    className="hover:bg-white/10 p-1.5 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
                                                    title={emote.name}
                                                >
                                                    <img
                                                        src={`https://files.kick.com/emotes/${emote.id}/fullsize`}
                                                        alt={emote.name}
                                                        className="w-8 h-8 object-contain"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {kickEmotes.length === 0 && kickChannelEmotes.length === 0 && (
                                    <p className="text-[10px] text-gray-500 text-center py-4 col-span-full">Cargando emotes de Kick...</p>
                                )}
                            </div>
                        )}

                        {activeTab === '7tv' && (
                            <div className="flex flex-col gap-4">
                                {seventvEmotes.length > 0 && (
                                    <div>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-tighter mb-2 ml-1">Canal</p>
                                        <div className="grid grid-cols-5 gap-2">
                                            {seventvEmotes.map((emote, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => insertText(emote.name)}
                                                    className="hover:bg-white/10 p-1.5 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
                                                    title={emote.name}
                                                >
                                                    <img
                                                        src={emote.data.host.url + '/2x.webp'}
                                                        alt={emote.name}
                                                        className="w-8 h-8 object-contain"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {seventvGlobalEmotes.length > 0 && (
                                    <div>
                                        <p className="text-[9px] font-black text-gray-500 uppercase tracking-tighter mb-2 ml-1 border-t border-white/5 pt-3">7TV Global</p>
                                        <div className="grid grid-cols-5 gap-2">
                                            {seventvGlobalEmotes.map((emote, idx) => (
                                                <button
                                                    key={idx}
                                                    onClick={() => insertText(emote.name)}
                                                    className="hover:bg-white/10 p-1.5 rounded-lg flex items-center justify-center transition-transform hover:scale-110"
                                                    title={emote.name}
                                                >
                                                    <img
                                                        src={emote.data.host.url + '/2x.webp'}
                                                        alt={emote.name}
                                                        className="w-8 h-8 object-contain"
                                                    />
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {seventvEmotes.length === 0 && seventvGlobalEmotes.length === 0 && (
                                    <p className="text-[10px] text-gray-500 text-center py-4">Cargando emotes de 7TV...</p>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <div className="flex items-center justify-between bg-white/5 p-2 rounded-lg">
                <div className="flex items-center gap-2 overflow-hidden">
                    <div className="w-6 h-6 rounded-full bg-kick-green flex items-center justify-center shrink-0 overflow-hidden border border-white/10">
                        {userData?.profile_picture ? (
                            <img src={userData.profile_picture} alt="User" className="w-full h-full object-cover" />
                        ) : (
                            <User size={14} className="text-black" />
                        )}
                    </div>
                    <span className="text-xs font-bold text-white truncate max-w-[100px]">
                        {userData?.name || userData?.username || 'Usuario'}
                    </span>
                </div>

                <button
                    onClick={onLogout}
                    className="p-1.5 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded transition-colors"
                >
                    <LogOut size={14} />
                </button>
            </div>

            {isIdLoading && (
                <div className="text-xs text-center text-gray-500 flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Conectando...</span>
                </div>
            )}
            {error && (
                <div className="text-xs text-red-400 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}

            <form onSubmit={handleSubmit} className="relative flex gap-2">
                <div className="relative flex-1">
                    <input
                        type="text"
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={`Mensaje a ${activeChat}...`}
                        disabled={isLoading || !broadcasterId}
                        className="w-full bg-black/40 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-kick-green focus:ring-1 focus:ring-kick-green disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    <button
                        type="button"
                        onClick={() => setShowEmojis(!showEmojis)}
                        className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md transition-colors ${showEmojis ? 'text-kick-green bg-white/5' : 'text-gray-500 hover:text-gray-300'}`}
                    >
                        <Smile size={18} />
                    </button>
                </div>
                <button
                    type="submit"
                    disabled={isLoading || !message.trim() || !broadcasterId}
                    className="bg-kick-green text-black p-2 rounded-lg hover:bg-kick-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
            </form>

            <div className="flex items-center justify-center gap-1.5 mt-2 opacity-60 hover:opacity-100 transition-opacity select-none">
                <AlertCircle size={10} className="text-gray-400" />
                <span className="text-[10px] text-gray-500">¿Problemas para enviar? <button onClick={onLogout} className="underline hover:text-kick-green transition-colors">Reconectar cuenta</button></span>
            </div>
        </div>
    );
};

export default ChatInput;