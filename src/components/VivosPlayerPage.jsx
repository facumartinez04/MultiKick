import React, { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { ArrowLeft, Radio, Trophy, Monitor } from 'lucide-react';

const VivosPlayerPage = () => {
    const videoRef = useRef(null);
    const [m3u8Url, setM3u8Url] = useState(() => {
        if (window.location.pathname.toLowerCase() === '/vivos/ver9z') {
            return "https://sae12.playlist.ttvnw.net/v1/playlist/CtIGTKDzzTg6M67r_SfVU2BZjIrv7ZU0dCq01BYH-Uk7idkWjhAIN8BFIdg_h_kud0woIXzeUicbOA10FZTKuRnMGEpRU6LBaKkoXPw2aUF4t9Q8mT6p6WQqMm41cE-4_01y7K5aWyQLwwIEF8fLb4ilQYUm26ZGrzgpEPDbT-sjkYTyQD1RnxdayJFkeHgMQMmC8clbABdiJyq6qhPag4efCE6CpJ9G44ozqQzeRCDhXBtCsSqmVcfPMa7WHggcimoWI4BH8OG9XlU-v_ANk1U5R3qWV8dPeTYXkRmsdc7YhUTrVDL648WMfWqFPcQNLdkdOEx_AZASNJ8TGb8unjtqoWTkwFB42GC90msMUZt8GgnwhKfnH1LrU6jlnHzEJqzjOST-DQFOSQUZsIOxttuGZVs1Zgpafe0YF1nQxN43BNfpJa27Lv7A_8ihtCNihtolEMFZRCYPTA7A_KW--n6DvBgSfO8-F7MsS5HV7UtQ81VdcwP0ve4JtZFkrbuJcKRfUw4Qb4BrKFZfwI0PL_xfBjJReHnf9Y1V0KyOz3_C4eXTh54sO5kxqVSqw1bcK3OjRWnggaQPVAL9XYo-x3_T4-5Z06ZJhoC83h0a9mSeyUlMING3QUQ6R6ZKid7qbYvRu1feHDKfhk_wsL-1hVxq8_5FchVWDEbuYLv3r2gJvplFUfWlQ1L2KnO0eoexqolJYJggkn30ACw76sP5GjLWt_CFDPWD0A8f9lSdU1RGlAbXi8hGFX0AsyL3rkMtYuVYwFHf_-mHbk5Wn3TK04cb34e28THZmkIAUEJkPk_dm3y6Cc27CBS8l_pI23hiXcrtgrrorSDtY0IKLa1wBPNvze44ZieLhY9IMzoIJsrqT7uqsrH96Gwv5oZKI1N3sMQZSxOk696gZaAxos2qy9i2ffv5PB8JFPS6qwFNsQvuejPeZLKQs1DzQIrjinzQwhqFn7YffEbbAxLQLuIW3BLeUVB_hEiWnEtPQJW88WkN_4nic-JTN-trX0bKkC6mPXE8MYuUkL3UisqzuHQRYSr6YHAUqyuRMKv-wvfWF7JZqqreh0g8ZzKGjA-k9gqtIFx-UP94bfjtoXS8a7qnE86kPRFU_yX8xBEVNlOkeFx4tM638hoMrbjmjixa4feELGxhIAEqCXVzLWVhc3QtMjDHDg.m3u8";
        }
        return new URLSearchParams(window.location.search).get('url');
    });

    const [error, setError] = useState(m3u8Url ? null : "No se proporcionó una URL. Usa /vivos/loquesea?url=TU_M3U8");
    const [isPlaying, setIsPlaying] = useState(true);

    const isTwitch = m3u8Url && m3u8Url.startsWith('twitch:');
    const twitchChannel = isTwitch ? m3u8Url.split(':')[1] : null;

    useEffect(() => {
        if (!m3u8Url || isTwitch) return;

        const video = videoRef.current;
        if (!video) return;

        // Cargar m3u8 directamente sin proxy
        const streamUrl = m3u8Url;

        let hls;

        if (Hls.isSupported()) {
            hls = new Hls({});

            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                video.play().catch(e => {
                    console.error("Error al reproducir el video:", e);
                    setIsPlaying(false);
                });
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
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => {
                    console.error("Error al reproducir el video:", e);
                    setIsPlaying(false);
                });
            });
        }
    }, [m3u8Url]);

    return (
        <div className="w-full h-screen bg-[#050011] text-white flex flex-col font-sans overflow-hidden">
            {/* Header 9z Style */}
            <header className="h-16 flex items-center justify-between px-6 border-b border-[#2c0b5f] bg-[#0a001a]/90 backdrop-blur-md z-50 shrink-0">
                <div className="flex items-center gap-4">
                    <a href="/" className="group p-2 bg-[#2c0b5f]/40 rounded-lg hover:bg-[#7D22DF] transition-all duration-300">
                        <ArrowLeft size={20} className="text-[#c18df6] group-hover:text-white" />
                    </a>
                    <div className="flex flex-col">
                        <h1 className="text-xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#7D22DF] to-[#b666ff]">
                            9z Team
                        </h1>
                        <span className="text-[10px] text-[#c18df6] font-bold uppercase tracking-wider flex items-center gap-1">
                            <Monitor size={10} /> Exclusive Stream
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 px-3 py-1 bg-red-600/20 border border-red-500/50 rounded-full animate-pulse">
                        <Radio size={14} className="text-red-500" />
                        <span className="text-xs font-bold text-red-500 uppercase tracking-wider">En vivo</span>
                    </div>
                    <div className="hidden sm:flex items-center gap-2 text-[#7D22DF]">
                        <Trophy size={20} />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 flex flex-col items-center justify-center relative p-4 lg:p-8 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1d0047] via-[#050011] to-black">
                {/* Decorative Elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
                    <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#7D22DF] opacity-[0.03] blur-[120px] rounded-full"></div>
                    <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#7D22DF] opacity-[0.03] blur-[120px] rounded-full"></div>
                </div>

                <div className="w-full max-w-[1600px] h-full flex flex-col items-center justify-center z-10">
                    {error ? (
                        <div className="flex flex-col items-center gap-4 p-8 bg-[#1a0033]/50 border-2 border-[#7D22DF]/30 rounded-2xl backdrop-blur-md">
                            <Radio size={48} className="text-red-500 mb-2" />
                            <h2 className="text-2xl font-black uppercase text-white">Stream Error</h2>
                            <p className="text-[#c18df6] text-center max-w-md">{error}</p>
                            <a href="/" className="mt-4 px-6 py-2 bg-[#7D22DF] hover:bg-[#913bfa] text-white font-bold rounded-lg transition-colors uppercase tracking-widest text-sm">
                                Volver al inicio
                            </a>
                        </div>
                    ) : (
                        <div className="relative w-full h-full max-h-full rounded-xl overflow-hidden shadow-[0_0_50px_rgba(125,34,223,0.15)] border border-[#2c0b5f] bg-black">
                            {isTwitch ? (
                                <iframe
                                    src={`https://player.twitch.tv/?channel=${twitchChannel}&parent=${window.location.hostname}&muted=false`}
                                    height="100%"
                                    width="100%"
                                    allowFullScreen
                                    className="w-full h-full border-none"
                                />
                            ) : (
                                <>
                                    <video
                                        ref={videoRef}
                                        controls
                                        autoPlay
                                        playsInline
                                        className="w-full h-full object-contain bg-black"
                                    />
                                    {!isPlaying && (
                                        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                                            <button
                                                onClick={() => {
                                                    videoRef.current?.play();
                                                    setIsPlaying(true);
                                                }}
                                                className="px-8 py-4 bg-[#7D22DF] hover:scale-105 hover:bg-[#913bfa] text-white rounded-xl font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(125,34,223,0.5)]"
                                            >
                                                Haz clic para reanudar
                                            </button>
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default VivosPlayerPage;
