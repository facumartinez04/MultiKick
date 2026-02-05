import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Lock, Users, Unlock } from 'lucide-react';

const socket = io('https://kickplayer-ahzd.onrender.com/');

const AdminStats = () => {
    const [onlineCount, setOnlineCount] = useState(0);
    const [isUnlocked, setIsUnlocked] = useState(false);
    const [password, setPassword] = useState('');
    const [showInput, setShowInput] = useState(false);

    const SECRET_KEY = "admin123";

    useEffect(() => {
        socket.on('online_users', (data) => {
            setOnlineCount(data.count);
        });

        return () => {
            socket.off('online_users');
        };
    }, []);

    const handleUnlock = (e) => {
        e.preventDefault();
        if (password === SECRET_KEY) {
            setIsUnlocked(true);
            setShowInput(false);
        } else {
            alert("Clave incorrecta");
        }
    };

    return (
        <div className="fixed bottom-4 left-4 z-50">
            {isUnlocked ? (
                <div className="bg-black/90 border border-kick-green/50 text-kick-green px-4 py-2 rounded-lg shadow-2xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
                    <Users size={16} />
                    <span className="font-bold font-mono text-sm">
                        ONLINE: {onlineCount}
                    </span>
                    <button
                        onClick={() => setIsUnlocked(false)}
                        className="ml-2 hover:text-white transition-colors"
                    >
                        <Lock size={12} />
                    </button>
                </div>
            ) : (
                <div className="relative group">
                    <button
                        onClick={() => setShowInput(!showInput)}
                        className="p-2 bg-black/50 hover:bg-black/80 text-gray-500 hover:text-kick-green rounded-full transition-all border border-transparent hover:border-kick-green/30"
                    >
                        <Lock size={16} />
                    </button>

                    {showInput && (
                        <form onSubmit={handleUnlock} className="absolute bottom-full left-0 mb-2 bg-black/90 p-2 rounded-lg border border-white/10 flex gap-2 shadow-xl">
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Clave..."
                                className="w-24 bg-white/10 border border-white/5 rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-kick-green"
                                autoFocus
                            />
                            <button
                                type="submit"
                                className="bg-kick-green text-black px-2 py-1 rounded text-xs font-bold hover:bg-kick-green/80"
                            >
                                <Unlock size={12} />
                            </button>
                        </form>
                    )}
                </div>
            )}
        </div>
    );
};

export default AdminStats;