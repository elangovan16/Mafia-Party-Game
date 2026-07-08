/* ================================================================
   ui.js – UI Controller
   Manages: screens, setup, lobby, role reveal, night, day, vote,
            elimination, win, rules, particles, toasts, modals
   ================================================================ */

/* ── Screen Management ─────────────────────────────────────────── */
let currentScreen = 'screen-loading';

function showScreen(id) {
  const prev = document.querySelector('.screen.active');
  if (prev) {
    prev.classList.remove('active');
  }
  const next = document.getElementById(id);
  if (next) {
    next.classList.add('active');
    currentScreen = id;
  }
}

/* ── Loading Screen ─────────────────────────────────────────── */
window.addEventListener('DOMContentLoaded', () => {
  createParticles();
  applyPreset(playerCountValue); // populates roleCounts AND builds the setup grid
  buildRulesRoles();
  buildSettingsGrids();
  Network.init(handleNetworkMessage);

// Auto-advance loading screen
  setTimeout(() => {
    showScreen('screen-home');
  }, 2200);
});

/* ── Accidental Reload Prevention ───────────────────────────── */
window.addEventListener('beforeunload', (e) => {
  if (Game && Game.getState && Game.getState().phase) {
    const phase = Game.getState().phase;
    // Only warn if the game is actually running (not setup, not win)
    if (phase !== 'setup' && phase !== 'win') {
      e.preventDefault();
      e.returnValue = ''; // Standard browser warning
    }
  }
});

/* ── Particles ──────────────────────────────────────────────── */
function createParticles() {
  const container = document.getElementById('particles');
  if (!container) return;
  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.cssText = `
      left: ${Math.random() * 100}%;
      top: ${Math.random() * 100}%;
      --dur: ${4 + Math.random() * 6}s;
      --delay: ${-Math.random() * 6}s;
      width: ${1 + Math.random() * 3}px;
      height: ${1 + Math.random() * 3}px;
      opacity: ${0.2 + Math.random() * 0.6};
    `;
    container.appendChild(p);
  }
}

/* ── Toast Notifications ────────────────────────────────────── */
function showToast(msg, type = 'default') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3200);
}

/* ── Modal ──────────────────────────────────────────────────── */
function showModal({ header, body, buttons }) {
  document.getElementById('modal-header').innerHTML = header || '';
  document.getElementById('modal-body').innerHTML   = body   || '';

  const footer = document.getElementById('modal-footer');
  footer.innerHTML = '';
  (buttons || []).forEach(btn => {
    const b = document.createElement('button');
    b.className = `btn ${btn.class || 'btn-ghost'}`;
    b.textContent = btn.text;
    b.onclick = () => {
      closeModal();
      if (btn.action) btn.action();
    };
    footer.appendChild(b);
  });

  document.getElementById('modal-overlay').style.display = 'flex';
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

/* ── Dynamic Settings Renderer ───────────────────────────────── */
function buildSettingsGrids() {
  const localContainer = document.getElementById('local-settings-grid');
  const onlineContainer = document.getElementById('online-settings-grid');
  
  if (localContainer) localContainer.innerHTML = renderSettingsHTML(true);
  if (onlineContainer) onlineContainer.innerHTML = renderSettingsHTML(false);
}

function renderSettingsHTML(isLocal) {
  return Object.entries(SETTINGS_CONFIG).map(([key, config]) => {
    const id = isLocal ? `local-${config.id}` : config.id;
    if (config.type === 'select') {
      const optionsHTML = config.options.map(opt => {
        const selected = opt.value === config.default ? 'selected' : '';
        return `<option value="${opt.value}" ${selected}>${opt.label}</option>`;
      }).join('');
      
      return `
        <div class="setting-item">
          <div class="setting-label-block">
            <span class="setting-label">${config.label}</span>
            <span class="setting-desc">${config.desc}</span>
          </div>
          <select id="${id}" class="select-field">
            ${optionsHTML}
          </select>
        </div>
      `;
    } else if (config.type === 'toggle') {
      const checked = config.default ? 'checked' : '';
      return `
        <div class="setting-item toggle-item">
          <div class="setting-label-block">
            <span class="setting-label">${config.label}</span>
            <span class="setting-desc">${config.desc}</span>
          </div>
          <label class="toggle"><input type="checkbox" id="${id}" ${checked} /><span class="toggle-slider"></span></label>
        </div>
      `;
    }
    return '';
  }).join('');
}

/* ── Rules Screen ───────────────────────────────────────────── */
function showTab(tabId, btn) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(tabId)?.classList.add('active');
  btn?.classList.add('active');
}

function buildRulesRoles() {
  const list = document.getElementById('rules-roles-list');
  if (!list) return;

  list.innerHTML = ROLE_ORDER.map(id => {
    const role = ROLES[id];
    if (!role) return '';
    const teamClass = `team-${role.team}`;
    return `
      <div class="role-info-card" data-team="${role.team}">
        <div class="ric-icon">${role.icon}</div>
        <div class="ric-body">
          <div class="ric-header">
            <span class="ric-name">${role.name}</span>
            <span class="ric-team ${teamClass}">${role.team.charAt(0).toUpperCase() + role.team.slice(1)}</span>
          </div>
          <div class="ric-desc">${role.description}</div>
          <div class="ric-ability">${role.ability}</div>
        </div>
      </div>
    `;
  }).join('');
}

function filterRoles(team, btn) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');

  document.querySelectorAll('.role-info-card').forEach(card => {
    card.style.display = (team === 'all' || card.dataset.team === team) ? 'flex' : 'none';
  });
}

/* ── Append Log ─────────────────────────────────────────────── */
const UI = {
  appendLog(msg, important) {
    const entries = document.getElementById('log-entries');
    if (!entries) return;
    const entry = document.createElement('div');
    entry.className = `log-entry ${important ? 'important' : ''}`;
    entry.textContent = msg;
    entries.appendChild(entry);
    entries.scrollTop = entries.scrollHeight;
  }
};

// Expose for game.js
window.UI = UI;

/* ── Roles in Play (In-Game Reference) ───────────────────────── */
function showRolesInPlay() {
  if (!gameRoleConfig) return;
  
  let listHtml = '';
  // Convert config entries to array and sort them based on ROLE_ORDER
  const entries = Object.entries(gameRoleConfig).sort((a, b) => {
    const idxA = ROLE_ORDER.indexOf(a[0]);
    const idxB = ROLE_ORDER.indexOf(b[0]);
    return (idxA !== -1 ? idxA : 999) - (idxB !== -1 ? idxB : 999);
  });
  
  for (const [roleId, count] of entries) {
    if (count > 0) {
      const roleDef = ROLES[roleId];
      if (roleDef) {
        listHtml += `
          <div style="display:flex; justify-content:space-between; padding: 0.5rem; border-bottom: 1px solid rgba(255,255,255,0.1);">
            <div style="display:flex; align-items:center; gap: 0.5rem;">
              <span>${roleDef.icon}</span>
              <span style="color:${roleDef.color}; font-weight:bold;">${roleDef.name}</span>
            </div>
            <div style="font-weight:bold;">x${count}</div>
          </div>
        `;
      }
    }
  }

  showModal({
    header: '<h3>📜 Roles in Play</h3>',
    body: `
      <div style="max-height: 50vh; overflow-y:auto; margin-bottom: 1rem; text-align:left;">
        ${listHtml}
      </div>
      <p style="font-size: 0.8rem; color: var(--text-secondary); text-align:center;">
        This is the starting configuration. Some players may have been eliminated!
      </p>
    `,
    buttons: [{ text: 'Close', class: 'btn-ghost' }]
  });
}
