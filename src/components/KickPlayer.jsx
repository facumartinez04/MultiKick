import React, { useState, useEffect, useRef } from 'react';
import { X, RefreshCw, Volume2, VolumeX, Maximize2, Minimize2, Settings } from 'lucide-react';
import ReactPlayer from 'react-player';
import { getChannelInfo } from '../utils/kickApi';

const KickPlayer = ({ channel, onRemove, shouldMuteAll, isMaximized, onToggleMaximize }) => {
    const [key, setKey] = useState(0);
    const [isMuted, setIsMuted] = useState(true);
    const [streamUrl, setStreamUrl] = useState(null);
    const [useCustomPlayer, setUseCustomPlayer] = useState(true);
    const playerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        const fetchStream = async () => {
            setUseCustomPlayer(true); // Reset to try custom player first
            try {
                const data = await getChannelInfo(channel);

                if (isMounted) {
                    if (data && data.playback_url) {
                        setStreamUrl(data.playback_url);
                    } else {
                        // If no playback_url found (offline or api change), fall back
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
    }, [channel, useCustomPlayer]);

    useEffect(() => {
        if (shouldMuteAll) {
            setIsMuted(true);
        }
    }, [shouldMuteAll]);

    const reload = () => {
        setKey(prev => prev + 1);
    };

    const toggleMute = () => {
        setIsMuted(!isMuted);
        // We probably don't need to force key update if src changes, but let's ensure it reloads
        // React handles src changes on iframes by reloading them.
    };

    return (
        <div className="relative w-full h-full bg-black border border-white/5 rounded-xl overflow-hidden flex flex-col group shadow-2xl ring-1 ring-white/5 hover:ring-kick-green/30 transition-all duration-300">
            <div className="flex-grow relative">
                {useCustomPlayer && streamUrl ? (
                    <ReactPlayer
                        ref={playerRef}
                        key={`player-${key}`}
                        url={streamUrl}
                        playing={true}
                        muted={isMuted}
                        volume={isMuted ? 0 : 0.5}
                        playsinline={true}
                        width="100%"
                        height="100%"
                        controls={true} // Enable default controls for quality/volume
                        config={{
                            file: {
                                forceHLS: true,
                                hlsOptions: {
                                    autoStartLoad: true,
                                    startPosition: -1,
                                    debug: false,
                                }
                            }
                        }}
                        onError={() => setUseCustomPlayer(false)} // Fallback to iframe
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
