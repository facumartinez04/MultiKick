const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors());

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins for simplicity in this setup
        methods: ["GET", "POST"]
    }
});

const ADMIN_PASSWORD = 'admin123';

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

// Endpoint para consultar online-count (PROTEGIDO)
app.get('/api/online-count', (req, res) => {
    const password = req.query.password;

    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: "Unauthorized: Access denied" });
    }

    res.json({ count: io.engine.clientsCount });
});

// Endpoint para ADMIN DATA (PROTEGIDO)
// Devuelve lista de sockets conectados con detalles básicos
app.get('/api/admin/data', async (req, res) => {
    const password = req.query.password;

    if (password !== ADMIN_PASSWORD) {
        return res.status(403).json({ error: "Unauthorized: Access denied" });
    }

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
