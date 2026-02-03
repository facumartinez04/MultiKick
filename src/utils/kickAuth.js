// PKCE Helper Functions

const generateRandomString = (length) => {
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~';
    let text = '';
    for (let i = 0; i < length; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
};

const sha256 = async (plain) => {
    const encoder = new TextEncoder();
    const data = encoder.encode(plain);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return hash;
};

const base64urlencode = (a) => {
    const str = "";
    const bytes = new Uint8Array(a);
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        str += String.fromCharCode(bytes[i]);
    }
    return btoa(str)
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');
};

const generateCodeChallenge = async (v) => {
    const hashed = await sha256(v);
    const base64encoded = base64urlencode(hashed);
    return base64encoded;
};

// -- Main Auth Functions --

export const initiateLogin = async () => {
    const clientId = import.meta.env.VITE_KICK_CLIENT_ID;
    const redirectUri = import.meta.env.VITE_KICK_REDIRECT_URI;

    if (!clientId) {
        alert("Falta configurar VITE_KICK_CLIENT_ID en el archivo .env");
        return;
    }

    const codeVerifier = generateRandomString(128);
    const codeChallenge = await generateCodeChallenge(codeVerifier);

    // Save verifier for later
    localStorage.setItem('kick_code_verifier', codeVerifier);

    const scope = 'chat:write user:read'; // Adjust scopes as needed
    const authUrl = `https://id.kick.com/oauth/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&code_challenge=${codeChallenge}&code_challenge_method=S256`;

    window.location.href = authUrl;
};

export const handleCallback = async (code) => {
    const clientId = import.meta.env.VITE_KICK_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_KICK_CLIENT_SECRET; // Only usage if flow requires it, with PKCE usually not needed but Kick might require it if Client Type is Confidential.
    const redirectUri = import.meta.env.VITE_KICK_REDIRECT_URI;
    const codeVerifier = localStorage.getItem('kick_code_verifier');

    if (!codeVerifier) {
        throw new Error('No code verifier found');
    }

    // Prepare Body
    const params = new URLSearchParams();
    params.append('grant_type', 'authorization_code');
    params.append('client_id', clientId);
    params.append('redirect_uri', redirectUri);
    params.append('code', code);
    params.append('code_verifier', codeVerifier);

    // Some implementations require secret even with PKCE if client is "confidential"
    if (clientSecret) {
        params.append('client_secret', clientSecret);
    }

    const response = await fetch('https://id.kick.com/oauth/token', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${errorText}`);
    }

    const data = await response.json();
    return data; // contains access_token, etc.
};
