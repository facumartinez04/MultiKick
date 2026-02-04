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
    let str = "";
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

    const scope = 'user:read chat:write';
    const state = generateRandomString(32); // CSRF Protection
    localStorage.setItem('kick_auth_state', state);

    // Clean inputs to avoid whitespace errors
    const cleanClientId = clientId.trim();
    const cleanRedirectUri = redirectUri.trim();

    const authUrl = `https://id.kick.com/oauth/authorize?response_type=code&client_id=${cleanClientId}&redirect_uri=${encodeURIComponent(cleanRedirectUri)}&scope=${encodeURIComponent(scope)}&code_challenge=${codeChallenge}&code_challenge_method=S256&state=${state}`;

    console.log("Redirecting to Kick Auth:", authUrl);
    window.location.href = authUrl;
};

export const handleCallback = async (code) => {
    const clientId = import.meta.env.VITE_KICK_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_KICK_CLIENT_SECRET;
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

    const tokenData = await response.json();

    // Fetch User Data immediately
    try {
        const userData = await fetchCurrentUser(tokenData.access_token);
        return { ...tokenData, user: userData };
    } catch (e) {
        console.error("Failed to fetch user data after login", e);
        return tokenData;
    }
};

export const fetchCurrentUser = async (token) => {
    const response = await fetch('https://api.kick.com/public/v1/users', {
        headers: {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        }
    });

    if (!response.ok) {
        throw new Error('Failed to fetch user');
    }

    const json = await response.json();

    if (json.data && Array.isArray(json.data) && json.data.length > 0) {
        return json.data[0];
    }
    return json;
};

export const refreshAccessToken = async (refreshToken) => {
    const clientId = import.meta.env.VITE_KICK_CLIENT_ID;
    const clientSecret = import.meta.env.VITE_KICK_CLIENT_SECRET;

    const params = new URLSearchParams();
    params.append('grant_type', 'refresh_token');
    params.append('refresh_token', refreshToken);
    params.append('client_id', clientId);

    if (clientSecret) {
        params.append('client_secret', clientSecret);
    }

    try {
        const response = await fetch('https://id.kick.com/oauth/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: params
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Token refresh failed: ${errorText}`);
        }

        const data = await response.json();
        return data; // Returns { access_token, refresh_token, expires_in, etc }
    } catch (e) {
        console.error("Failed to refresh token", e);
        throw e;
    }
};
