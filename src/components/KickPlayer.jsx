import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Volume2, VolumeX, Maximize2, Minimize2, Settings, VideoOff } from 'lucide-react';
import { getChannelInfo } from '../utils/kickApi';
import Hls from 'hls.js';

const KickPlayer = ({ channel, onRemove, shouldMuteAll, isMaximized, onToggleMaximize }) => {
    const [key, setKey] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [streamUrl, setStreamUrl] = useState(null);
    const [useCustomPlayer, setUseCustomPlayer] = useState(true);
    const [isOffline, setIsOffline] = useState(false);

    // Quality Control State
    const [qualities, setQualities] = useState([]);
    const [currentQuality, setCurrentQuality] = useState(-1); // -1 = Auto
    const [showQualityMenu, setShowQualityMenu] = useState(false);

    // Refs
    const videoRef = useRef(null);
    const hlsRef = useRef(null);

    // 1. Fetch Channel Info with Auto-Retry
    useEffect(() => {
        let isMounted = true;
        let retryTimeout = null;

        const fetchStream = async () => {
            setUseCustomPlayer(true);
            try {
                const data = await getChannelInfo(channel);
                if (isMounted) {
                    if (data && data.playback_url) {
                        console.log(`[${channel}] Stream URL found.`);
                        setStreamUrl(data.playback_url);
                        setIsOffline(false);
                    } else {
                        console.warn(`[${channel}] No playback_url. Retrying in 5s...`);
                        setIsOffline(true);
                        setStreamUrl(null);
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
    }, [channel]);

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

        initPlayer();

        return () => {
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
            videoRef.current.volume = isMuted ? 0 : 1;
        }
    }, [isMuted]);

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

    return (
        <div className="relative w-full h-full bg-black border border-white/5 rounded-xl overflow-hidden flex flex-col group shadow-2xl ring-1 ring-white/5 hover:ring-kick-green/30 transition-all duration-300">
            {/* Branding Watermark */}
            <div className="absolute top-4 left-4 z-20 pointer-events-none opacity-50 group-hover:opacity-100 transition-opacity">
                <span className="text-white/80 font-black italic tracking-tighter text-sm drop-shadow-md">
                    MULTIKICK<span className="text-kick-green">.LAT</span>
                </span>
            </div>

            <div className="flex-grow relative bg-zinc-900">

                {/* Visual Offline State */}
                {isOffline ? (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-900/95 z-10 p-4 text-center">
                        <div className="w-16 h-16 mb-4 rounded-full bg-white/5 flex items-center justify-center animate-pulse">
                            <VideoOff size={32} className="text-gray-500" />
                        </div>
                        <p className="font-bold text-lg text-gray-400">{channel} is Offline</p>
                        <p className="text-xs text-kick-green mt-2 font-mono">RETRYING SIGNAL...</p>
                    </div>
                ) : useCustomPlayer && streamUrl ? (
                    <video
                        ref={videoRef}
                        className="w-full h-full object-contain bg-black"
                        playsInline
                        muted={isMuted}
                        autoPlay
                    />
                ) : (
                    <div className="absolute inset-0 flex items-center justify-center bg-black">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-kick-green"></div>
                    </div>
                )}

                {/* Quality Menu Overlay */}
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

                {/* Controls Bar */}
                <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-300 z-20 flex items-center justify-between gap-2 transform translate-y-[10px] group-hover:translate-y-0">

                    {/* Left: Channel Info */}
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${isOffline ? 'bg-gray-500' : 'bg-kick-green animate-pulse shadow-[0_0_10px_#53fc18]'}`}></span>
                        <span className="text-white text-xs font-bold uppercase tracking-wider">{channel}</span>
                    </div>

                    {/* Right: Actions */}
                    <div className="flex items-center gap-1.5">
                        {useCustomPlayer && qualities.length > 0 && !isOffline && (
                            <button
                                onClick={() => setShowQualityMenu(!showQualityMenu)}
                                className={`p-1.5 rounded-md hover:bg-white/10 text-white transition-colors ${showQualityMenu ? 'text-kick-green' : ''}`}
                                title="Quality"
                            >
                                <Settings size={16} />
                            </button>
                        )}

                        <button
                            onClick={toggleMute}
                            className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                        >
                            {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                        </button>

                        <button
                            onClick={reload}
                            className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                        >
                            <RefreshCw size={16} />
                        </button>

                        <button
                            onClick={onToggleMaximize}
                            className="p-1.5 rounded-md hover:bg-white/10 text-white transition-colors"
                        >
                            {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>

                        <button
                            onClick={() => onRemove(channel)}
                            className="p-1.5 rounded-md hover:bg-red-500/20 text-red-400 hover:text-white transition-colors ml-1"
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
