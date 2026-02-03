export const getChannelInfo = async (channelSlug) => {
    try {
        const response = await fetch(`https://multikick.com/api/kick/${channelSlug}`);
        if (!response.ok) throw new Error('Failed to fetch channel info');
        const data = await response.json();
        return {
            userId: data.user_id,
            chatroomId: data.chatroom?.id
        };
    } catch (error) {
        console.error("Error fetching channel info:", error);
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
