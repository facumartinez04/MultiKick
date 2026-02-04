import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Volume2, VolumeX, Maximize2, Minimize2, Settings } from 'lucide-react';
import { getChannelInfo } from '../utils/kickApi';
import Hls from 'hls.js';

const KickPlayer = ({ channel, onRemove, shouldMuteAll, isMaximized, onToggleMaximize }) => {
    const [key, setKey] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [streamUrl, setStreamUrl] = useState(null);
    const [useCustomPlayer, setUseCustomPlayer] = useState(true);

    // Refs for HLS and Video
    const videoRef = useRef(null);
    const hlsRef = useRef(null);

    // 1. Fetch Channel Info
    useEffect(() => {
        let isMounted = true;
        const fetchStream = async () => {
            setUseCustomPlayer(true);
            try {
                const data = await getChannelInfo(channel);
                console.log("DEBUG API FULL DATA:", data);

                if (isMounted) {
                    if (data && data.playback_url) {
                        console.log("DEBUG PLAYBACK URL:", data.playback_url);
                        setStreamUrl(data.playback_url);
                    } else {
                        console.warn(`No playback_url found for ${channel}`);
                        setUseCustomPlayer(false);
                    }
                }
            } catch (err) {
                console.error("Stream Fetch Error", err);
                if (isMounted) setUseCustomPlayer(false);
            }
        };

        if (useCustomPlayer) {
            fetchStream();
        }

        return () => { isMounted = false; };
    }, [channel, useCustomPlayer]);

    // 2. Initialize HLS Player
    useEffect(() => {
        let hls = null;

        const initPlayer = () => {
            if (useCustomPlayer && streamUrl && Hls.isSupported() && videoRef.current) {
                if (hlsRef.current) {
                    hlsRef.current.destroy();
                }

                hls = new Hls({
                    enableWorker: true,
                    lowLatencyMode: true,
                    backBufferLength: 90
                });

                hlsRef.current = hls;

                hls.loadSource(streamUrl);
                hls.attachMedia(videoRef.current);

                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    videoRef.current?.play().catch(e => {
                        console.warn("Autoplay blocked, user interaction needed", e);
                    });
                });

                hls.on(Hls.Events.ERROR, function (event, data) {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error("HLS: Network error:", data);
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error("HLS: Media error:", data);
                                hls.recoverMediaError();
                                break;
                            default:
                                console.error("HLS: Fatal error, destroying:", data);
                                hls.destroy();
                                setUseCustomPlayer(false);
                                break;
                        }
                    }
                });
            } else if (videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS support (Safari)
                videoRef.current.src = streamUrl;
                videoRef.current.addEventListener('loadedmetadata', () => {
                    videoRef.current.play();
                });
            }
        };

        initPlayer();

        return () => {
            if (hlsRef.current) {
                hlsRef.current.destroy();
            }
        };
    }, [streamUrl, useCustomPlayer]);

    // 3. Handle Global Mute
    useEffect(() => {
        if (shouldMuteAll) {
            setIsMuted(true);
        }
    }, [shouldMuteAll]);

    // 4. Syc Mute State with Video Element
    useEffect(() => {
        if (videoRef.current) {
            videoRef.current.muted = isMuted;
            videoRef.current.volume = isMuted ? 0 : 1;
        }
    }, [isMuted]);

    const reload = () => {
        setKey(prev => prev + 1);
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
    };

    return (
        <div className="relative w-full h-full bg-black border border-white/5 rounded-xl overflow-hidden flex flex-col group shadow-2xl ring-1 ring-white/5 hover:ring-kick-green/30 transition-all duration-300">
            <div className="flex-grow relative">
                {useCustomPlayer && streamUrl ? (
                    <video
                        ref={videoRef}
                        className="w-full h-full object-cover"
                        playsInline
                        muted={isMuted}
                        autoPlay
                    />
                ) : (
                    <iframe
                        key={key}
                        src={`https://player.kick.com/${channel}?autoplay=true&muted=${isMuted}`}
                        height="100%"
                        width="100%"
                        frameBorder="0"
                        scrolling="no"
                        allowFullScreen={true}
                        allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                        className="w-full h-full bg-black"
                    ></iframe>
                )}

                {/* Gradient Overlay for controls visibility */}
                <div className="absolute top-0 inset-x-0 h-16 bg-gradient-to-b from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />

                {/* Overlay Controls (visible on hover) */}
                <div className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 flex gap-2 transform translate-y-[-10px] group-hover:translate-y-0">
                    <button
                        onClick={toggleMute}
                        className={`p-2 bg-black/60 hover:text-black text-white rounded-lg backdrop-blur-md transition-all border border-white/10 shadow-lg ${isMuted ? 'hover:bg-red-500 hover:border-red-500' : 'hover:bg-kick-green hover:border-kick-green'}`}
                        title={isMuted ? "Unmute" : "Mute"}
                    >
                        {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    </button>
                    {/* Only show custom fallback toggle if needed or debug */}
                    {useCustomPlayer && (
                        <button
                            onClick={() => setUseCustomPlayer(false)}
                            className="p-2 bg-black/60 hover:bg-yellow-500 hover:text-black text-white rounded-lg backdrop-blur-md transition-all border border-white/10 shadow-lg"
                            title="Force Iframe (Classic)"
                        >
                            <Settings size={14} />
                        </button>
                    )}
                    <button
                        onClick={reload}
                        className="p-2 bg-black/60 hover:bg-kick-green hover:text-black text-white rounded-lg backdrop-blur-md transition-all border border-white/10 hover:border-kick-green shadow-lg"
                        title="Reload stream"
                    >
                        <RefreshCw size={14} />
                    </button>
                    <button
                        onClick={onToggleMaximize}
                        className="p-2 bg-black/60 hover:bg-kick-green hover:text-black text-white rounded-lg backdrop-blur-md transition-all border border-white/10 hover:border-kick-green shadow-lg"
                        title={isMaximized ? "Minimize" : "Maximize"}
                    >
                        {isMaximized ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    </button>
                    <button
                        onClick={() => onRemove(channel)}
                        className="p-2 bg-black/60 hover:bg-red-500 hover:text-white text-white rounded-lg backdrop-blur-md transition-all border border-white/10 hover:border-red-500 shadow-lg"
                        title="Close channel"
                    >
                        <X size={14} />
                    </button>
                </div>

                {/* Channel Name Label */}
                <div className="absolute bottom-4 left-4 pointer-events-none opacity-0 group-hover:opacity-100 transition-all duration-300 z-10 transform translate-y-[10px] group-hover:translate-y-0">
                    <span className="bg-black/90 text-white text-xs font-bold px-3 py-1.5 rounded-full border border-white/10 shadow-lg flex items-center gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-kick-green animate-pulse"></span>
                        {channel}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default KickPlayer;
