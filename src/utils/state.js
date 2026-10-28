const VALID_CHANNELS = ['general', 'engineering', 'deployments'];
const MAX_HISTORY_PER_CHANNEL = 50;

const activeUsers = new Map();

const channelHistory = {
  general: [],
  engineering: [],
  deployments: []
};

function sanitizeText(input, maxLength = 500) {
  if (typeof input !== 'string') return '';
  return input
    .trim()
    .slice(0, maxLength)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function addUser(socketId, username, role, channel) {
  const cleanChannel = VALID_CHANNELS.includes(channel) ? channel : 'general';
  const user = {
    id: socketId,
    username: sanitizeText(username, 24) || `user_${socketId.slice(0, 4)}`,
    role: sanitizeText(role, 20) || 'DEVELOPER',
    channel: cleanChannel,
    joinedAt: new Date().toISOString()
  };
  activeUsers.set(socketId, user);
  return user;
}

function getUser(socketId) {
  return activeUsers.get(socketId);
}

function removeUser(socketId) {
  const user = activeUsers.get(socketId);
  activeUsers.delete(socketId);
  return user;
}

function switchUserChannel(socketId, newChannel) {
  const user = activeUsers.get(socketId);
  if (!user || !VALID_CHANNELS.includes(newChannel)) return null;
  user.channel = newChannel;
  activeUsers.set(socketId, user);
  return user;
}

function getUsersInChannel(channel) {
  const list = [];
  for (const user of activeUsers.values()) {
    if (user.channel === channel) {
      list.push(user);
    }
  }
  return list;
}

function addMessageToHistory(channel, messageObj) {
  if (!channelHistory[channel]) return;
  channelHistory[channel].push(messageObj);
  if (channelHistory[channel].length > MAX_HISTORY_PER_CHANNEL) {
    channelHistory[channel].shift();
  }
}

function getChannelHistory(channel) {
  return channelHistory[channel] || [];
}

module.exports = {
  VALID_CHANNELS,
  sanitizeText,
  addUser,
  getUser,
  removeUser,
  switchUserChannel,
  getUsersInChannel,
  addMessageToHistory,
  getChannelHistory
};