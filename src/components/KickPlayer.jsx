import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Volume2, VolumeX, Maximize2, Minimize2, Maximize, Minimize, Settings, VideoOff, Users, Clock, Gamepad2, User } from 'lucide-react';
import { getChannelInfo } from '../utils/kickApi';
import Hls from 'hls.js';

const KickPlayer = ({ channel, onRemove, shouldMuteAll, isMaximized, onToggleMaximize }) => {
    const [key, setKey] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(0.7);
    const [streamUrl, setStreamUrl] = useState(null);
    const [useCustomPlayer, setUseCustomPlayer] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    // Stream Stats
    const [streamStats, setStreamStats] = useState(null);
    const [uptime, setUptime] = useState('00:00:00');

    // Quality Control State
    const [qualities, setQualities] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1); // -1 = Auto
    const [showQualityMenu, setShowQualityMenu] = useState(false);

    // Refs
    const playerRef = useRef(null);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const uptimeIntervalRef = useRef(null);

    const [isFullscreen, setIsFullscreen] = useState(false);

    // Sync Fullscreen State
    useEffect(() => {
        const handleFsChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
        };
        document.addEventListener('fullscreenchange', handleFsChange);
        document.addEventListener('webkitfullscreenchange', handleFsChange);
        document.addEventListener('mozfullscreenchange', handleFsChange);
        return () => {
            document.removeEventListener('fullscreenchange', handleFsChange);
            document.removeEventListener('webkitfullscreenchange', handleFsChange);
            document.removeEventListener('mozfullscreenchange', handleFsChange);
        };
    }, []);

    // 1. Fetch Channel Info with Auto-Retry
    useEffect(() => {
        let isMounted = true;
        let retryTimeout = null;

        // Reset states to force a visual "reload" and cleanup
        setStreamUrl(null);
        setIsOffline(false);
        setStreamStats(null);

        const fetchStream = async () => {
            setUseCustomPlayer(true);
            try {
                const data = await getChannelInfo(channel);
                if (isMounted) {
                    // Strict check: Must have playback_url AND be live
                    const isLive = data?.livestream?.is_live;
                    if (data && data.playback_url && isLive) {
                        console.log(`[${channel}] Stream URL found & Live.`);
                        setStreamUrl(data.playback_url);
                        setIsOffline(false);

                        // Parse Stats
                        if (data.livestream) {
                            const startTime = new Date(data.livestream.created_at).getTime();
                            setStreamStats({
                                viewers: data.livestream.viewer_count || 0,
                                category: data.livestream.categories?.[0]?.name || 'Just Chatting',
                                startTime: startTime,
                                isLive: data.livestream.is_live
                            });
                        }
                    } else {
                        console.warn(`[${channel}] No playback_url. Retrying in 5s...`);
                        setIsOffline(true);
                        setStreamUrl(null);
                        setStreamStats(null);
                        // Retry loop
                        retryTimeout = setTimeout(fetchStream, 5000);
                    }
                }
            } catch (err) {
                console.error(`[${channel}] Fetch Error. Retrying in 5s...`, err);
                if (isMounted) {
                    retryTimeout = setTimeout(fetchStream, 5000);
                }
            }
        };

        // Initial fetch
        fetchStream();

        return () => {
            isMounted = false;
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [channel, key]);

    // Uptime Timer Logic
    useEffect(() => {
        if (uptimeIntervalRef.current) clearInterval(uptimeIntervalRef.current);

        if (streamStats && streamStats.isLive && streamStats.startTime) {
            uptimeIntervalRef.current = setInterval(() => {
                const now = Date.now();
                const diff = now - streamStats.startTime;

                const hours = Math.floor(diff / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                setUptime(
                    `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
                );
            }, 1000);
        }

        return () => {
            if (uptimeIntervalRef.current) clearInterval(uptimeIntervalRef.current);
        };
    }, [streamStats]);

    // 2. Initialize HLS Player & Quality Handling
    useEffect(() => {
        if (isOffline || !streamUrl) return;

        let hls = null;
        let recoverDecodingErrorDate = null;
        let recoverSwapAudioCodecDate = null;

        const initPlayer = () => {
            if (useCustomPlayer && streamUrl && Hls.isSupported() && videoRef.current) {
                if (hlsRef.current) {
                    hlsRef.current.destroy();
                }

                hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90,
                    manifestLoadingTimeOut: 20000,
                    manifestLoadingMaxRetry: 10,
                    levelLoadingMaxRetry: 10,
                    fragLoadingMaxRetry: 10
                });

                hlsRef.current = hls;

                // Proxy URL for CORS
                const proxyUrl = `https://kickplayer-ahzd.onrender.com/proxy?url=${encodeURIComponent(streamUrl)}`;
                hls.loadSource(proxyUrl);
                hls.attachMedia(videoRef.current);

                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
                    // Extract Qualities
                    if (hls.levels) {
                        const levels = hls.levels.map((lvl, index) => ({
                            id: index,
                            height: lvl.height,
                            name: lvl.height + 'p'
                        }));
                        setQualities(levels);
                    }

                    videoRef.current?.play().catch(e => {
                        console.warn("Autoplay blocked", e);
                    });
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.log(`[${channel}] Network error, trying to start load...`);
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log(`[${channel}] Media error, trying to recover...`);
                                const now = Date.now();
                                if (!recoverDecodingErrorDate || (now - recoverDecodingErrorDate) > 3000) {
                                    recoverDecodingErrorDate = now;
                                    hls.recoverMediaError();
                                } else if (!recoverSwapAudioCodecDate || (now - recoverSwapAudioCodecDate) > 3000) {
                                    recoverSwapAudioCodecDate = now;
                                    hls.swapAudioCodec();
                                    hls.recoverMediaError();
                                } else {
                                    console.error(`[${channel}] Fatal media error, destroying...`);
                                    hls.destroy();
                                    setStreamUrl(null);
                                }
                                break;
                            default:
                                console.error(`[${channel}] Unrecoverable error, destroying...`);
                                hls.destroy();
                                setStreamUrl(null);
                                break;
                        }
                    }
                });
            } else if (videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari Native
                videoRef.current.src = streamUrl;
                videoRef.current.addEventListener('loadedmetadata', () => {
                    videoRef.current.play();
                });

                videoRef.current.onerror = () => {
                    console.error(`[${channel}] Native Video Error. Retrying...`);
                    setTimeout(() => {
                        if (videoRef.current) videoRef.current.src = streamUrl;
                    }, 5000);
                };
            }
        };

        const timer = setTimeout(initPlayer, 100);

        return () => {
            clearTimeout(timer);
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
        };
    }, [streamUrl, useCustomPlayer, isOffline]);

    // 3. Handle Mute & Sync
    useEffect(() => {
        if (shouldMuteAll) setIsMuted(true);
    }, [shouldMuteAll]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = isMuted ? 0 : volume;
        }
    }, [isMuted, volume]);

    // Helpers
    const changeQuality = (levelId) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelId;
            setCurrentQuality(levelId);
            setShowQualityMenu(false);
        }
    };

    const toggleMute = () => setIsMuted(!isMuted);
    const reload = () => setKey(prev => prev + 1);

    const toggleFullscreen = (e) => {
        e.stopPropagation();
        if (!playerRef.current) return;

        if (!document.fullscreenElement) {
            const el = playerRef.current;
            if (el.requestFullscreen) el.requestFullscreen();
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            else if (el.msRequestFullscreen) el.msRequestFullscreen();
        } else {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.msExitFullscreen) document.msExitFullscreen();
        }
    };

    // Format Viewers (e.g. 12.5k)
    const formatViewers = (count) => {
        if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
        return count;
    };

    return (
        <div
            ref={playerRef}
            onDoubleClick={onToggleMaximize}
            className="relative w-full h-full bg-black border border-white/5 rounded-xl overflow-hidden flex flex-col group shadow-2xl ring-1 ring-white/5 hover:ring-kick-green/30 transition-all duration-300 pointer-events-auto"
        >

            {/* --- OVERLAY STATS (Top Left) --- */}
            <div className="absolute top-4 left-4 z-30 flex flex-col gap-2 pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                <div className="flex items-center gap-2">
                    {!isOffline && streamStats?.isLive && (
                        <div className="bg-red-600 text-white text-[10px] font-black px-1.5 py-0.5 rounded flex items-center gap-1 shadow-md">
                            <span>LIVE</span>
                        </div>
                    )}
                    <div className="bg-black/80 backdrop-blur-md text-white/90 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 shadow-md border border-white/5">
                        <User size={10} className="text-kick-green" />
                        <span className="uppercase tracking-wide">{channel}</span>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {streamStats?.category && (
                        <div className="bg-black/80 backdrop-blur-md text-white/90 text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 shadow-md border border-white/5">
                            <Gamepad2 size={10} className="text-kick-green" />
                            <span className="truncate max-w-[100px]">{streamStats.category}</span>
                        </div>
                    )}
                </div>
            </div>

            <div className="absolute bottom-16 right-4 z-20 pointer-events-none opacity-20 group-hover:opacity-50 transition-opacity">
                <span className="text-white/80 font-black italic tracking-tighter text-[10px] drop-shadow-md">
                    MULTIKICK<span className="text-kick-green">.LAT</span>
                </span>
            </div>

            <div className="flex-grow relative bg-zinc-900">
                {isOffline ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 z-10 p-4 text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                            <VideoOff size={32} className="text-gray-500" />
                        </div>
                        <p className="font-bold text-lg text-gray-400">{channel} está Desconectado</p>
                    </div>
                ) : useCustomPlayer && streamUrl ? (
                    <video
                        ref={videoRef}
                        className="w-full h-full object-contain bg-black cursor-pointer"
                        playsInline
                        muted={isMuted}
                        autoPlay
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-kick-green"></div>
                    </div>
                )}

                {isMuted && !isOffline && (
                    <div className="absolute top-3 right-12 z-40">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMuted(false);
                            }}
                            className="bg-black/80 backdrop-blur-md border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white text-[10px] font-black px-3 py-1 rounded flex items-center gap-2 transition-all shadow-xl animate-in zoom-in-95"
                        >
                            <VolumeX size={12} />
                            <span className="tracking-widest uppercase">MUTEADO - CLICK PARA ESCUCHAR</span>
                        </button>
                    </div>
                )}

                {showQualityMenu && useCustomPlayer && (
                    <div className="absolute bottom-16 right-4 z-30 bg-black/90 border border-white/10 rounded-lg p-2 flex flex-col gap-1 min-w-[100px] shadow-xl backdrop-blur-md">
                        <button
                            onClick={() => changeQuality(-1)}
                            className={`text-xs px-3 py-1.5 rounded hover:bg-white/10 text-left transition-colors ${currentQuality === -1 ? 'text-kick-green font-bold' : 'text-white'}`}
                        >
                            Auto
                        </button>
                        {qualities.map(q => (
                            <button
                                key={q.id}
                                onClick={() => changeQuality(q.id)}
                                className={`text-xs px-3 py-1.5 rounded hover:bg-white/10 text-left transition-colors ${currentQuality === q.id ? 'text-kick-green font-bold' : 'text-white'}`}
                            >
                                {q.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 flex items-center justify-between gap-2 transform translate-y-[10px] group-hover:translate-y-0">
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-gray-500' : 'bg-kick-green animate-pulse shadow-[0_0_10px_#53fc18]'}`}></span>
                        </div>

                        {!isOffline && streamStats?.viewers !== undefined && (
                            <div className="flex items-center gap-1 text-white/90 text-[10px] font-bold">
                                <Users size={12} className="text-kick-green" />
                                <span>{formatViewers(streamStats.viewers)}</span>
                            </div>
                        )}

                        {!isOffline && streamStats?.isLive && (
                            <div className="flex items-center gap-1 text-white/90 text-[10px] font-bold font-mono">
                                <Clock size={12} className="text-kick-green" />
                                <span>{uptime}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1.5">
                        {useCustomPlayer && qualities.length > 0 && !isOffline && (
                            <button
                                onClick={() => setShowQualityMenu(!showQualityMenu)}
                                className={`p-1.5 rounded-md hover:bg-white/10 text-white transition-colors ${showQualityMenu ? 'text-kick-green' : ''}`}
                                title="Calidad"
                            >
                                <Settings size={16} />
                            </button>
                        )}

                        <div className="relative group/volume flex items-center">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                            >
                                {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                            </button>

                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 pb-4 opacity-0 group-hover/volume:opacity-100 transition-all duration-200 pointer-events-none group-hover/volume:pointer-events-auto z-50 scale-95 group-hover/volume:scale-100 origin-bottom">
                                <div className="p-3 bg-black/95 backdrop-blur-md rounded-xl border border-white/10 flex flex-col items-center gap-2 h-32 shadow-2xl min-w-[40px]">
                                    <input
                                        type="range"
                                        min="0"
                                        max="1"
                                        step="0.05"
                                        value={isMuted ? 0 : volume}
                                        onChange={(e) => {
                                            const newVal = parseFloat(e.target.value);
                                            setVolume(newVal);
                                            if (newVal > 0) setIsMuted(false);
                                            else setIsMuted(true);
                                        }}
                                        className="h-20 accent-kick-green cursor-pointer appearance-none bg-white/10 rounded-lg w-1.5"
                                        style={{ WebkitAppearance: 'slider-vertical' }}
                                    />
                                    <span className="text-[10px] text-white font-black">{Math.round((isMuted ? 0 : volume) * 100)}%</span>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={(e) => { e.stopPropagation(); reload(); }}
                            className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                            title="Recargar Stream"
                        >
                            <RefreshCw size={16} />
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleMaximize(); }}
                            className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                            title={isMaximized ? "Achicar" : "Maximizar en App"}
                        >
                            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                        {/* Native Fullscreen */}
                        <button
                            onClick={toggleFullscreen}
                            className={`flex items-center gap-1.5 px-2 py-1 rounded bg-white/10 hover:bg-kick-green hover:text-black transition-all group/fs ${isFullscreen ? 'text-kick-green' : 'text-white'}`}
                            title={isFullscreen ? "Salir" : "Pantalla Completa"}
                        >
                            {isFullscreen ? <Minimize size={14} /> : <Maximize size={14} />}
                            <span className="text-[10px] font-black tracking-tighter uppercase">
                                {isFullscreen ? "SALIR" : "PANTALLA COMPLETA"}
                            </span>
                        </button>

                        <button
                            onClick={(e) => { e.stopPropagation(); onRemove(channel); }}
                            className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400 hover:text-white transition-colors ml-1"
                            title="Remover"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KickPlayer;
