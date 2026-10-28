const {
  VALID_CHANNELS,
  sanitizeText,
  addUser,
  getUser,
  removeUser,
  switchUserChannel,
  getUsersInChannel,
  addMessageToHistory,
  getChannelHistory
} = require('../utils/state');

function createSystemMessage(text, channel) {
  return {
    id: `sys_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    type: 'SYSTEM',
    username: 'SYSTEM_KERNEL',
    role: 'CORE',
    text,
    channel,
    timestamp: new Date().toISOString()
  };
}

module.exports = function registerChatHandlers(io) {
  io.on('connection', (socket) => {
    console.log(`[socket] client connected: ${socket.id}`);

    // 1. Inisialisasi Sesi Pengguna ke Channel
    socket.on('session:join', ({ username, role, channel }) => {
      const user = addUser(socket.id, username, role, channel);
      socket.join(user.channel);

      // Kirim riwayat pesan channel kepada pengguna yang baru masuk
      socket.emit('channel:init', {
        channel: user.channel,
        history: getChannelHistory(user.channel),
        channels: VALID_CHANNELS,
        currentUser: user
      });

      // Beritahu pengguna lain di channel yang sama
      const sysMsg = createSystemMessage(
        `${user.username} [${user.role}] connected to #${user.channel}`,
        user.channel
      );
      io.to(user.channel).emit('message:receive', sysMsg);

      // Perbarui daftar pengguna aktif di channel tersebut
      io.to(user.channel).emit('presence:update', getUsersInChannel(user.channel));
    });

    // 2. Perpindahan Channel (Room Switching)
    socket.on('channel:switch', (targetChannel) => {
      const user = getUser(socket.id);
      if (!user || !VALID_CHANNELS.includes(targetChannel)) return;

      const previousChannel = user.channel;
      if (previousChannel === targetChannel) return;

      socket.leave(previousChannel);
      io.to(previousChannel).emit(
        'message:receive',
        createSystemMessage(`${user.username} switched to #${targetChannel}`, previousChannel)
      );
      io.to(previousChannel).emit('presence:update', getUsersInChannel(previousChannel));

      // Pindah ke channel baru
      const updatedUser = switchUserChannel(socket.id, targetChannel);
      socket.join(targetChannel);

      socket.emit('channel:init', {
        channel: targetChannel,
        history: getChannelHistory(targetChannel),
        channels: VALID_CHANNELS,
        currentUser: updatedUser
      });

      io.to(targetChannel).emit(
        'message:receive',
        createSystemMessage(`${updatedUser.username} joined #${targetChannel}`, targetChannel)
      );
      io.to(targetChannel).emit('presence:update', getUsersInChannel(targetChannel));
    });

    // 3. Pengiriman Pesan Real-Time
    socket.on('message:send', (rawText) => {
      const user = getUser(socket.id);
      if (!user) return;

      const cleanText = sanitizeText(rawText, 600);
      if (!cleanText) return;

      const messageData = {
        id: `msg_${Date.now()}_${socket.id.slice(0, 4)}`,
        type: 'USER',
        senderId: socket.id,
        username: user.username,
        role: user.role,
        text: cleanText,
        channel: user.channel,
        timestamp: new Date().toISOString()
      };

      addMessageToHistory(user.channel, messageData);
      io.to(user.channel).emit('message:receive', messageData);
    });

    // 4. Indikator Sedang Mengetik (Typing Telemetry)
    socket.on('typing:state', (isTyping) => {
      const user = getUser(socket.id);
      if (!user) return;

      socket.to(user.channel).emit('typing:update', {
        username: user.username,
        isTyping: Boolean(isTyping)
      });
    });

    // 5. Pengukuran Latency (Ping-Pong)
    socket.on('latency:ping', (clientTimestamp, callback) => {
      if (typeof callback === 'function') {
        callback(clientTimestamp);
      }
    });

    // 6. Penanganan Putus Koneksi (Disconnect)
    socket.on('disconnect', () => {
      const user = removeUser(socket.id);
      if (user) {
        io.to(user.channel).emit(
          'message:receive',
          createSystemMessage(`${user.username} disconnected from session`, user.channel)
        );
        io.to(user.channel).emit('presence:update', getUsersInChannel(user.channel));
      }
      console.log(`[socket] client disconnected: ${socket.id}`);
    });
  });
};