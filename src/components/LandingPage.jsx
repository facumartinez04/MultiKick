import React from 'react';
import { Plus, MonitorPlay, MessageSquare, Play, X, Share2 } from 'lucide-react';

const LandingPage = ({
    channels,
    inputChannel,
    setInputChannel,
    addChannel,
    removeChannel,
    startStream
}) => {
    return (
        <div className="h-[100dvh] w-full bg-kick-dark flex flex-col text-white relative overflow-y-auto overflow-x-hidden font-sans scrollbar-thin scrollbar-thumb-kick-green scrollbar-track-transparent">
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-kick-green/5 rounded-full blur-[120px]"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-white/5 rounded-full blur-[120px]"></div>
            </div>

            <div className="flex-1 flex flex-col items-center justify-center z-10 px-6 pb-10 pt-20 animate-in fade-in zoom-in duration-500">
                <div className="mb-12 flex flex-col items-center">
                    <div className="w-24 h-24 sm:w-32 sm:h-32 flex items-center justify-center mb-6">
                        <img src="https://kick.com/img/kick-logo.svg" alt="Kick Logo" className="w-full h-full object-contain" />
                    </div>
                    <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-center">
                        Multi<span className="text-kick-green">Kick</span>
                    </h1>
                    <p className="text-gray-400 mt-4 text-center max-w-lg text-lg">
                        Ver varios streams de Kick nunca fue tan fácil. Arma tu centro de comando y mira hasta 9 directos de Kick.com a la vez sin lag.
                    </p>
                </div>

                <div className="w-full max-w-md bg-kick-surface/50 p-2 rounded-2xl border border-white/10 backdrop-blur-md shadow-2xl mb-8">
                    <form onSubmit={addChannel} className="relative flex items-center gap-2">
                        <div className="absolute left-4 text-gray-500">
                            <MonitorPlay size={20} />
                        </div>
                        <input
                            type="text"
                            value={inputChannel}
                            onChange={(e) => setInputChannel(e.target.value)}
                            placeholder="Agregar Canal (ej. Coscu)"
                            className="w-full bg-transparent border-none text-white placeholder-gray-500 pl-12 pr-4 py-3 focus:outline-none focus:ring-0 text-lg"
                            autoFocus
                        />
                        <button
                            type="submit"
                            disabled={!inputChannel || channels.length >= 9}
                            className="bg-kick-green hover:bg-kick-green/90 text-black font-bold p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
                        >
                            <Plus size={24} strokeWidth={3} />
                        </button>
                    </form>
                </div>

                {channels.length > 0 && (
                    <div className="w-full max-w-2xl mb-10">
                        <div className="flex flex-wrap items-center justify-center gap-3">
                            {channels.map(channel => (
                                <div key={channel} className="group relative bg-kick-surface border border-white/5 hover:border-kick-green/50 px-4 py-2 rounded-lg flex items-center gap-3 transition-all">
                                    <span className="w-2 h-2 rounded-full bg-kick-green"></span>
                                    <span className="font-semibold">{channel}</span>
                                    <button onClick={() => removeChannel(channel)} className="ml-2 text-gray-500 hover:text-red-500 transition-colors cursor-pointer">
                                        <X size={16} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                <button
                    onClick={startStream}
                    disabled={channels.length === 0}
                    className="group relative px-8 py-4 bg-white text-black font-black text-xl rounded-xl hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100 disabled:cursor-not-allowed overflow-hidden cursor-pointer"
                >
                    <div className="absolute inset-0 bg-kick-green translate-y-[100%] group-hover:translate-y-0 transition-transform duration-300 origin-bottom z-0"></div>
                    <div className="relative z-10 flex items-center gap-3">
                        <span>ARMAR MULTI STREAM</span>
                        <Play size={24} fill="currentColor" />
                    </div>
                </button>

                <div className="flex items-center w-full max-w-md gap-4 mt-12 mb-6 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-200 fill-mode-backwards">
                    <div className="h-px bg-white/10 flex-1"></div>
                    <span className="text-gray-500 font-bold text-xs tracking-wider">O USANDO LA URL</span>
                    <div className="h-px bg-white/10 flex-1"></div>
                </div>

                <div className="w-full max-w-md bg-black/40 border border-white/10 rounded-xl p-4 flex flex-col items-center gap-2 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-300 fill-mode-backwards">
                    <p className="text-gray-400 text-xs text-center">Carga canales directamente con este formato:</p>
                    <div className="font-mono text-sm">
                        <span className="text-gray-500 select-none">multikick.lat/</span>
                        <span className="text-kick-green font-bold">coscu</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-kick-green font-bold">goncho</span>
                        <span className="text-gray-600">/</span>
                        <span className="text-kick-green font-bold">zeko</span>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-6xl mt-12 px-4">
                    <div className="relative bg-black/40 border border-white/5 p-8 rounded-xl flex flex-col items-center text-center group hover:bg-white/5">
                        <div className="mb-4 text-kick-green"><MonitorPlay size={48} /></div>
                        <h3 className="text-xl font-bold text-white mb-2">Multi-Stream</h3>
                        <p className="text-gray-400 text-sm">Mira múltiples streams simultáneamente con un diseño optimizado.</p>
                    </div>
                    <div className="relative bg-black/40 border border-white/5 p-8 rounded-xl flex flex-col items-center text-center group hover:bg-white/5">
                        <div className="mb-4 text-kick-green"><MessageSquare size={48} /></div>
                        <h3 className="text-xl font-bold text-white mb-2">Chat Integrado</h3>
                        <p className="text-gray-400 text-sm">Sigue los chats de todos tus streamers favoritos en un solo lugar.</p>
                    </div>
                    <div className="relative bg-black/40 border border-white/5 p-8 rounded-xl flex flex-col items-center text-center group hover:bg-white/5">
                        <div className="mb-4 text-kick-green"><Share2 size={48} /></div>
                        <h3 className="text-xl font-bold text-white mb-2">Compartir</h3>
                        <p className="text-gray-400 text-sm">Genera un enlace único de tu configuración y compártelo con tus amigos.</p>
                    </div>
                </div>
                <div className="py-6 text-gray-500 text-sm flex flex-col items-center gap-1 z-10 mt-auto">
                    <span>No estamos afiliados directamente con Kick</span>
                    <span className="opacity-80">Hecho por <a href="https://x.com/_mahada_" target="_blank" rel="noreferrer" className="text-gray-400 hover:text-kick-green font-bold">Mahada</a></span>
                </div>
            </div>
        </div>
    );
};

export default LandingPage;
