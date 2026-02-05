import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Volume2, VolumeX, Maximize2, Minimize2, Maximize, Minimize, Settings, VideoOff, Users, Clock, Gamepad2, User, Zap, Play, Pause } from 'lucide-react';
import { getChannelInfo } from '../utils/kickApi';
import Hls from 'hls.js';

const KickPlayer = ({ channel, onRemove, shouldMuteAll, isMaximized, onToggleMaximize, onMetaUpdate }) => {
    const [key, setKey] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [volume, setVolume] = useState(0.7);
    const [streamUrl, setStreamUrl] = useState(null);
    const [useCustomPlayer, setUseCustomPlayer] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    const [streamStats, setStreamStats] = useState(null);
    const [uptime, setUptime] = useState('00:00:00');

    const [qualities, setQualities] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1);
    const [showQualityMenu, setShowQualityMenu] = useState(false);

    const playerRef = useRef(null);
    const videoRef = useRef(null);
    const hlsRef = useRef(null);
    const uptimeIntervalRef = useRef(null);

    const [isFullscreen, setIsFullscreen] = useState(false);
    const [showMobileControls, setShowMobileControls] = useState(false);
    const [isMobile, setIsMobile] = useState(false);
    const [isPlaying, setIsPlaying] = useState(true);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.matchMedia("(max-width: 768px)").matches);
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    const handleContainerClick = () => {
        if (!isMobile) return;
        if (!isMaximized) {
            onToggleMaximize();
            setShowMobileControls(true);
        } else {
            setShowMobileControls(prev => !prev);
        }
    };

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

    useEffect(() => {
        let isMounted = true;
        let retryTimeout = null;

        setStreamUrl(null);
        setIsOffline(false);
        setStreamStats(null);

        const fetchStream = async () => {
            setUseCustomPlayer(true);
            try {
                const data = await getChannelInfo(channel);
                if (isMounted) {
                    const isLive = data?.livestream?.is_live;
                    if (data && data.playback_url && isLive) {
                        setStreamUrl(data.playback_url);
                        setIsOffline(false);

                        if (data.livestream) {
                            const startTime = new Date(data.livestream.created_at).getTime();
                            setStreamStats({
                                viewers: data.livestream.viewer_count || 0,
                                category: data.livestream.categories?.[0]?.name || 'Just Chatting',
                                startTime: startTime,
                                isLive: data.livestream.is_live,
                                profilePic: data?.user?.profile_pic
                            });
                        } else if (data?.user?.profile_pic) {
                            setStreamStats(prev => ({ ...prev, profilePic: data.user.profile_pic }));
                        }

                        if (data?.user?.profile_pic && onMetaUpdate) {
                            onMetaUpdate(channel, data.user.profile_pic);
                        }
                    } else {
                        setIsOffline(true);
                        setStreamUrl(null);
                        setStreamStats(null);
                        retryTimeout = setTimeout(fetchStream, 5000);
                    }
                }
            } catch (err) {
                if (isMounted) {
                    retryTimeout = setTimeout(fetchStream, 5000);
                }
            }
        };

        fetchStream();

        return () => {
            isMounted = false;
            if (retryTimeout) clearTimeout(retryTimeout);
        };
    }, [channel, key]);

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
                    fragLoadingMaxRetry: 10,
                    liveSyncDurationCount: 1.5,
                    liveMaxLatencyDurationCount: 3,
                    maxLiveSyncPlaybackRate: 2,
                });

                hlsRef.current = hls;

                const proxyUrl = `https://kickplayer-ahzd.onrender.com/proxy?url=${encodeURIComponent(streamUrl)}`;
                hls.loadSource(proxyUrl);
                hls.attachMedia(videoRef.current);

                hls.on(Hls.Events.MANIFEST_PARSED, (event, data) => {
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
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                const now = Date.now();
                                if (!recoverDecodingErrorDate || (now - recoverDecodingErrorDate) > 3000) {
                                    recoverDecodingErrorDate = now;
                                    hls.recoverMediaError();
                                } else if (!recoverSwapAudioCodecDate || (now - recoverSwapAudioCodecDate) > 3000) {
                                    recoverSwapAudioCodecDate = now;
                                    hls.swapAudioCodec();
                                    hls.recoverMediaError();
                                } else {
                                    hls.destroy();
                                    setStreamUrl(null);
                                }
                                break;
                            default:
                                hls.destroy();
                                setStreamUrl(null);
                                break;
                        }
                    }
                });
            } else if (videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                videoRef.current.src = streamUrl;
                videoRef.current.addEventListener('loadedmetadata', () => {
                    videoRef.current.play();
                });

                videoRef.current.onerror = () => {
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

    useEffect(() => {
        if (shouldMuteAll) setIsMuted(true);
    }, [shouldMuteAll]);

    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = isMuted ? 0 : volume;
        }
    }, [isMuted, volume]);

    const changeQuality = (levelId) => {
        if (hlsRef.current) {
            hlsRef.current.currentLevel = levelId;
            setCurrentQuality(levelId);
            setShowQualityMenu(false);
        }
    };

    const toggleMute = () => setIsMuted(!isMuted);
    const reload = () => setKey(prev => prev + 1);

    const togglePlay = (e) => {
        e.stopPropagation();
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                if (hlsRef.current) hlsRef.current.stopLoad();
            } else {
                jumpToLive();
            }
            setIsPlaying(!isPlaying);
        }
    };

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

    const jumpToLive = () => {
        if (hlsRef.current) {
            hlsRef.current.startLoad();
            if (videoRef.current && videoRef.current.seekable.length > 0) {
                videoRef.current.currentTime = videoRef.current.seekable.end(0) - 1.0;
                videoRef.current.play().catch(console.warn);
            }
        } else if (videoRef.current) {
            if (videoRef.current.seekable.length > 0) {
                videoRef.current.currentTime = videoRef.current.seekable.end(0) - 1.0;
            }
        }
    };

    const formatViewers = (count) => {
        if (count >= 1000) return (count / 1000).toFixed(1) + 'k';
        return count;
    };

    return (
        <div
            ref={playerRef}
            onClick={handleContainerClick}
            onDoubleClick={!isMobile ? onToggleMaximize : undefined}
            className="relative w-full h-full bg-black border border-white/5 rounded-xl overflow-hidden flex flex-col group shadow-2xl ring-1 ring-white/5 hover:ring-kick-green/30 transition-all duration-300 pointer-events-auto"
        >
            {isMobile && isMaximized && showMobileControls && (
                <div className="absolute top-2 left-1/2 -translate-x-1/2 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleMaximize(); }}
                        className="bg-black/80 backdrop-blur-md border border-white/20 text-white px-4 py-2 rounded-full flex items-center gap-2 shadow-xl active:scale-95 transition-transform"
                    >
                        <X size={14} />
                        <span className="text-xs font-bold">Volver a pantallas</span>
                    </button>
                </div>
            )}

            <div className={`absolute top-4 left-4 z-30 flex flex-col gap-2 pointer-events-none transition-opacity duration-300 ${isMobile ? (showMobileControls ? 'opacity-100' : 'opacity-0') : 'opacity-0 group-hover:opacity-100'}`}>
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
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 z-10 p-2 text-center">
                        <div className="w-10 h-10 md:w-16 md:h-16 mb-2 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                            <VideoOff size={20} className="text-gray-500 md:w-8 md:h-8" />
                        </div>
                        <p className="font-bold text-xs md:text-lg text-gray-400 break-words w-full px-2 leading-tight">
                            {channel} <span className="block md:inline font-normal opacity-70">Desconectado</span>
                        </p>
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
                    <div className="absolute top-4 right-4 z-40 block">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setIsMuted(false);
                            }}
                            className="bg-black/50 backdrop-blur-sm border border-red-500/50 text-red-500 hover:bg-red-500 hover:text-white p-2 rounded-full flex items-center justify-center transition-all shadow-xl animate-in zoom-in-95 hover:scale-110"
                            title="Click para activar sonido"
                        >
                            <VolumeX size={20} strokeWidth={1.5} />
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

                <div className={`absolute bottom-0 inset-x-0 p-2 md:p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent transition-all duration-300 z-20 flex items-center justify-between gap-2 transform ${isMobile ? (showMobileControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-[10px]') : 'opacity-0 group-hover:opacity-100 translate-y-[10px] group-hover:translate-y-0'}`}>
                    <div className="flex items-center gap-2 md:gap-3">
                        <div className="flex items-center gap-1.5">
                            <span className={`w-1.5 h-1.5 md:w-2 md:h-2 rounded-full ${isOffline ? 'bg-gray-500' : 'bg-kick-green animate-pulse shadow-[0_0_10px_#53fc18]'}`}></span>
                        </div>

                        {!isOffline && streamStats?.viewers !== undefined && (
                            <div className="flex items-center gap-1 text-white/90 text-[8px] md:text-[10px] font-bold">
                                <Users size={10} className="text-kick-green" />
                                <span>{formatViewers(streamStats.viewers)}</span>
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-1 md:gap-1.5">
                        <div className="relative group/tooltip">
                            <button
                                onClick={togglePlay}
                                className="p-1 md:p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                            >
                                {isPlaying ? <Pause size={14} className="md:w-4 md:h-4" /> : <Play size={14} className="md:w-4 md:h-4" />}
                            </button>
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[60]">
                                {isPlaying ? "Pausar" : "Reproducir"}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-white"></div>
                            </div>
                        </div>

                        {useCustomPlayer && qualities.length > 0 && !isOffline && (
                            <div className="relative group/tooltip">
                                <button
                                    onClick={() => setShowQualityMenu(!showQualityMenu)}
                                    className={`p-1 md:p-1.5 rounded-md hover:bg-white/10 text-white transition-colors ${showQualityMenu ? 'text-kick-green' : ''}`}
                                >
                                    <Settings size={14} className="md:w-4 md:h-4" />
                                </button>
                                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[60]">
                                    Calidad
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-white"></div>
                                </div>
                            </div>
                        )}

                        <div className="relative group/volume flex items-center">
                            <button
                                onClick={(e) => { e.stopPropagation(); toggleMute(); }}
                                className="p-1 md:p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                            >
                                {isMuted ? <VolumeX size={14} className="md:w-4 md:h-4" /> : <Volume2 size={14} className="md:w-4 md:h-4" />}
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

                        <div className="relative group/tooltip">
                            <button
                                onClick={(e) => { e.stopPropagation(); jumpToLive(); }}
                                className="p-1 md:p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                            >
                                <Zap size={14} className="md:w-4 md:h-4 text-yellow-400 fill-yellow-400" />
                            </button>
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[60]">
                                Sacar Delay
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-white"></div>
                            </div>
                        </div>

                        <div className="relative group/tooltip">
                            <button
                                onClick={(e) => { e.stopPropagation(); reload(); }}
                                className="p-1 md:p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                            >
                                <RefreshCw size={14} className="md:w-4 md:h-4" />
                            </button>
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[60]">
                                Recargar
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-white"></div>
                            </div>
                        </div>

                        <div className="relative group/tooltip">
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleMaximize(); }}
                                className="p-1 md:p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                            >
                                {isMaximized ? <Minimize2 size={14} className="md:w-4 md:h-4" /> : <Maximize size={14} className="md:w-4 md:h-4" />}
                            </button>
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[60]">
                                {isMaximized ? "Achicar" : "Maximizar"}
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-white"></div>
                            </div>
                        </div>

                        <div className="relative group/tooltip ml-1">
                            <button
                                onClick={(e) => { e.stopPropagation(); onRemove(channel); }}
                                className="p-1 md:p-1.5 rounded-md hover:bg-red-500/20 text-red-400 hover:text-white transition-colors"
                            >
                                <X size={14} className="md:w-4 md:h-4" />
                            </button>
                            <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 bg-white text-black text-[10px] font-bold px-2 py-1 rounded shadow-md opacity-0 group-hover/tooltip:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-[60]">
                                Remover
                                <div className="absolute top-full left-1/2 -translate-x-1/2 border-[4px] border-transparent border-t-white"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default KickPlayer;