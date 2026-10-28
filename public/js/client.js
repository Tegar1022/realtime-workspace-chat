const socket = io({ autoConnect: false });

const state = {
  currentUser: null,
  activeChannel: 'general',
  typingTimeout: null
};

// DOM References
const authModal = document.getElementById('authModal');
const joinForm = document.getElementById('joinForm');
const usernameInput = document.getElementById('usernameInput');
const roleInput = document.getElementById('roleInput');
const channelInput = document.getElementById('channelInput');

const activeChannelHeader = document.getElementById('activeChannelHeader');
const connStatusDot = document.getElementById('connStatusDot');
const connStatusText = document.getElementById('connStatusText');
const pingValue = document.getElementById('pingValue');
const currentUserDisplay = document.getElementById('currentUserDisplay');
const currentRoleDisplay = document.getElementById('currentRoleDisplay');

const channelButtons = document.querySelectorAll('.channel-btn');
const messageContainer = document.getElementById('messageContainer');
const messageForm = document.getElementById('messageForm');
const messageInput = document.getElementById('messageInput');
const typingIndicator = document.getElementById('typingIndicator');
const userListContainer = document.getElementById('userListContainer');
const onlineCountBadge = document.getElementById('onlineCountBadge');

// Format waktu jam:menit:detik presisi
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('id-ID', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
}

// 1. Login / Inisialisasi Sesi
joinForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const username = usernameInput.value.trim();
  const role = roleInput.value;
  const channel = channelInput.value;

  if (!username) return;

  socket.connect();
  socket.emit('session:join', { username, role, channel });
  authModal.classList.add('hidden');
  messageInput.focus();
});

// 2. Status Koneksi Socket
socket.on('connect', () => {
  connStatusDot.className = 'w-2 h-2 rounded-full bg-emerald-400';
  connStatusText.textContent = 'CONNECTED';
  connStatusText.className = 'text-emerald-400';
});

socket.on('disconnect', () => {
  connStatusDot.className = 'w-2 h-2 rounded-full bg-rose-500';
  connStatusText.textContent = 'DISCONNECTED';
  connStatusText.className = 'text-rose-400';
});

// 3. Inisialisasi Data Channel & History
socket.on('channel:init', ({ channel, history, currentUser }) => {
  state.activeChannel = channel;
  state.currentUser = currentUser;

  activeChannelHeader.textContent = `#${channel}`;
  currentUserDisplay.textContent = currentUser.username;
  currentRoleDisplay.textContent = currentUser.role;

  updateChannelButtonsUI(channel);

  messageContainer.innerHTML = '';
  if (history.length === 0) {
    messageContainer.innerHTML = `
      <div class="px-4 py-3 font-mono text-xs text-zinc-500">
        [CHANNEL_READY] Belum ada riwayat transmisi di #${channel}.
      </div>
    `;
  } else {
    history.forEach((msg) => appendMessageRow(msg));
  }
  scrollToBottom();
});

// 4. Menerima Pesan Baru secara Real-Time
socket.on('message:receive', (message) => {
  appendMessageRow(message);
  scrollToBottom();
});

// 5. Render Baris Pesan bergaya Engineering Log
function appendMessageRow(msg) {
  const row = document.createElement('div');
  const timeStr = formatTime(msg.timestamp);

  if (msg.type === 'SYSTEM') {
    row.className = 'px-4 py-2 bg-surface/40 font-mono text-[11px] text-zinc-400 flex items-center gap-3';
    row.innerHTML = `
      <span class="text-zinc-600 shrink-0">${timeStr}</span>
      <span class="px-1.5 py-0.2 bg-zinc-800/80 text-zinc-400 border border-zinc-700 text-[10px]">SYS</span>
      <span>${msg.text}</span>
    `;
  } else {
    const isSelf = state.currentUser && msg.senderId === socket.id;
    row.className = `px-4 py-2.5 hover:bg-surface/50 transition flex items-start gap-3 ${
      isSelf ? 'bg-surface/20' : ''
    }`;

    row.innerHTML = `
      <span class="font-mono text-[11px] text-zinc-500 shrink-0 pt-0.5">${timeStr}</span>
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-0.5">
          <span class="font-mono text-xs font-semibold ${
            isSelf ? 'text-emerald-400' : 'text-zinc-100'
          }">${msg.username}</span>
          <span class="font-mono text-[10px] px-1.5 py-0.2 bg-elevated text-zinc-400 border border-line">${
            msg.role
          }</span>
        </div>
        <p class="text-sm text-zinc-300 break-words leading-relaxed">${msg.text}</p>
      </div>
    `;
  }

  messageContainer.appendChild(row);
}

// 6. Mengirim Pesan
messageForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = messageInput.value.trim();
  if (!text) return;

  socket.emit('message:send', text);
  socket.emit('typing:state', false);
  messageInput.value = '';
});

// 7. Deteksi Sedang Mengetik (Typing Event)
messageInput.addEventListener('input', () => {
  socket.emit('typing:state', true);
  clearTimeout(state.typingTimeout);
  state.typingTimeout = setTimeout(() => {
    socket.emit('typing:state', false);
  }, 1200);
});

socket.on('typing:update', ({ username, isTyping }) => {
  if (isTyping) {
    typingIndicator.textContent = `${username} sedang mengetik...`;
  } else {
    typingIndicator.textContent = '';
  }
});

// 8. Perpindahan Channel
channelButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const targetChannel = btn.getAttribute('data-channel');
    if (targetChannel !== state.activeChannel) {
      socket.emit('channel:switch', targetChannel);
    }
  });
});

function updateChannelButtonsUI(activeChannel) {
  channelButtons.forEach((btn) => {
    const ch = btn.getAttribute('data-channel');
    if (ch === activeChannel) {
      btn.className =
        'channel-btn w-full text-left px-2.5 py-1.5 bg-elevated text-zinc-100 border border-line flex items-center justify-between';
    } else {
      btn.className =
        'channel-btn w-full text-left px-2.5 py-1.5 text-zinc-400 hover:text-zinc-200 hover:bg-elevated/50 border border-transparent flex items-center justify-between';
    }
  });
}

// 9. Pembaruan Daftar Pengguna Online
socket.on('presence:update', (users) => {
  onlineCountBadge.textContent = users.length;
  userListContainer.innerHTML = users
    .map(
      (u) => `
      <div class="p-2 bg-canvas border border-line flex items-center justify-between">
        <div class="flex items-center gap-2 truncate">
          <span class="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0"></span>
          <span class="text-zinc-200 truncate">${u.username}</span>
        </div>
        <span class="text-[10px] text-zinc-500 shrink-0">${u.role}</span>
      </div>
    `
    )
    .join('');
});

// 10. Interval Pengecekan Latency (Ping) Setiap 4 Detik
setInterval(() => {
  if (socket.connected) {
    const start = Date.now();
    socket.emit('latency:ping', start, () => {
      const duration = Date.now() - start;
      pingValue.textContent = `${duration} ms`;
    });
  }
}, 4000);

function scrollToBottom() {
  messageContainer.scrollTop = messageContainer.scrollHeight;
}