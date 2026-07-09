/* js/admin/core.js - Core Admin functionality and UI */
window.Admin = window.Admin || {};
window.Admin.state = {
  pendingPlayers: [],
  gameActive: false,
  customRoleConfig: {},
  pendingNightActions: [],
  adminVotes: {},
  logEntries: []
};
window.Admin.NAMES = {
  classic:  ['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank','Iris','Jack','Kate','Leo','Mia','Nate','Olivia','Pete'],
  medieval: ['Arthur','Merlin','Lancelot','Guinevere','Percival','Morgana','Galahad','Isolde','Tristan','Elaine','Gawain','Viviane','Bors','Nimue','Pellinore','Agravaine'],
  mystery:  ['Shadow','Ghost','Cipher','Raven','Wraith','Phantom','Specter','Mirage','Nexus','Void','Echo','Flux','Vector','Nox','Reaper','Sable'],
  random:   ['Ajax','Blaze','Colt','Dusk','Ember','Forge','Grim','Hawk','Jinx','Kira','Lux','Maven','Nyx','Orion','Pyre','Quinn'],
};
window.Admin.EMOJIS = ['🧑','👩','🧔','👴','👵','🧕','🧑‍🦱','🧑‍🦰','🧑‍🦳','🧑‍🦲','🙂','😄','🤗','😎','🥸','🦸'];

Admin.log = function(msg, type) {
  if (!type) type = 'info';
  const entry = { msg, type, time: new Date().toLocaleTimeString() };
  Admin.state.logEntries.push(entry);
  const logEl = document.getElementById('event-log');
  if (!logEl) return;
  const div = document.createElement('div');
  div.className = 'log-entry log-' + type;
  div.textContent = '[' + entry.time + '] ' + msg;
  logEl.appendChild(div);
  const autoScroll = document.getElementById('log-auto-scroll');
  if (autoScroll && autoScroll.checked) logEl.scrollTop = logEl.scrollHeight;
};

Admin.toast = function(msg, type) {
  if (!type) type = 'default';
  const container = document.getElementById('admin-toast-container');
  const t = document.createElement('div');
  t.className = 'admin-toast ' + type;
  t.textContent = msg;
  container.appendChild(t);
  setTimeout(() => t.remove(), 3500);
};

Admin.switchTab = function(id, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.style.color = ''; });
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  if (btn) btn.classList.add('active');
  if (id === 'tab-players' && Admin.refreshPlayers) Admin.refreshPlayers();
  if ((id === 'tab-night' || id === 'tab-vote') && Admin.refreshDropdowns) Admin.refreshDropdowns();
};

Admin.refreshState = function() {
  let state = null;
  try { state = Game.getState(); } catch(e) {}
  if (!state || !state.players || state.players.length === 0) {
    document.getElementById('sv-phase').textContent = '-';
    document.getElementById('sv-round').textContent = '0';
    document.getElementById('sv-day').textContent = '0';
    document.getElementById('sv-night').textContent = '0';
    document.getElementById('sv-alive').textContent = '0';
    document.getElementById('sv-dead').textContent = '0';
    const badge = document.getElementById('status-badge');
    if (badge) { badge.textContent = 'IDLE'; badge.className = 'status-badge'; }
    return;
  }
  document.getElementById('sv-phase').textContent = state.phase || '-';
  document.getElementById('sv-round').textContent = state.round || 0;
  document.getElementById('sv-day').textContent = state.dayCount || 0;
  document.getElementById('sv-night').textContent = state.nightCount || 0;
  const alive = state.players.filter(p => p.alive).length;
  const dead  = state.players.filter(p => !p.alive).length;
  document.getElementById('sv-alive').textContent = alive;
  document.getElementById('sv-dead').textContent = dead;
  const badge = document.getElementById('status-badge');
  if (badge) { badge.textContent = 'RUNNING'; badge.className = 'status-badge running'; }
};

Admin.clearLog = function() { 
  Admin.state.logEntries = []; 
  const el = document.getElementById('event-log'); 
  if (el) el.innerHTML = '<div class="log-entry log-info">[Admin] Log cleared.</div>'; 
};

Admin.exportLog = function() {
  const text = Admin.state.logEntries.map(e => '[' + e.time + '] [' + e.type.toUpperCase() + '] ' + e.msg).join('\n');
  const blob = new Blob([text], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'mafia-log-' + Date.now() + '.txt';
  a.click();
  URL.revokeObjectURL(url);
  Admin.toast('Log exported!', 'success');
};

Admin.showModal = function(opts) {
  const h = opts.header || '';
  const b = opts.body || '';
  const buttons = opts.buttons || [];
  document.getElementById('admin-modal-header').innerHTML = h;
  document.getElementById('admin-modal-body').innerHTML = b;
  const footer = document.getElementById('admin-modal-footer');
  footer.innerHTML = '';
  if (buttons.length === 0) buttons.push({ text: 'Close', class: 'btn-action' });
  buttons.forEach(btn => {
    const el = document.createElement('button');
    el.className = btn.class || 'btn-action';
    el.textContent = btn.text || 'OK';
    el.onclick = () => { document.getElementById('admin-modal-overlay').style.display = 'none'; if (btn.action) btn.action(); };
    footer.appendChild(el);
  });
  document.getElementById('admin-modal-overlay').style.display = 'flex';
};

Admin.init = function() {
  if (!window.UI) {
    window.UI = { appendLog: function(msg, important) { Admin.log('[GAME] ' + msg, important ? 'event' : 'info'); } };
  }
  if (Admin.buildRoleConfigGrid) Admin.buildRoleConfigGrid();
  if (Admin.buildRoleBrowser) Admin.buildRoleBrowser();
  Admin.refreshState();
  const overlay = document.getElementById('admin-modal-overlay');
  if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
  Admin.log('Admin panel initialized. Game engine ready.', 'success');
};

window.addEventListener('DOMContentLoaded', Admin.init);
