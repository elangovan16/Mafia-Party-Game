/* js/admin/players.js - Live Players Inspector and Phase Controls */
window.Admin = window.Admin || {};

Admin.gotoNight = function() {
  if (!Admin.state.gameActive) { Admin.toast('No game running', 'error'); return; }
  try { Game.getState().phase = 'night'; Admin.refreshState(); Admin.toast('Forced Night phase', 'warn'); Admin.log('Admin: forced night', 'warn'); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.gotoDay = function() {
  if (!Admin.state.gameActive) { Admin.toast('No game running', 'error'); return; }
  try { Game.startDay(); Admin.refreshState(); Admin.toast('Forced Day phase', 'warn'); Admin.log('Admin: forced day', 'warn'); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.gotoVote = function() {
  if (!Admin.state.gameActive) { Admin.toast('No game running', 'error'); return; }
  try { Game.getState().phase = 'vote'; Admin.refreshState(); Admin.toast('Forced Vote phase', 'warn'); Admin.log('Admin: forced vote', 'warn'); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.forceWin = function(team) {
  if (!Admin.state.gameActive) { Admin.toast('No game running', 'error'); return; }
  const badges = { town: '🏆 Town Wins!', mafia: '🔪 Mafia Wins!' };
  Admin.toast(badges[team] || 'Game Over', 'success');
  Admin.log('Admin: forced win → ' + team, 'warn');
  Admin.showModal({ header: badges[team], body: '<p>Forced by admin panel.</p>', buttons: [{ text: 'OK', class: 'btn-action btn-purple' }] });
};

Admin.refreshPlayers = function() {
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
    card.innerHTML = '<div class="pc-header"><div class="pc-avatar">' + Admin.EMOJIS[i % Admin.EMOJIS.length] + '</div><div class="pc-info"><div class="pc-name">' + p.name + '</div><div class="pc-id">id: ' + p.id + '</div></div><span class="pc-status ' + (p.alive ? 'alive' : 'dead') + '">' + (p.alive ? 'ALIVE' : 'DEAD') + '</span></div><div class="pc-role" style="border-left:3px solid ' + (p.role && p.role.color ? p.role.color : '#888') + '"><span class="pc-role-icon">' + (p.role ? p.role.icon : '?') + '</span><span class="pc-role-name">' + (p.role ? p.role.name : 'Unknown') + '</span><span class="pc-role-team ' + (p.role ? p.role.team : '') + '">' + (p.role ? p.role.team.toUpperCase() : '') + '</span></div><select class="pc-role-select" onchange="Admin.changeRole(\'' + p.id + '\', this.value)">' + roleOpts + '</select><div class="pc-actions" style="margin-top:0.5rem">' + (p.alive ? '<button class="pc-btn kill" onclick="Admin.killPlayer(\'' + p.id + '\')">Kill</button>' : '<button class="pc-btn revive" onclick="Admin.revivePlayer(\'' + p.id + '\')">Revive</button>') + '<button class="pc-btn" onclick="Admin.eliminatePlayer(\'' + p.id + '\',\'night_kill\')">Elim</button><button class="pc-btn" onclick="Admin.inspectPlayer(\'' + p.id + '\')">Info</button></div>';
    container.appendChild(card);
  });
  Admin.refreshState();
};

Admin.killPlayer = function(id) {
  try { const p = Game.getPlayer(id); if (!p) return; p.alive = false; p.eliminated = true; Admin.toast(p.name + ' killed', 'warn'); Admin.log('Admin: killed ' + p.name, 'warn'); Admin.refreshPlayers(); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.revivePlayer = function(id) {
  try { const p = Game.getPlayer(id); if (!p) return; p.alive = true; p.eliminated = false; Admin.toast(p.name + ' revived', 'success'); Admin.log('Admin: revived ' + p.name, 'success'); Admin.refreshPlayers(); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.changeRole = function(id, roleId) {
  try { const p = Game.getPlayer(id); if (!p || !ROLES[roleId]) return; const oldRole = p.role ? p.role.name : '?'; p.role = ROLES[roleId]; Admin.toast(p.name + ': ' + oldRole + ' to ' + ROLES[roleId].name, 'success'); Admin.log('Admin: changed ' + p.name + ' role to ' + ROLES[roleId].name, 'action'); Admin.refreshPlayers(); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.killAll = function() {
  try { Game.getPlayers().forEach(p => { p.alive = false; p.eliminated = true; }); Admin.toast('All killed', 'warn'); Admin.log('Admin: all killed', 'warn'); Admin.refreshPlayers(); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.reviveAll = function() {
  try { Game.getPlayers().forEach(p => { p.alive = true; p.eliminated = false; }); Admin.toast('All revived', 'success'); Admin.log('Admin: all revived', 'success'); Admin.refreshPlayers(); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.shuffleRoles = function() {
  try { const players = Game.getPlayers(); const roles = players.map(p => p.role).sort(() => Math.random() - 0.5); players.forEach((p, i) => p.role = roles[i]); Admin.toast('Roles shuffled!', 'success'); Admin.log('Admin: roles shuffled', 'action'); Admin.refreshPlayers(); } catch(e) { Admin.toast(e.message, 'error'); }
};

Admin.inspectPlayer = function(id) {
  try {
    const p = Game.getPlayer(id);
    if (!p) return;
    const info = ['Name: ' + p.name, 'ID: ' + p.id, 'Role: ' + (p.role ? p.role.name + ' (' + p.role.team + ')' : '?'), 'Alive: ' + p.alive, 'Votes: ' + (p.voteCount || 0), 'Last Will: ' + (p.lastWill || '(none)'), 'Vests: ' + (p.vests || 0)].join('\n');
    Admin.showModal({ header: 'Player: ' + p.name, body: '<pre style="font-family:var(--font-mono);font-size:0.82rem;white-space:pre-wrap;color:var(--a-text)">' + info + '</pre>' });
  } catch(e) { Admin.toast(e.message, 'error'); }
};
