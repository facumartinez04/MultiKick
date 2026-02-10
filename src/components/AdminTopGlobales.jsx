import React, { useState, useEffect } from 'react';
import { Lock, Unlock, AlertCircle, Edit2, X, Check } from 'lucide-react';

const AdminTopGlobales = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loadingLogin, setLoadingLogin] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('topGlobalesToken');
        if (token) {
            setIsAuthenticated(true);
        }
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoadingLogin(true);
        setError('');

        try {
            const response = await fetch('https://kickplayer-ahzd.onrender.com/api/admin/login-topglobales', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('topGlobalesToken', data.token);
                setIsAuthenticated(true);
            } else {
                setError(data.error || 'Clave incorrecta');
            }
        } catch (err) {
            setError('Error de conexión');
        } finally {
            setLoadingLogin(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('topGlobalesToken');
        setIsAuthenticated(false);
        setPassword('');
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
                    <h1 className="text-2xl font-bold text-center mb-2">Admin Top Globales</h1>
                    <p className="text-center text-gray-400 text-sm mb-6">Acceso exclusivo para editar Top Globales</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Ingrese clave de Top Globales..."
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
                            disabled={loadingLogin}
                            className="w-full bg-kick-green hover:bg-kick-green/90 text-black font-bold py-3 rounded-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loadingLogin ? 'VERIFICANDO...' : 'INGRESAR'}
                        </button>
                    </form>
                </div>
            </div>
        );
    }

    return (
        <div className="h-[100dvh] w-full bg-black flex flex-col text-white relative overflow-y-auto overflow-x-hidden font-sans scrollbar-thin scrollbar-thumb-kick-green scrollbar-track-transparent">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                <div className="absolute top-[-20%] left-[-20%] w-[50%] h-[50%] bg-kick-green/10 rounded-full blur-[150px]"></div>
            </div>

            <div className="z-10 w-full max-w-4xl px-4 py-10 mx-auto animate-in fade-in zoom-in duration-500 flex flex-col items-center">
                <div className="mb-4 flex items-center gap-4">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-gray-400 text-xs font-mono uppercase tracking-widest">
                        <Unlock size={12} className="text-kick-green" />
                        <span>Admin Top Globales</span>
                    </div>
                    <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 underline">Logout</button>
                </div>

                <div className="w-full">
                    <h1 className="text-3xl font-black text-center mb-2 text-transparent bg-clip-text bg-gradient-to-r from-kick-green via-white to-kick-green">
                        ★ LOS TOP GLOBALES ★
                    </h1>
                    <p className="text-center text-gray-400 text-sm mb-8">Edita los canales del slug "lostopglobales"</p>
                </div>

                {/* Editor del Slug */}
                <TopGlobalesEditor />
            </div>
        </div>
    );
};

const TopGlobalesEditor = () => {
    const [channels, setChannels] = useState('');
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);
    const [currentChannels, setCurrentChannels] = useState([]);
    const [loadingFetch, setLoadingFetch] = useState(true);

    // Fetch current channels
    const fetchCurrentChannels = async () => {
        setLoadingFetch(true);
        try {
            const res = await fetch('https://kickplayer-ahzd.onrender.com/api/slug/lostopglobales');
            if (res.ok) {
                const data = await res.json();
                if (data.channels && Array.isArray(data.channels)) {
                    setCurrentChannels(data.channels);
                    setChannels(data.channels.join(', '));
                }
            }
        } catch (error) {
            console.error("Error fetching current channels:", error);
        } finally {
            setLoadingFetch(false);
        }
    };

    useEffect(() => {
        fetchCurrentChannels();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        const channelList = channels.split(',').map(c => c.trim()).filter(c => c);
        const token = localStorage.getItem('topGlobalesToken');

        try {
            const response = await fetch('https://kickplayer-ahzd.onrender.com/api/admin/slug-lostopglobales', {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ channels: channelList })
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({ type: 'success', message: 'Top Globales actualizado correctamente!' });
                setCurrentChannels(channelList);
                setTimeout(() => {
                    setStatus({ type: '', message: '' });
                }, 3000);
            } else {
                setStatus({ type: 'error', message: data.error || 'Error al actualizar' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Error de conexión' });
        } finally {
            setLoading(false);
        }
    };

    if (loadingFetch) {
        return (
            <div className="w-full bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-lg">
                <div className="flex items-center justify-center gap-3">
                    <div className="w-6 h-6 border-2 border-kick-green border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-gray-400">Cargando canales actuales...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full space-y-6">
            {/* Current Channels Display */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-6 backdrop-blur-lg">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <span className="text-kick-green">#</span> Canales Actuales
                </h2>
                <div className="flex flex-wrap gap-2">
                    {currentChannels.map((channel, i) => (
                        <span key={i} className="bg-black/40 px-3 py-2 rounded-lg text-gray-200 font-mono text-sm border border-white/10">
                            {channel}
                        </span>
                    ))}
                </div>
                {currentChannels.length === 0 && (
                    <p className="text-gray-500 text-sm">No hay canales configurados</p>
                )}
            </div>

            {/* Edit Form */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-lg">
                <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                    <Edit2 size={20} className="text-kick-green" />
                    Editar Canales
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-2 ml-1">
                            Canales (separados por coma)
                        </label>
                        <textarea
                            value={channels}
                            onChange={(e) => setChannels(e.target.value)}
                            placeholder="ej. duendepablo, zeko, goncho, coker, coscu, robergalati"
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-kick-green transition-colors h-48 resize-none font-mono"
                            required
                        />
                        <p className="text-xs text-gray-500 mt-2 ml-1">
                            Ingresa los nombres de los canales separados por comas
                        </p>
                    </div>

                    {status.message && (
                        <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            {status.type === 'success' && <Check size={14} />}
                            {status.type === 'error' && <AlertCircle size={14} />}
                            {status.message}
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-kick-green hover:bg-kick-green/90 text-black font-bold py-3 rounded-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default AdminTopGlobales;
