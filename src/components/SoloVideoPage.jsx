import React, { useState, useEffect } from 'react';
import KickPlayer from './KickPlayer';

import { ArrowLeft } from 'lucide-react';

const SoloVideoPage = ({ streamer }) => {
    return (
        <div className="fixed inset-0 bg-black w-screen h-screen overflow-hidden group">
            <button
                onClick={() => window.location.href = '/'}
                className="absolute top-4 left-4 z-50 p-3 bg-black/50 hover:bg-kick-green hover:text-black rounded-full text-white transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-2xl border border-white/10 backdrop-blur-md cursor-pointer"
                title="Volver al inicio"
            >
                <ArrowLeft size={24} />
            </button>
            <KickPlayer
                channel={streamer}
                onRemove={() => { }}
                shouldMuteAll={false}
                isMaximized={true}
                onToggleMaximize={() => { }}
                onMetaUpdate={() => { }}
                onViewersUpdate={() => { }}
                solo={true}
                full={true}
            />
        </div>
    );
};

export default SoloVideoPage;
