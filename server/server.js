const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

require('dotenv').config();

const app = express();
app.use(cors());

// Middleware
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in this setup
        methods: ["GET", "POST"]
    }
});

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
const ADMIN_TOKEN = process.env.ADMIN_TOKEN;
const fs = require('fs');
const path = require('path');
const SLUGS_FILE = path.join(__dirname, 'slugs.json');

// Middleware de Autenticación
const authenticateAdmin = (req, res, next) => {
    const password = req.query.password;
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (password === ADMIN_PASSWORD || token === ADMIN_TOKEN) {
        return next();
    }
    return res.status(401).json({ error: "Unauthorized: Access denied" });
};

// Helper functions for Slug persistence
const readSlugs = () => {
    try {
        if (!fs.existsSync(SLUGS_FILE)) return {};
        const data = fs.readFileSync(SLUGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error("Error reading slugs file:", e);
        return {};
    }
};

const writeSlugs = (slugs) => {
    try {
        fs.writeFileSync(SLUGS_FILE, JSON.stringify(slugs, null, 2));
    } catch (e) {
        console.error("Error writing slugs file:", e);
    }
};

// Lógica de Socket.io para contar usuarios
io.on('connection', (socket) => {
    console.log('Un usuario se ha conectado. ID:', socket.id);

    // Obtener el número de clientes conectados
    const count = io.engine.clientsCount;

    // Emitir a TODOS los clientes la nueva cantidad
    io.emit('online_users', { count: count });

    socket.on('disconnect', () => {
        console.log('Un usuario se ha desconectado. ID:', socket.id);
        const newCount = io.engine.clientsCount; // Socket.io actualiza esto automáticamente tras disconnect
        io.emit('online_users', { count: newCount });
    });
});

// Endpoint Login (Obtener Token)
app.post('/api/admin/login', (req, res) => {
    const { password } = req.body;
    if (password === ADMIN_PASSWORD) {
        res.json({ token: ADMIN_TOKEN });
    } else {
        res.status(401).json({ error: "Unauthorized" });
    }
});

// Endpoint para consultar online-count (PROTEGIDO)
app.get('/api/online-count', authenticateAdmin, (req, res) => {
    res.json({ count: io.engine.clientsCount });
});

// Endpoint para Validar Contraseña (Admin) - Mantenido por compatibilidad o chequeo simple
app.get('/api/admin/validate', (req, res) => {
    const password = req.query.password;
    if (password === ADMIN_PASSWORD) {
        res.json({ valid: true });
    } else {
        res.status(403).json({ error: "Acceso denegado: Contraseña incorrecta" });
    }
});

// Endpoint para Crear Slug (Admin - PROTEGIDO)
app.post('/api/admin/slug', authenticateAdmin, (req, res) => {
    const { slug, channels } = req.body;
    if (!slug || !channels || !Array.isArray(channels)) {
        return res.status(400).json({ error: "Invalid data. 'slug' must be a string and 'channels' must be an array." });
    }

    const slugs = readSlugs();
    slugs[slug] = channels;
    writeSlugs(slugs);

    res.json({ message: "Slug created successfully", slug, channels });
});

// Endpoint para Editar Slug (Admin - PROTEGIDO)
app.put('/api/admin/slug/:slug', authenticateAdmin, (req, res) => {
    const { slug } = req.params;
    const { channels } = req.body;

    if (!channels || !Array.isArray(channels)) {
        return res.status(400).json({ error: "Invalid data. 'channels' must be an array." });
    }

    const slugs = readSlugs();
    if (!slugs[slug]) {
        return res.status(404).json({ error: "Slug not found" });
    }

    slugs[slug] = channels;
    writeSlugs(slugs);

    res.json({ message: "slug actualizado exitosamente", slug, channels });
});

// Endpoint para Listar Slugs (Admin - PROTEGIDO)
app.get('/api/admin/slugs', authenticateAdmin, (req, res) => {
    const slugsMap = readSlugs();
    const slugsArray = Object.keys(slugsMap).map(key => ({
        slug: key,
        channels: slugsMap[key]
    }));

    res.json({ slugs: slugsArray });
});

// Endpoint para Obtener Canales por Slug (PÚBLICO)
app.get('/api/slug/:slug', (req, res) => {
    const { slug } = req.params;
    const slugs = readSlugs();

    if (slugs[slug]) {
        res.json({ channels: slugs[slug] });
    } else {
        res.status(404).json({ error: "Slug not found" });
    }
});

// Endpoint para ADMIN DATA (PROTEGIDO)
app.get('/api/admin/data', authenticateAdmin, async (req, res) => {
    try {
        const sockets = await io.fetchSockets();
        const users = sockets.map(socket => ({
            id: socket.id,
            handshake: socket.handshake.time,
            address: socket.handshake.address
        }));

        res.json({
            total: users.length,
            users: users
        });
    } catch (error) {
        console.error("Error fetching sockets:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Socket.io Server running on port ${PORT}`);
});

