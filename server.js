const http = require('http');
const path = require('path');
const express = require('express');
const { Server } = require('socket.io');
const registerChatHandlers = require('./src/socket/chatHandler');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const PORT = process.env.PORT || 3000;

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// API Healthcheck Endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    service: 'realtime-workspace-chat',
    uptime: Math.floor(process.uptime()),
    timestamp: new Date().toISOString()
  });
});

// Register WebSocket Event Handlers
registerChatHandlers(io);

server.listen(PORT, () => {
  console.log(`[server] Real-Time Workspace Server listening on http://localhost:${PORT}`);
});