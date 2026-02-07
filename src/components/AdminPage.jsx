import React, { useState, useEffect } from 'react';
import io from 'socket.io-client';
import { Users, Lock, Unlock, AlertCircle, Edit2, X, Check } from 'lucide-react';

const socket = io('https://kickplayer-ahzd.onrender.com/');

const AdminPage = () => {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [password, setPassword] = useState('');
    const [onlineCount, setOnlineCount] = useState(0);
    const [error, setError] = useState('');
    const [loadingLogin, setLoadingLogin] = useState(false);

    useEffect(() => {
        const token = localStorage.getItem('adminToken');
        if (token) {
            setIsAuthenticated(true);
        }
    }, []);

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

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoadingLogin(true);
        setError('');

        try {
            const response = await fetch('https://kickplayer-ahzd.onrender.com/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok) {
                localStorage.setItem('adminToken', data.token);
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
        localStorage.removeItem('adminToken');
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
                        <span>Admin Dashboard</span>
                    </div>
                    <button onClick={handleLogout} className="text-xs text-red-400 hover:text-red-300 underline">Logout</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full">
                    {/* Stats Card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-lg flex flex-col items-center justify-center text-center">
                        <h1 className="text-6xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-gray-600 mb-4 tracking-tighter">
                            {onlineCount}
                        </h1>

                        <div className="flex items-center justify-center gap-3 text-xl text-kick-green font-bold uppercase tracking-widest">
                            <Users className="animate-pulse" />
                            <span>Usuarios Online</span>
                        </div>

                        <div className="mt-8 p-3 bg-black/30 rounded-lg border border-white/5 w-full">
                            <p className="text-gray-400 text-xs text-center">
                                Conectado a: <span className="font-mono text-white/50">kickplayer-ahzd.onrender.com</span>
                            </p>
                        </div>
                    </div>

                    {/* Create Slug Form */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 backdrop-blur-lg">
                        <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                            <span className="text-kick-green">#</span> Crear Slug
                        </h2>

                        <SlugForm onSlugCreated={() => window.dispatchEvent(new CustomEvent('slugCreated'))} />
                    </div>
                </div>

                {/* Slugs List */}
                <SlugList />
            </div>
        </div>
    );
};

const SlugList = () => {
    const [slugs, setSlugs] = useState([]);
    const [editingSlug, setEditingSlug] = useState(null);

    const fetchSlugs = async () => {
        const token = localStorage.getItem('adminToken');
        if (!token) return;

        try {
            const res = await fetch(`https://kickplayer-ahzd.onrender.com/api/admin/slugs`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            if (res.ok) {
                const data = await res.json();
                setSlugs(data.slugs);
            }
        } catch (error) {
            console.error("Error fetching slugs:", error);
        }
    };

    useEffect(() => {
        fetchSlugs();

        const handleSlugCreated = () => fetchSlugs();
        window.addEventListener('slugCreated', handleSlugCreated);

        return () => window.removeEventListener('slugCreated', handleSlugCreated);
    }, []);

    if (slugs.length === 0) return null;

    return (
        <div className="w-full mt-8">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <span className="text-kick-green">#</span> Slugs Activos
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {slugs.map((item) => (
                    <div key={item.slug} className="bg-white/5 border border-white/10 rounded-xl p-4 hover:border-kick-green/50 transition-colors relative group">
                        <button
                            onClick={() => setEditingSlug(item)}
                            className="absolute top-2 right-2 p-1.5 rounded-lg bg-black/50 text-gray-400 hover:text-white hover:bg-white/10 transition-colors opacity-100 md:opacity-0 md:group-hover:opacity-100"
                            title="Editar Slug"
                        >
                            <Edit2 size={14} />
                        </button>

                        <div className="flex justify-between items-start mb-2 pr-8">
                            <span className="text-kick-green font-bold text-lg truncate" title={item.slug}>{item.slug}</span>
                            <span className="bg-white/10 text-xs px-2 py-1 rounded text-gray-400 shrink-0">{item.channels.length} canales</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {item.channels.slice(0, 5).map((channel, i) => (
                                <span key={i} className="text-xs bg-black/40 px-2 py-1 rounded text-gray-300">
                                    {channel}
                                </span>
                            ))}
                            {item.channels.length > 5 && (
                                <span className="text-xs text-gray-500 flex items-center">+{item.channels.length - 5} más</span>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {editingSlug && (
                <EditSlugModal
                    slugData={editingSlug}
                    onClose={() => setEditingSlug(null)}
                    onSuccess={() => {
                        setEditingSlug(null);
                        fetchSlugs();
                    }}
                />
            )}
        </div>
    );
};

const EditSlugModal = ({ slugData, onClose, onSuccess }) => {
    const [channels, setChannels] = useState(slugData.channels.join(', '));
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        const channelList = channels.split(',').map(c => c.trim()).filter(c => c);
        const token = localStorage.getItem('adminToken');

        try {
            const response = await fetch(`https://kickplayer-ahzd.onrender.com/api/admin/slug/${slugData.slug}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ channels: channelList })
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({ type: 'success', message: 'Actualizado correctamente!' });
                setTimeout(() => {
                    onSuccess();
                }, 1000);
            } else {
                setStatus({ type: 'error', message: data.error || 'Error al actualizar' });
                setLoading(false);
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Error de red' });
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-kick-surface border border-white/10 bg-[#141414] rounded-2xl w-full max-w-lg p-6 shadow-2xl animate-in zoom-in-95 duration-200 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
                >
                    <X size={20} />
                </button>

                <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                    <Edit2 size={20} className="text-kick-green" />
                    Editar Slug: <span className="text-kick-green font-mono">{slugData.slug}</span>
                </h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1 ml-1">Canales (separados por coma)</label>
                        <textarea
                            value={channels}
                            onChange={(e) => setChannels(e.target.value)}
                            placeholder="ej. channel1, channel2, channel3"
                            className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-kick-green transition-colors h-48 resize-none"
                            required
                            autoFocus
                        />
                    </div>

                    {status.message && (
                        <div className={`p-3 rounded-lg text-sm border flex items-center gap-2 ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                            {status.type === 'success' && <Check size={14} />}
                            {status.message}
                        </div>
                    )}

                    <div className="flex justify-end gap-3 mt-6">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white transition-colors text-sm font-bold"
                        >
                            CANCELAR
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 rounded-lg bg-kick-green text-black font-bold hover:bg-kick-green/90 transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                            {loading ? 'GUARDANDO...' : 'GUARDAR CAMBIOS'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

const SlugForm = ({ onSlugCreated }) => {
    const [slug, setSlug] = useState('');
    const [channels, setChannels] = useState(''); // Comma separated string
    const [status, setStatus] = useState({ type: '', message: '' });
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setStatus({ type: '', message: '' });

        const channelList = channels.split(',').map(c => c.trim()).filter(c => c);
        const token = localStorage.getItem('adminToken');

        try {
            const response = await fetch(`https://kickplayer-ahzd.onrender.com/api/admin/slug`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ slug, channels: channelList })
            });

            const data = await response.json();

            if (response.ok) {
                setStatus({ type: 'success', message: 'Slug creado correctamente!' });
                setSlug('');
                setChannels('');
                if (onSlugCreated) onSlugCreated();
            } else {
                setStatus({ type: 'error', message: data.error || 'Error al crear slug' });
            }
        } catch (error) {
            setStatus({ type: 'error', message: 'Error de red' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div>
                <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1 ml-1">Nombre del Slug</label>
                <input
                    type="text"
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="ej. top-streamers"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-kick-green transition-colors"
                    required
                />
            </div>

            <div>
                <label className="block text-xs uppercase tracking-wider text-gray-400 mb-1 ml-1">Canales (separados por coma)</label>
                <textarea
                    value={channels}
                    onChange={(e) => setChannels(e.target.value)}
                    placeholder="ej. channel1, channel2, channel3"
                    className="w-full bg-black/50 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-kick-green transition-colors h-32 resize-none"
                    required
                />
            </div>

            {status.message && (
                <div className={`p-3 rounded-lg text-sm border ${status.type === 'success' ? 'bg-green-500/10 border-green-500/20 text-green-400' : 'bg-red-500/10 border-red-500/20 text-red-400'}`}>
                    {status.message}
                </div>
            )}

            <button
                type="submit"
                disabled={loading}
                className="w-full bg-kick-green hover:bg-kick-green/90 text-black font-bold py-3 rounded-lg transition-all transform active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {loading ? 'CREANDO...' : 'CREAR SLUG'}
            </button>
        </form>
    );
};

export default AdminPage;