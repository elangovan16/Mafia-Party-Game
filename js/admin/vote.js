/* js/admin/vote.js - Vote and Elimination Tester */
window.Admin = window.Admin || {};

Admin.castVote = function() {
  const voterId = document.getElementById('vote-voter').value;
  const targetId = document.getElementById('vote-target').value;
  if (!voterId || !targetId) { Admin.toast('Select voter and target', 'error'); return; }
  Admin.state.adminVotes[voterId] = targetId;
  try { Game.castVote(voterId, targetId); } catch(e) {}
  let voterName = voterId, targetName = targetId;
  try { voterName = Game.getPlayer(voterId).name || voterId; targetName = Game.getPlayer(targetId).name || targetId; } catch(e) {}
  Admin.toast(voterName + ' voted for ' + targetName, 'success');
  Admin.log('Vote: ' + voterName + ' -> ' + targetName, 'action');
  Admin.renderVoteTally();
};

Admin.renderVoteTally = function() {
  const container = document.getElementById('admin-vote-tally');
  if (!container) return;
  const tally = {};
  Object.values(Admin.state.adminVotes).forEach(id => { tally[id] = (tally[id] || 0) + 1; });
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
};

Admin.resolveVote = function() {
  try {
    const eliminated = Game.resolveVote();
    if (eliminated) { Admin.toast(eliminated.name + ' eliminated!', 'warn'); Admin.log('Vote: ' + eliminated.name + ' eliminated', 'event'); }
    else { Admin.toast('Vote tied - no elimination', 'default'); Admin.log('Vote: tied', 'event'); }
    Admin.state.adminVotes = {}; Admin.renderVoteTally(); 
    if (Admin.refreshPlayers) Admin.refreshPlayers();
  } catch(e) { Admin.toast('Resolve failed: ' + e.message, 'error'); Admin.log('Vote resolve error: ' + e.message, 'error'); }
};

Admin.eliminatePlayer = function(idOrBtn, cause) {
  let targetId = idOrBtn;
  let causeStr = cause;
  if (!idOrBtn) { targetId = document.getElementById('elim-target').value; causeStr = document.getElementById('elim-cause').value; }
  if (!targetId) { Admin.toast('Select a player', 'error'); return; }
  try {
    const p = Game.getPlayer(targetId);
    if (!p) { Admin.toast('Player not found', 'error'); return; }
    Game.eliminatePlayer(targetId, causeStr);
    Admin.toast(p.name + ' eliminated (' + causeStr + ')', 'warn');
    Admin.log('Admin: eliminated ' + p.name + ', cause=' + causeStr, 'event');
    if (Admin.refreshPlayers) Admin.refreshPlayers();
  } catch(e) { Admin.toast('Eliminate error: ' + e.message, 'error'); Admin.log('Eliminate error: ' + e.message, 'error'); }
};

Admin.clearVotes = function() {
  Admin.state.adminVotes = {};
  try { Game.getPlayers().forEach(p => p.voteCount = 0); } catch(e) {}
  Admin.renderVoteTally(); Admin.toast('Votes cleared'); Admin.log('Admin: votes cleared', 'warn');
};
