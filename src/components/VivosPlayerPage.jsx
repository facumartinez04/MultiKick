import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';

const VivosPlayerPage = () => {
    const videoRef = useRef(null);
    const m3u8Url = new URLSearchParams(window.location.search).get('url');
    const [error, setError] = useState(m3u8Url ? null : "No se proporcionó una URL. Usa /vivos/loquesea?url=TU_M3U8");

    useEffect(() => {
        if (!m3u8Url) return;

        const video = videoRef.current;
        if (!video) return;

        // Use our backend proxy to bypass CORS and rewrite relative links
        const proxiedUrl = `https://kickplayer-ahzd.onrender.com/proxy?url=${encodeURIComponent(m3u8Url)}`;

        let hls;

        if (Hls.isSupported()) {
            hls = new Hls({
                // Optional: you can tune hls.js config here if needed
            });

            hls.loadSource(proxiedUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => console.error("Error al reproducir el video:", e));
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.error("fatal network error encountered, try to recover");
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.error("fatal media error encountered, try to recover");
                            hls.recoverMediaError();
                            break;
                        default:
                            hls.destroy();
                            setError("Error fatal al cargar el stream.");
                            break;
                    }
                }
            });

            return () => {
                hls.destroy();
            };
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // For Safari native HLS support
            video.src = proxiedUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.error("Error al reproducir el video:", e));
            });
        }
    }, []);

    return (
        <div className="w-full h-screen bg-black flex flex-col items-center justify-center relative">
            <div className="absolute top-4 left-4 z-50">
                <a href="/" className="px-4 py-2 bg-white/10 text-white rounded hover:bg-white/20 transition">
                    ← Volver
                </a>
            </div>
            {error ? (
                <div className="text-red-500 bg-red-500/10 px-6 py-4 rounded-lg border border-red-500/20">
                    {error}
                </div>
            ) : (
                <video
                    ref={videoRef}
                    controls
                    autoPlay
                    playsInline
                    className="w-full h-full object-contain"
                />
            )}
        </div>
    );
};

export default VivosPlayerPage;
