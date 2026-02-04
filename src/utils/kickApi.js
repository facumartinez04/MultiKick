export const getChannelInfo = async (channelSlug) => {
    try {
        const response = await fetch(`https://kick.com/api/v2/channels/${channelSlug}`);
        if (!response.ok) throw new Error('Failed to fetch channel info');
        const data = await response.json();

        return data;
    } catch (error) {
        console.error("DEBUG: Error fetching channel info for", channelSlug, error);
        return null;
    }
};

export const sendChatMessage = async (token, broadcasterUserId, content) => {
    try {
        const response = await fetch('https://api.kick.com/public/v1/chat', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json',
                'Accept': '*/*'
            },
            body: JSON.stringify({
                broadcaster_user_id: broadcasterUserId,
                content: content,
                type: 'user'
            })
        });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`Failed to send message: ${errText}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
};

export const getKickEmotes = async () => {
    try {
        const response = await fetch('https://kick.com/api/v2/emotes/global');
        if (!response.ok) return [];
        return await response.json();
    } catch (e) {
        return [];
    }
};

export const get7TVEmotes = async (kickUserId) => {
    try {
        // 7TV uses Kick User ID for its v3 API
        const response = await fetch(`https://7tv.io/v3/users/KICK/${kickUserId}`);
        if (!response.ok) return [];
        const data = await response.json();
        // Extract emote set
        return data?.emote_set?.emotes || [];
    } catch (e) {
        return [];
    }
};
export const get7TVGlobalEmotes = async () => {
    try {
        const response = await fetch('https://7tv.io/v3/emote-sets/global');
        if (!response.ok) return [];
        const data = await response.json();
        return data?.emotes || [];
    } catch (e) {
        return [];
    }
};
