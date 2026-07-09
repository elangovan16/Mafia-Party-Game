/* js/admin/setup.js - Player Queue and Game Launch */
window.Admin = window.Admin || {};

Admin.buildRoleConfigGrid = function() {
  const grid = document.getElementById('role-config-grid');
  if (!grid) return;
  grid.innerHTML = '';
  for (const id of ROLE_ORDER) {
    const role = ROLES[id];
    if (!role) continue;
    const current = Admin.state.customRoleConfig[id] || 0;
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
};

Admin.applyCustomRoles = function() {
  Admin.state.customRoleConfig = {};
  for (const id of ROLE_ORDER) {
    const input = document.getElementById('rcfg-' + id);
    if (input) {
      const val = parseInt(input.value) || 0;
      if (val > 0) Admin.state.customRoleConfig[id] = val;
    }
  }
  const total = Object.values(Admin.state.customRoleConfig).reduce((a, b) => a + b, 0);
  Admin.toast('Role config applied. Total: ' + total, 'success');
  Admin.log('Custom role config: ' + JSON.stringify(Admin.state.customRoleConfig), 'action');
};

Admin.resetRoleConfig = function() {
  const count = Admin.state.pendingPlayers.length || 8;
  const preset = typeof getPresetForCount === 'function' ? getPresetForCount(count) : {};
  Admin.state.customRoleConfig = Object.assign({}, preset);
  for (const id of ROLE_ORDER) {
    const input = document.getElementById('rcfg-' + id);
    if (input) input.value = Admin.state.customRoleConfig[id] || 0;
  }
  Admin.toast('Role config reset to preset.');
  Admin.log('Role config reset for ' + count + ' players', 'info');
};

Admin.generatePlayers = function() {
  const count = parseInt(document.getElementById('gen-count').value) || 8;
  const style = document.getElementById('gen-style').value;
  const roleMode = document.getElementById('gen-roles').value;
  const pool = Admin.NAMES[style] || Admin.NAMES.classic;
  const shuffled = pool.slice().sort(() => Math.random() - 0.5);
  Admin.state.pendingPlayers = [];
  for (let i = 0; i < count; i++) {
    const name = shuffled[i % shuffled.length] + (i >= shuffled.length ? ' ' + (Math.floor(i / shuffled.length) + 1) : '');
    Admin.state.pendingPlayers.push({ id: 'dummy_' + Date.now() + '_' + i, name: name, peerId: 'local', isHost: i === 0, forcedRole: null });
  }
  if (roleMode === 'all_town') { Admin.state.customRoleConfig = { villager: count }; }
  else if (roleMode === 'all_mafia') { const h = Math.floor(count/2); Admin.state.customRoleConfig = { godfather:1, mafioso:h-1, villager:count-h }; }
  else { Admin.state.customRoleConfig = {}; }
  Admin.renderPlayerQueue();
  Admin.toast('Generated ' + count + ' players (' + style + ')', 'success');
  Admin.log('Generated ' + count + ' dummy players, style=' + style, 'success');
};

Admin.addPlayer = function() {
  const name = document.getElementById('add-name').value.trim();
  if (!name) { Admin.toast('Enter a player name', 'error'); return; }
  const roleId = document.getElementById('add-role').value;
  const isHost = document.getElementById('add-ishost').checked;
  if (isHost) Admin.state.pendingPlayers.forEach(pl => pl.isHost = false);
  Admin.state.pendingPlayers.push({ id: 'p_' + Date.now(), name: name, peerId: 'local', isHost: isHost, forcedRole: roleId !== 'auto' ? roleId : null });
  Admin.renderPlayerQueue();
  document.getElementById('add-name').value = '';
  document.getElementById('add-ishost').checked = false;
  Admin.toast('Added: ' + name, 'success');
  Admin.log('Added player "' + name + '"', 'action');
};

Admin.removePlayer = function(id) {
  Admin.state.pendingPlayers = Admin.state.pendingPlayers.filter(p => p.id !== id);
  Admin.renderPlayerQueue();
};

Admin.clearPlayers = function() {
  Admin.state.pendingPlayers = [];
  Admin.renderPlayerQueue();
  Admin.toast('Player queue cleared');
  Admin.log('Player queue cleared', 'warn');
};

Admin.renderPlayerQueue = function() {
  const el = document.getElementById('player-queue');
  const countEl = document.getElementById('queue-count');
  if (!el) return;
  if (countEl) countEl.textContent = Admin.state.pendingPlayers.length;
  if (Admin.state.pendingPlayers.length === 0) { el.innerHTML = '<p class="empty-hint">No players yet.</p>'; return; }
  el.innerHTML = '';
  Admin.state.pendingPlayers.forEach((p, i) => {
    const chip = document.createElement('div');
    chip.className = 'queue-player-chip';
    const role = p.forcedRole ? ROLES[p.forcedRole] : null;
    chip.innerHTML = '<span class="chip-avatar">' + Admin.EMOJIS[i % Admin.EMOJIS.length] + '</span><span class="chip-name">' + p.name + '</span>' + (role ? '<span class="chip-role">' + role.icon + role.name + '</span>' : '') + (p.isHost ? '<span class="chip-host">HOST</span>' : '') + '<button class="chip-remove" onclick="Admin.removePlayer(\'' + p.id + '\')">x</button>';
    el.appendChild(chip);
  });
};

Admin.launchGame = function() {
  if (Admin.state.pendingPlayers.length < 5) { Admin.toast('Need at least 5 players!', 'error'); return; }
  const settings = {
    dayTime: parseInt(document.getElementById('cfg-daytime').value) ?? 30,
    nightTime: parseInt(document.getElementById('cfg-nighttime').value) ?? 15,
    sheriffBadge: document.getElementById('cfg-sheriff').checked,
    lastWill: document.getElementById('cfg-lastwill').checked,
    playerCount: Admin.state.pendingPlayers.length,
  };
  let roleConfig = {};
  if (Object.keys(Admin.state.customRoleConfig).length > 0) {
    roleConfig = Object.assign({}, Admin.state.customRoleConfig);
  } else {
    const preset = typeof getPresetForCount === 'function' ? getPresetForCount(Admin.state.pendingPlayers.length) : {};
    const others = Object.entries(preset).filter(([id]) => id !== 'villager').reduce((a, [, v]) => a + v, 0);
    roleConfig = Object.assign({}, preset);
    roleConfig.villager = Math.max(1, Admin.state.pendingPlayers.length - others);
  }
  const total = Object.values(roleConfig).reduce((a, b) => a + b, 0);
  if (total !== Admin.state.pendingPlayers.length) {
    const others = Object.entries(roleConfig).filter(([id]) => id !== 'villager').reduce((a, [, v]) => a + v, 0);
    roleConfig.villager = Math.max(1, Admin.state.pendingPlayers.length - others);
  }
  const players = Admin.state.pendingPlayers.map((p, i) => ({ id: p.id, name: p.name, peerId: 'local', isHost: p.isHost || i === 0 }));
  try {
    const state = Game.initGame(players, settings, roleConfig);
    Admin.state.pendingPlayers.forEach(p => {
      if (p.forcedRole && ROLES[p.forcedRole]) {
        const gp = state.players.find(sp => sp.id === p.id);
        if (gp) gp.role = ROLES[p.forcedRole];
      }
    });
    Admin.state.gameActive = true;
    Admin.log('Game launched! ' + players.length + ' players. Config: ' + JSON.stringify(roleConfig), 'success');
    Admin.toast('Game launched with ' + players.length + ' players!', 'success');
    Admin.refreshState();
    if (Admin.refreshPlayers) Admin.refreshPlayers();
    if (Admin.refreshDropdowns) Admin.refreshDropdowns();
    const tabBtn = document.querySelectorAll('.tab-btn')[1];
    Admin.switchTab('tab-players', tabBtn);
  } catch(e) {
    Admin.toast('Launch failed: ' + e.message, 'error');
    Admin.log('Launch error: ' + e.message, 'error');
  }
};

Admin.quickStart = function(count) {
  const shuffled = Admin.NAMES.classic.slice().sort(() => Math.random() - 0.5);
  Admin.state.pendingPlayers = shuffled.slice(0, count).map((name, i) => ({ id: 'dummy_' + i, name: name, peerId: 'local', isHost: i === 0, forcedRole: null }));
  Admin.state.customRoleConfig = {};
  Admin.renderPlayerQueue();
  Admin.launchGame();
};

Admin.quickStartCustom = function() {
  Admin.switchTab('tab-setup', document.querySelectorAll('.tab-btn')[0]);
  Admin.toast('Configure players then click Launch Game');
};
