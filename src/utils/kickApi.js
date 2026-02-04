export const getChannelInfo = async (channelSlug, token = null) => {
    try {
        const headers = {};
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`https://kick.com/api/v2/channels/${channelSlug}`, {
            headers
        });
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

export const getChannelEmotes = async (channelSlug, token = null) => {
    try {
        const headers = { 'Accept': 'application/json' };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        // User requested URL: https://kick.com/emotes/[channel]
        // We try to fetch from there, but handle if it's not JSON (fallback to API v2)
        const response = await fetch(`https://kick.com/emotes/${channelSlug}`, {
            headers
        });

        const contentType = response.headers.get("content-type");
        if (response.ok && contentType && contentType.includes("application/json")) {
            return await response.json();
        }

        // Fallback: API V2
        const v2Response = await fetch(`https://kick.com/api/v2/channels/${channelSlug}/emotes`, {
            headers
        });
        if (v2Response.ok) {
            return await v2Response.json();
        }

        return [];
    } catch (e) {
        console.error("Error fetching kick channel emotes:", e);
        return [];
    }
};

export const getChannelUserRelationship = async (channelSlug, token = null) => {
    try {
        const headers = {
            'Accept': 'application/json'
        };

        console.log('Fetching relationship with token:', token);
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const response = await fetch(`https://kick.com/api/v2/channels/${channelSlug}/me`, {
            headers
        });

        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        console.error("Error fetching channel user relationship:", e);
        return null;
    }
};
