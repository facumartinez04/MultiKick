import React, { useState, useEffect } from 'react';
import { Send, Loader2, AlertCircle } from 'lucide-react';
import { getChannelInfo, sendChatMessage } from '../utils/kickApi';
import { initiateLogin } from '../utils/kickAuth';

const ChatInput = ({ activeChat, userToken }) => {
    const [message, setMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [broadcasterId, setBroadcasterId] = useState(null);
    const [error, setError] = useState(null);
    const [isIdLoading, setIsIdLoading] = useState(false);

    // Fetch Broadcaster ID when active chat changes
    useEffect(() => {
        let isMounted = true;
        const fetchId = async () => {
            if (!activeChat) return;
            setIsIdLoading(true);
            setError(null);
            setBroadcasterId(null);

            const info = await getChannelInfo(activeChat);
            if (isMounted) {
                // Update to handle new API structure which returns user_id
                const id = info?.user_id || info?.userId;
                if (id) {
                    setBroadcasterId(id);
                } else {
                    setError('Error obteniendo ID del canal');
                }
                setIsIdLoading(false);
            }
        };

        fetchId();
        return () => { isMounted = false; };
    }, [activeChat]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!message.trim() || !userToken || !broadcasterId) return;

        setIsLoading(true);
        setError(null);

        try {
            await sendChatMessage(userToken, broadcasterId, message.trim());
            setMessage(''); // Clear input on success
        } catch (err) {
            console.error(err);
            setError('Error al enviar. Verifica tu conexión o login.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleLogin = () => {
        initiateLogin();
    };

    if (!activeChat) return null;

    if (!userToken) {
        return (
            <div className="p-4 bg-kick-surface border-t border-white/10 flex flex-col items-center gap-2">
                <p className="text-xs text-gray-400">Inicia sesión para chatear</p>
                <button
                    onClick={handleLogin}
                    className="w-full bg-kick-green text-black font-bold py-2 rounded-lg hover:bg-kick-green/90 transition-colors text-sm"
                >
                    Conectar con Kick
                </button>
            </div>
        );
    }

    return (
        <div className="p-3 bg-kick-surface border-t border-white/10">
            {/* Status / Error Messsages */}
            {isIdLoading && (
                <div className="text-xs text-center text-gray-500 mb-2 flex items-center justify-center gap-2">
                    <Loader2 size={12} className="animate-spin" />
                    <span>Conectando chat...</span>
                </div>
            )}
            {error && (
                <div className="text-xs text-red-400 mb-2 flex items-center gap-1">
                    <AlertCircle size={12} />
                    <span>{error}</span>
                </div>
            )}

            {/* Input Form */}
            <form onSubmit={handleSubmit} className="relative flex gap-2">
                <input
                    type="text"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder={`Enviar mensaje a ${activeChat}...`}
                    disabled={isLoading || !broadcasterId}
                    className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-kick-green focus:ring-1 focus:ring-kick-green disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <button
                    type="submit"
                    disabled={isLoading || !message.trim() || !broadcasterId}
                    className="bg-kick-green text-black p-2 rounded-lg hover:bg-kick-green/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                    {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
                </button>
            </form>
        </div>
    );
};

export default ChatInput;
