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

// Endpoint opcional para consultar vía HTTP
app.get('/api/online-count', (req, res) => {
    res.json({ count: io.engine.clientsCount });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Socket.io Server running on port ${PORT}`);
});
