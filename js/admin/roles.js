/* js/admin/roles.js - Role Browser */
window.Admin = window.Admin || {};

Admin.buildRoleBrowser = function() {
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
};

Admin.filterRoles = function(team, btn) {
  document.querySelectorAll('.role-filter-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  document.querySelectorAll('.role-card').forEach(card => { card.style.display = (team === 'all' || card.dataset.team === team) ? '' : 'none'; });
};
