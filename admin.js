/* admin.js - MAFIA Game Admin / Testing Panel */
const Admin = (() => {
  let pendingPlayers = [];
  let gameActive = false;
  let customRoleConfig = {};
  let pendingNightActions = [];
  let adminVotes = {};
  let logEntries = [];

  const NAMES = {
    classic:  ['Alice','Bob','Carol','Dave','Eve','Frank','Grace','Hank','Iris','Jack','Kate','Leo','Mia','Nate','Olivia','Pete'],
    medieval: ['Arthur','Merlin','Lancelot','Guinevere','Percival','Morgana','Galahad','Isolde','Tristan','Elaine','Gawain','Viviane','Bors','Nimue','Pellinore','Agravaine'],
    mystery:  ['Shadow','Ghost','Cipher','Raven','Wraith','Phantom','Specter','Mirage','Nexus','Void','Echo','Flux','Vector','Nox','Reaper','Sable'],
    random:   ['Ajax','Blaze','Colt','Dusk','Ember','Forge','Grim','Hawk','Jinx','Kira','Lux','Maven','Nyx','Orion','Pyre','Quinn'],
  };
  const EMOJIS = ['🧑','👩','🧔','👴','👵','🧕','🧑‍🦱','🧑‍🦰','🧑‍🦳','🧑‍🦲','🙂','😄','🤗','😎','🥸','🦸'];

  function log(msg, type) {
    if (!type) type = 'info';
    const entry = { msg, type, time: new Date().toLocaleTimeString() };
    logEntries.push(entry);
    const logEl = document.getElementById('event-log');
    if (!logEl) return;
    const div = document.createElement('div');
    div.className = 'log-entry log-' + type;
    div.textContent = '[' + entry.time + '] ' + msg;
    logEl.appendChild(div);
    const autoScroll = document.getElementById('log-auto-scroll');
    if (autoScroll && autoScroll.checked) logEl.scrollTop = logEl.scrollHeight;
  }

  function toast(msg, type) {
    if (!type) type = 'default';
    const container = document.getElementById('admin-toast-container');
    const t = document.createElement('div');
    t.className = 'admin-toast ' + type;
    t.textContent = msg;
    container.appendChild(t);
    setTimeout(() => t.remove(), 3500);
  }

  function switchTab(id, btn) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => { b.classList.remove('active'); b.style.color = ''; });
    const el = document.getElementById(id);
    if (el) el.classList.add('active');
    if (btn) btn.classList.add('active');
    if (id === 'tab-players') refreshPlayers();
    if (id === 'tab-night' || id === 'tab-vote') refreshDropdowns();
  }

  function refreshState() {
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
  }
  function buildRoleConfigGrid() {
    const grid = document.getElementById('role-config-grid');
    if (!grid) return;
    grid.innerHTML = '';
    for (const id of ROLE_ORDER) {
      const role = ROLES[id];
      if (!role) continue;
      const current = customRoleConfig[id] || 0;
      const item = document.createElement('div');
      item.className = 'role-cfg-item';
      item.innerHTML = '<div class="role-cfg-label"><span class="role-cfg-icon">' + role.icon + '</span><span class="role-cfg-name">' + role.name + '</span></div><input type="number" class="role-cfg-count" id="rcfg-' + id + '" value="' + current + '" min="0" max="' + (role.maxPerGame || 4) + '" />';
      grid.appendChild(item);
    }
    const addRoleSelect = document.getElementById('add-role');
    if (addRoleSelect) {
      addRoleSelect.innerHTML = '<option value="auto">Auto-Assign</option>';
      for (const id of ROLE_ORDER) {
        const role = ROLES[id];
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = role.icon + ' ' + role.name;
        addRoleSelect.appendChild(opt);
      }
    }
  }

  function applyCustomRoles() {
    customRoleConfig = {};
    for (const id of ROLE_ORDER) {
      const input = document.getElementById('rcfg-' + id);
      if (input) {
        const val = parseInt(input.value) || 0;
        if (val > 0) customRoleConfig[id] = val;
      }
    }
    const total = Object.values(customRoleConfig).reduce((a, b) => a + b, 0);
    toast('Role config applied. Total: ' + total, 'success');
    log('Custom role config: ' + JSON.stringify(customRoleConfig), 'action');
  }

  function resetRoleConfig() {
    const count = pendingPlayers.length || 8;
    const preset = getPresetForCount(count);
    customRoleConfig = Object.assign({}, preset);
    for (const id of ROLE_ORDER) {
      const input = document.getElementById('rcfg-' + id);
      if (input) input.value = customRoleConfig[id] || 0;
    }
    toast('Role config reset to preset.');
    log('Role config reset for ' + count + ' players', 'info');
  }

  function generatePlayers() {
    const count = parseInt(document.getElementById('gen-count').value) || 8;
    const style = document.getElementById('gen-style').value;
    const roleMode = document.getElementById('gen-roles').value;
    const pool = NAMES[style] || NAMES.classic;
    const shuffled = pool.slice().sort(() => Math.random() - 0.5);
    pendingPlayers = [];
    for (let i = 0; i < count; i++) {
      const name = shuffled[i % shuffled.length] + (i >= shuffled.length ? ' ' + (Math.floor(i / shuffled.length) + 1) : '');
      pendingPlayers.push({ id: 'dummy_' + Date.now() + '_' + i, name: name, peerId: 'local', isHost: i === 0, forcedRole: null });
    }
    if (roleMode === 'all_town') { customRoleConfig = { villager: count }; }
    else if (roleMode === 'all_mafia') { const h = Math.floor(count/2); customRoleConfig = { godfather:1, mafioso:h-1, villager:count-h }; }
    else { customRoleConfig = {}; }
    renderPlayerQueue();
    toast('Generated ' + count + ' players (' + style + ')', 'success');
    log('Generated ' + count + ' dummy players, style=' + style, 'success');
  }

  function addPlayer() {
    const name = document.getElementById('add-name').value.trim();
    if (!name) { toast('Enter a player name', 'error'); return; }
    const roleId = document.getElementById('add-role').value;
    const isHost = document.getElementById('add-ishost').checked;
    if (isHost) pendingPlayers.forEach(pl => pl.isHost = false);
    pendingPlayers.push({ id: 'p_' + Date.now(), name: name, peerId: 'local', isHost: isHost, forcedRole: roleId !== 'auto' ? roleId : null });
    renderPlayerQueue();
    document.getElementById('add-name').value = '';
    document.getElementById('add-ishost').checked = false;
    toast('Added: ' + name, 'success');
    log('Added player "' + name + '"', 'action');
  }

  function removePlayer(id) {
    pendingPlayers = pendingPlayers.filter(p => p.id !== id);
    renderPlayerQueue();
  }

  function clearPlayers() {
    pendingPlayers = [];
    renderPlayerQueue();
    toast('Player queue cleared');
    log('Player queue cleared', 'warn');
  }

  function renderPlayerQueue() {
    const el = document.getElementById('player-queue');
    const countEl = document.getElementById('queue-count');
    if (!el) return;
    if (countEl) countEl.textContent = pendingPlayers.length;
    if (pendingPlayers.length === 0) { el.innerHTML = '<p class="empty-hint">No players yet.</p>'; return; }
    el.innerHTML = '';
    pendingPlayers.forEach((p, i) => {
      const chip = document.createElement('div');
      chip.className = 'queue-player-chip';
      const role = p.forcedRole ? ROLES[p.forcedRole] : null;
      chip.innerHTML = '<span class="chip-avatar">' + EMOJIS[i % EMOJIS.length] + '</span><span class="chip-name">' + p.name + '</span>' + (role ? '<span class="chip-role">' + role.icon + role.name + '</span>' : '') + (p.isHost ? '<span class="chip-host">HOST</span>' : '') + '<button class="chip-remove" onclick="Admin.removePlayer(\'' + p.id + '\')">x</button>';
      el.appendChild(chip);
    });
  }

  function launchGame() {
    if (pendingPlayers.length < 5) { toast('Need at least 5 players!', 'error'); return; }
    const settings = {
      dayTime: parseInt(document.getElementById('cfg-daytime').value) || 30,
      nightTime: parseInt(document.getElementById('cfg-nighttime').value) || 15,
      sheriffBadge: document.getElementById('cfg-sheriff').checked,
      lastWill: document.getElementById('cfg-lastwill').checked,
      playerCount: pendingPlayers.length,
    };
    let roleConfig = {};
    if (Object.keys(customRoleConfig).length > 0) {
      roleConfig = Object.assign({}, customRoleConfig);
    } else {
      const preset = getPresetForCount(pendingPlayers.length);
      const others = Object.entries(preset).filter(([id]) => id !== 'villager').reduce((a, [, v]) => a + v, 0);
      roleConfig = Object.assign({}, preset);
      roleConfig.villager = Math.max(1, pendingPlayers.length - others);
    }
    const total = Object.values(roleConfig).reduce((a, b) => a + b, 0);
    if (total !== pendingPlayers.length) {
      const others = Object.entries(roleConfig).filter(([id]) => id !== 'villager').reduce((a, [, v]) => a + v, 0);
      roleConfig.villager = Math.max(1, pendingPlayers.length - others);
    }
    const players = pendingPlayers.map((p, i) => ({ id: p.id, name: p.name, peerId: 'local', isHost: p.isHost || i === 0 }));
    try {
      const state = Game.initGame(players, settings, roleConfig);
      pendingPlayers.forEach(p => {
        if (p.forcedRole && ROLES[p.forcedRole]) {
          const gp = state.players.find(sp => sp.id === p.id);
          if (gp) gp.role = ROLES[p.forcedRole];
        }
      });
      gameActive = true;
      log('Game launched! ' + players.length + ' players. Config: ' + JSON.stringify(roleConfig), 'success');
      toast('Game launched with ' + players.length + ' players!', 'success');
      refreshState();
      refreshPlayers();
      refreshDropdowns();
      const tabBtn = document.querySelectorAll('.tab-btn')[1];
      switchTab('tab-players', tabBtn);
    } catch(e) {
      toast('Launch failed: ' + e.message, 'error');
      log('Launch error: ' + e.message, 'error');
    }
  }

  function quickStart(count) {
    const shuffled = NAMES.classic.slice().sort(() => Math.random() - 0.5);
    pendingPlayers = shuffled.slice(0, count).map((name, i) => ({ id: 'dummy_' + i, name: name, peerId: 'local', isHost: i === 0, forcedRole: null }));
    customRoleConfig = {};
    renderPlayerQueue();
    launchGame();
  }

  function quickStartCustom() {
    switchTab('tab-setup', document.querySelectorAll('.tab-btn')[0]);
    toast('Configure players then click Launch Game');
  }

  function gotoNight() {
    if (!gameActive) { toast('No game running', 'error'); return; }
    try { Game.getState().phase = 'night'; refreshState(); toast('Forced Night phase', 'warn'); log('Admin: forced night', 'warn'); } catch(e) { toast(e.message, 'error'); }
  }

  function gotoDay() {
    if (!gameActive) { toast('No game running', 'error'); return; }
    try { Game.startDay(); refreshState(); toast('Forced Day phase', 'warn'); log('Admin: forced day', 'warn'); } catch(e) { toast(e.message, 'error'); }
  }

  function gotoVote() {
    if (!gameActive) { toast('No game running', 'error'); return; }
    try { Game.getState().phase = 'vote'; refreshState(); toast('Forced Vote phase', 'warn'); log('Admin: forced vote', 'warn'); } catch(e) { toast(e.message, 'error'); }
  }

  function forceWin(team) {
    if (!gameActive) { toast('No game running', 'error'); return; }
    const badges = { town: '🏆 Town Wins!', mafia: '🔪 Mafia Wins!' };
    toast(badges[team] || 'Game Over', 'success');
    log('Admin: forced win → ' + team, 'warn');
    showModal({ header: badges[team], body: '<p>Forced by admin panel.</p>', buttons: [{ text: 'OK', class: 'btn-action btn-purple' }] });
  }

  function refreshPlayers() {
    const container = document.getElementById('players-inspector');
    if (!container) return;
    let players = [];
    try { players = Game.getPlayers(); } catch(e) {}
    if (!players || players.length === 0) { container.innerHTML = '<p class="empty-hint">No game running.</p>'; return; }
    container.innerHTML = '';
    players.forEach((p, i) => {
      const card = document.createElement('div');
      card.className = 'player-card ' + (p.alive ? '' : 'dead');
      const roleOpts = ROLE_ORDER.map(id => { const r = ROLES[id]; return '<option value="' + id + '"' + (p.role && p.role.id === id ? ' selected' : '') + '>' + r.icon + ' ' + r.name + '</option>'; }).join('');
      card.innerHTML = '<div class="pc-header"><div class="pc-avatar">' + EMOJIS[i % EMOJIS.length] + '</div><div class="pc-info"><div class="pc-name">' + p.name + '</div><div class="pc-id">id: ' + p.id + '</div></div><span class="pc-status ' + (p.alive ? 'alive' : 'dead') + '">' + (p.alive ? 'ALIVE' : 'DEAD') + '</span></div><div class="pc-role" style="border-left:3px solid ' + (p.role && p.role.color ? p.role.color : '#888') + '"><span class="pc-role-icon">' + (p.role ? p.role.icon : '?') + '</span><span class="pc-role-name">' + (p.role ? p.role.name : 'Unknown') + '</span><span class="pc-role-team ' + (p.role ? p.role.team : '') + '">' + (p.role ? p.role.team.toUpperCase() : '') + '</span></div><select class="pc-role-select" onchange="Admin.changeRole(\'' + p.id + '\', this.value)">' + roleOpts + '</select><div class="pc-actions" style="margin-top:0.5rem">' + (p.alive ? '<button class="pc-btn kill" onclick="Admin.killPlayer(\'' + p.id + '\')">Kill</button>' : '<button class="pc-btn revive" onclick="Admin.revivePlayer(\'' + p.id + '\')">Revive</button>') + '<button class="pc-btn" onclick="Admin.eliminatePlayer(\'' + p.id + '\',\'night_kill\')">Elim</button><button class="pc-btn" onclick="Admin.inspectPlayer(\'' + p.id + '\')">Info</button></div>';
      container.appendChild(card);
    });
    refreshState();
  }

  function killPlayer(id) {
    try { const p = Game.getPlayer(id); if (!p) return; p.alive = false; p.eliminated = true; toast(p.name + ' killed', 'warn'); log('Admin: killed ' + p.name, 'warn'); refreshPlayers(); } catch(e) { toast(e.message, 'error'); }
  }

  function revivePlayer(id) {
    try { const p = Game.getPlayer(id); if (!p) return; p.alive = true; p.eliminated = false; toast(p.name + ' revived', 'success'); log('Admin: revived ' + p.name, 'success'); refreshPlayers(); } catch(e) { toast(e.message, 'error'); }
  }

  function changeRole(id, roleId) {
    try { const p = Game.getPlayer(id); if (!p || !ROLES[roleId]) return; const oldRole = p.role ? p.role.name : '?'; p.role = ROLES[roleId]; toast(p.name + ': ' + oldRole + ' to ' + ROLES[roleId].name, 'success'); log('Admin: changed ' + p.name + ' role to ' + ROLES[roleId].name, 'action'); refreshPlayers(); } catch(e) { toast(e.message, 'error'); }
  }

  function killAll() {
    try { Game.getPlayers().forEach(p => { p.alive = false; p.eliminated = true; }); toast('All killed', 'warn'); log('Admin: all killed', 'warn'); refreshPlayers(); } catch(e) { toast(e.message, 'error'); }
  }

  function reviveAll() {
    try { Game.getPlayers().forEach(p => { p.alive = true; p.eliminated = false; }); toast('All revived', 'success'); log('Admin: all revived', 'success'); refreshPlayers(); } catch(e) { toast(e.message, 'error'); }
  }

  function shuffleRoles() {
    try { const players = Game.getPlayers(); const roles = players.map(p => p.role).sort(() => Math.random() - 0.5); players.forEach((p, i) => p.role = roles[i]); toast('Roles shuffled!', 'success'); log('Admin: roles shuffled', 'action'); refreshPlayers(); } catch(e) { toast(e.message, 'error'); }
  }

  function inspectPlayer(id) {
    try {
      const p = Game.getPlayer(id);
      if (!p) return;
      const info = ['Name: ' + p.name, 'ID: ' + p.id, 'Role: ' + (p.role ? p.role.name + ' (' + p.role.team + ')' : '?'), 'Alive: ' + p.alive, 'Votes: ' + (p.voteCount || 0), 'Last Will: ' + (p.lastWill || '(none)'), 'Vests: ' + (p.vests || 0)].join('\n');
      showModal({ header: 'Player: ' + p.name, body: '<pre style="font-family:var(--font-mono);font-size:0.82rem;white-space:pre-wrap;color:var(--a-text)">' + info + '</pre>' });
    } catch(e) { toast(e.message, 'error'); }
  }

  function refreshDropdowns() {
    const selectors = ['night-actor','night-target','vote-voter','vote-target','elim-target'];
    let players = [];
    try { players = Game.getPlayers().filter(p => p.alive); } catch(e) {}
    selectors.forEach(sel => {
      const el = document.getElementById(sel);
      if (!el) return;
      const prev = el.value;
      el.innerHTML = '';
      if (players.length === 0) { el.innerHTML = '<option value="">No players</option>'; return; }
      players.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = (p.role ? p.role.icon : '?') + ' ' + p.name + ' (' + (p.role ? p.role.name : '?') + ')';
        el.appendChild(opt);
      });
      if (prev) el.value = prev;
    });
  }

  function submitNightAction() {
    const actorId = document.getElementById('night-actor').value;
    const actionType = document.getElementById('night-action-type').value;
    const targetId = document.getElementById('night-target').value;
    if (!actorId || !targetId) { toast('Select actor and target', 'error'); return; }
    let actorName = actorId, targetName = targetId;
    try { actorName = Game.getPlayer(actorId).name || actorId; targetName = Game.getPlayer(targetId).name || targetId; } catch(e) {}
    pendingNightActions.push({ actorId, actorName, actionType, targetId, targetName });
    renderPendingActions();
    try { Game.submitNightAction(actorId, targetId, actionType); } catch(e) {}
    toast('Action queued: ' + actionType, 'success');
    log('Night action: ' + actorName + ' -> ' + actionType + ' -> ' + targetName, 'action');
  }

  function renderPendingActions() {
    const container = document.getElementById('pending-actions');
    if (!container) return;
    if (pendingNightActions.length === 0) { container.innerHTML = '<p class="empty-hint">No actions yet.</p>'; return; }
    const icons = { mafia_kill:'🔪', investigate:'🔍', heal:'💉', roleblock:'🚫', sk_kill:'🗡', guard:'🛡', consigliere:'📜', vigilante:'🏹' };
    container.innerHTML = '';
    pendingNightActions.forEach(a => {
      const item = document.createElement('div');
      item.className = 'pending-action-item';
      item.innerHTML = '<span class="pa-icon">' + (icons[a.actionType] || '') + '</span><span><strong>' + a.actorName + '</strong> → <em>' + a.actionType + '</em> → <strong>' + a.targetName + '</strong></span>';
      container.appendChild(item);
    });
  }

  function clearNightActions() { pendingNightActions = []; renderPendingActions(); toast('Night actions cleared'); log('Admin: night actions cleared', 'warn'); }

  function resolveNight() {
    try {
      const results = Game.resolveNightActions();
      renderResolution(results);
      pendingNightActions = [];
      renderPendingActions();
      refreshPlayers();
      log('Night resolved: ' + JSON.stringify(results), 'event');
      toast('Night resolved!', 'success');
    } catch(e) { toast('Resolve failed: ' + e.message, 'error'); log('Night resolve error: ' + e.message, 'error'); }
  }

  function renderResolution(results) {
    const container = document.getElementById('resolution-result');
    if (!container) return;
    container.innerHTML = '';
    const items = [];
    if (results.killed) { const n = Game.getPlayer(results.killed); items.push({ cls:'kill', text: '💀 ' + (n ? n.name : results.killed) + ' was killed' }); }
    if (results.skKill) { const n = Game.getPlayer(results.skKill); items.push({ cls:'kill', text: '🗡 ' + (n ? n.name : results.skKill) + ' killed by SK' }); }
    if (results.vigilanteKill) { const n = Game.getPlayer(results.vigilanteKill); items.push({ cls:'kill', text: '🏹 ' + (n ? n.name : results.vigilanteKill) + ' shot by Vigilante' }); }
    if (results.saved) { const n = Game.getPlayer(results.saved); items.push({ cls:'saved', text: '💉 ' + (n ? n.name : results.saved) + ' saved by Doctor' }); }
    if (results.detectiveResult) { const r = results.detectiveResult; items.push({ cls:'investigate', text: '🔍 ' + r.name + ': ' + r.result }); }
    if (results.consigliereResult) { const r = results.consigliereResult; items.push({ cls:'investigate', text: '📜 ' + r.name + ' is ' + r.role }); }
    if (results.guardianDied) { const n = Game.getPlayer(results.guardianDied); items.push({ cls:'kill', text: '🛡 ' + (n ? n.name : results.guardianDied) + ' (Bodyguard) died' }); }
    if (items.length === 0) items.push({ cls:'', text:'🌅 Quiet night — no deaths.' });
    items.forEach(item => {
      const div = document.createElement('div');
      div.className = 'res-item ' + item.cls;
      div.textContent = item.text;
      container.appendChild(div);
    });
  }

  function castVote() {
    const voterId = document.getElementById('vote-voter').value;
    const targetId = document.getElementById('vote-target').value;
    if (!voterId || !targetId) { toast('Select voter and target', 'error'); return; }
    adminVotes[voterId] = targetId;
    try { Game.castVote(voterId, targetId); } catch(e) {}
    let voterName = voterId, targetName = targetId;
    try { voterName = Game.getPlayer(voterId).name || voterId; targetName = Game.getPlayer(targetId).name || targetId; } catch(e) {}
    toast(voterName + ' voted for ' + targetName, 'success');
    log('Vote: ' + voterName + ' -> ' + targetName, 'action');
    renderVoteTally();
  }

  function renderVoteTally() {
    const container = document.getElementById('admin-vote-tally');
    if (!container) return;
    const tally = {};
    Object.values(adminVotes).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
    const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    if (entries.length === 0) { container.innerHTML = '<p class="empty-hint">No votes yet.</p>'; return; }
    const max = entries[0][1];
    container.innerHTML = '';
    entries.forEach(([id, count]) => {
      let name = id;
      try { name = Game.getPlayer(id).name || id; } catch(e) {}
      const row = document.createElement('div');
      row.className = 'tally-row';
      row.innerHTML = '<span class="tally-name">' + name + '</span><div class="tally-bar-bg"><div class="tally-bar-fill" style="width:' + Math.round((count/max)*100) + '%"></div></div><span class="tally-count">' + count + '</span>';
      container.appendChild(row);
    });
  }

  function resolveVote() {
    try {
      const eliminated = Game.resolveVote();
      if (eliminated) { toast(eliminated.name + ' eliminated!', 'warn'); log('Vote: ' + eliminated.name + ' eliminated', 'event'); }
      else { toast('Vote tied - no elimination', 'default'); log('Vote: tied', 'event'); }
      adminVotes = {}; renderVoteTally(); refreshPlayers();
    } catch(e) { toast('Resolve failed: ' + e.message, 'error'); log('Vote resolve error: ' + e.message, 'error'); }
  }

  function eliminatePlayer(idOrBtn, cause) {
    let targetId = idOrBtn;
    let causeStr = cause;
    if (!idOrBtn) { targetId = document.getElementById('elim-target').value; causeStr = document.getElementById('elim-cause').value; }
    if (!targetId) { toast('Select a player', 'error'); return; }
    try {
      const p = Game.getPlayer(targetId);
      if (!p) { toast('Player not found', 'error'); return; }
      Game.eliminatePlayer(targetId, causeStr);
      toast(p.name + ' eliminated (' + causeStr + ')', 'warn');
      log('Admin: eliminated ' + p.name + ', cause=' + causeStr, 'event');
      refreshPlayers();
    } catch(e) { toast('Eliminate error: ' + e.message, 'error'); log('Eliminate error: ' + e.message, 'error'); }
  }

  function clearVotes() {
    adminVotes = {};
    try { Game.getPlayers().forEach(p => p.voteCount = 0); } catch(e) {}
    renderVoteTally(); toast('Votes cleared'); log('Admin: votes cleared', 'warn');
  }

  function buildRoleBrowser() {
    const container = document.getElementById('roles-browser');
    if (!container) return;
    container.innerHTML = '';
    for (const id of ROLE_ORDER) {
      const role = ROLES[id];
      if (!role) continue;
      const card = document.createElement('div');
      card.className = 'role-card';
      card.dataset.team = role.team;
      card.style.setProperty('--role-color', role.color);
      const tags = [];
      if (role.nightAction) tags.push('night: ' + role.nightAction);
      if (role.maxPerGame) tags.push('max: ' + role.maxPerGame);
      if (role.priority != null) tags.push('priority: ' + role.priority);
      if (role.canSelfTarget) tags.push('self-target');
      if (role.voteWeight) tags.push('vote x' + role.voteWeight);
      if (role.winCondition) tags.push('win: ' + role.winCondition);
      card.innerHTML = '<div class="rc-header"><span class="rc-icon">' + role.icon + '</span><span class="rc-name">' + role.name + '</span><span class="rc-team ' + role.team + '">' + role.team + '</span></div><div class="rc-desc">' + role.description + '</div><div class="rc-ability">' + role.ability + '</div><div class="rc-meta">' + tags.map(t => '<span class="rc-meta-tag">' + t + '</span>').join('') + '</div>';
      container.appendChild(card);
    }
  }

  function filterRoles(team, btn) {
    document.querySelectorAll('.role-filter-btn').forEach(b => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.role-card').forEach(card => { card.style.display = (team === 'all' || card.dataset.team === team) ? '' : 'none'; });
  }

  function clearLog() { logEntries = []; const el = document.getElementById('event-log'); if (el) el.innerHTML = '<div class="log-entry log-info">[Admin] Log cleared.</div>'; }

  function exportLog() {
    const text = logEntries.map(e => '[' + e.time + '] [' + e.type.toUpperCase() + '] ' + e.msg).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'mafia-log-' + Date.now() + '.txt';
    a.click();
    URL.revokeObjectURL(url);
    toast('Log exported!', 'success');
  }

  function showModal(opts) {
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
  }

  function init() {
    if (!window.UI) {
      window.UI = { appendLog: function(msg, important) { log('[GAME] ' + msg, important ? 'event' : 'info'); } };
    }
    buildRoleConfigGrid();
    buildRoleBrowser();
    refreshState();
    const overlay = document.getElementById('admin-modal-overlay');
    if (overlay) overlay.addEventListener('click', e => { if (e.target === overlay) overlay.style.display = 'none'; });
    log('Admin panel initialized. Game engine ready.', 'success');
  }

  window.addEventListener('DOMContentLoaded', init);

  return {
    switchTab, generatePlayers, addPlayer, removePlayer, clearPlayers, launchGame,
    quickStart, quickStartCustom, applyCustomRoles, resetRoleConfig,
    gotoNight, gotoDay, gotoVote, forceWin, refreshState,
    refreshPlayers, refreshDropdowns, killPlayer, revivePlayer, changeRole,
    killAll, reviveAll, shuffleRoles, inspectPlayer,
    submitNightAction, clearNightActions, resolveNight,
    castVote, resolveVote, eliminatePlayer, clearVotes,
    filterRoles, clearLog, exportLog,
  };
})();
