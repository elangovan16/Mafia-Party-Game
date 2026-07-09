/* js/admin/night.js - Night Action Tester */
window.Admin = window.Admin || {};

Admin.refreshDropdowns = function() {
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
};

Admin.submitNightAction = function() {
  const actorId = document.getElementById('night-actor').value;
  const actionType = document.getElementById('night-action-type').value;
  const targetId = document.getElementById('night-target').value;
  if (!actorId || !targetId) { Admin.toast('Select actor and target', 'error'); return; }
  let actorName = actorId, targetName = targetId;
  try { actorName = Game.getPlayer(actorId).name || actorId; targetName = Game.getPlayer(targetId).name || targetId; } catch(e) {}
  Admin.state.pendingNightActions.push({ actorId, actorName, actionType, targetId, targetName });
  Admin.renderPendingActions();
  try { Game.submitNightAction(actorId, targetId, actionType); } catch(e) {}
  Admin.toast('Action queued: ' + actionType, 'success');
  Admin.log('Night action: ' + actorName + ' -> ' + actionType + ' -> ' + targetName, 'action');
};

Admin.renderPendingActions = function() {
  const container = document.getElementById('pending-actions');
  if (!container) return;
  if (Admin.state.pendingNightActions.length === 0) { container.innerHTML = '<p class="empty-hint">No actions yet.</p>'; return; }
  const icons = { mafia_kill:'🔪', investigate:'🔍', heal:'💉', roleblock:'🚫', sk_kill:'🗡', guard:'🛡', consigliere:'📜', vigilante:'🏹' };
  container.innerHTML = '';
  Admin.state.pendingNightActions.forEach(a => {
    const item = document.createElement('div');
    item.className = 'pending-action-item';
    item.innerHTML = '<span class="pa-icon">' + (icons[a.actionType] || '') + '</span><span><strong>' + a.actorName + '</strong> → <em>' + a.actionType + '</em> → <strong>' + a.targetName + '</strong></span>';
    container.appendChild(item);
  });
};

Admin.clearNightActions = function() { 
  Admin.state.pendingNightActions = []; 
  Admin.renderPendingActions(); 
  Admin.toast('Night actions cleared'); 
  Admin.log('Admin: night actions cleared', 'warn'); 
};

Admin.resolveNight = function() {
  try {
    const results = Game.resolveNightActions();
    Admin.renderResolution(results);
    Admin.state.pendingNightActions = [];
    Admin.renderPendingActions();
    if (Admin.refreshPlayers) Admin.refreshPlayers();
    Admin.log('Night resolved: ' + JSON.stringify(results), 'event');
    Admin.toast('Night resolved!', 'success');
  } catch(e) { Admin.toast('Resolve failed: ' + e.message, 'error'); Admin.log('Night resolve error: ' + e.message, 'error'); }
};

Admin.renderResolution = function(results) {
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
};
