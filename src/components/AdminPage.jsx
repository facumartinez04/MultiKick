import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Users, Lock, Unlock, AlertCircle } from 'lucide-react';

const socket = io('https://kickplayer-ahzd.onrender.com/');

const AdminPage = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [onlineCount, setOnlineCount] = useState(0);
    const [error, setError] = useState('');

    const SECRET_KEY = "pruebas123";

    useEffect(() => {
        if (isAuthenticated) {
            socket.on('online_users', (data) => {
                setOnlineCount(data.count);
            });
        }
        return () => {
            socket.off('online_users');
        };
    }, [isAuthenticated]);

    const handleLogin = (e) => {
        e.preventDefault();
        if (password === SECRET_KEY) {
            setIsAuthenticated(true);
            setError('');
        } else {
            setError('Clave incorrecta');
        }
    };

    if (!isAuthenticated) {
        return (
            <div className="min-h-screen bg-black flex items-center justify-center font-sans text-white">
                <div className="w-full max-w-md p-8 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-lg">
                    <div className="flex justify-center mb-6">
                        <div className="p-4 bg-kick-green/20 rounded-full text-kick-green">
                            <Lock size={32} />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-center mb-6">Admin Access</h1>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Ingrese clave maestra..."
                                className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-kick-green transition-colors"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                <AlertCircle size={14} />
                                <span>{error}</span>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-kick-green hover:bg-kick-green/90 text-black font-bold py-3 rounded-lg transition-all transform active:scale-95"
                        >
                            INGRESAR
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-black flex flex-col items-center justify-center font-sans text-white relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-kick-green/10 rounded-full blur-[150px]"></div>
            </div>

            <div className="z-10 text-center animate-in fade-in zoom-in duration-500">
                <div className="mb-4 inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs font-mono uppercase tracking-widest">
                    <Unlock size={12} className="text-kick-green" />
                    <span>Admin Dashboard</span>
                </div>

                <h1 className="text-6xl md:text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 mb-8 tracking-tighter">
                    {onlineCount}
                </h1>

                <div className="flex items-center justify-center gap-3 text-xl md:text-2xl text-kick-green font-bold uppercase tracking-widest">
                    <Users className="animate-pulse" />
                    <span>Usuarios Online</span>
                </div>

                <div className="mt-12 p-4 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm max-w-sm mx-auto">
                    <p className="text-gray-400 text-sm">
                        Conectado al servidor en tiempo real.
                        <br />
                        <span className="text-xs opacity-50 font-mono mt-2 block">kickplayer-ahzd.onrender.com</span>
                    </p>
                </div>
            </div>
        </div>
    );
};

export default AdminPage;