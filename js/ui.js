// ============================================================
// UI — ZombieStrike
// Renders game state to DOM elements
// ============================================================

import { CHARACTERS, WEAPONS, ZOMBIES, MISSION_01 } from './game-data.js';
import { updateGameState, setSelectedZone, setReachableZones } from './map-renderer.js';

let localPlayerId = null;
let localGameState = null;
let onActionCallback = null;

export function initUI(playerId, onAction) {
  localPlayerId = playerId;
  onActionCallback = onAction;
  initMapControls();
}

export function renderGameState(state) {
  localGameState = state;
  updateGameState(state);

  renderHUD(state);
  renderObjectives(state);
  renderSpawnInfo(state);
  renderNoiseInfo(state);
  renderActionLog(state);
  renderActivePlayer(state);
  renderInventory(state);
  renderActionButtons(state);
  renderStatusPanel(state);
  renderPlayersBar(state);
  renderStatusBar(state);
  updateDangerLevels(state);

  // Update map selection based on available actions
  const myPlayer = state.players[localPlayerId];
  if (myPlayer && !myPlayer.eliminated && state.activePlayer === localPlayerId && state.phase === 'players') {
    const adj = MISSION_01.adjacency[myPlayer.zone] || [];
    setReachableZones(myPlayer.actionsLeft > 0 ? adj : []);
    setSelectedZone(myPlayer.zone);
  } else {
    setReachableZones([]);
    setSelectedZone(null);
  }
}

function renderHUD(state) {
  document.getElementById('hud-turn').textContent = state.turn;
  const phaseEl = document.getElementById('hud-phase');
  const dotEl = document.getElementById('phase-dot');
  if (state.phase === 'players') {
    phaseEl.textContent = 'FASE DOS JOGADORES';
    phaseEl.style.color = 'var(--blue)';
    dotEl.style.background = 'var(--blue)';
    dotEl.style.boxShadow = '0 0 8px var(--blue)';
  } else if (state.phase === 'zombies') {
    phaseEl.textContent = 'FASE DOS ZUMBIS';
    phaseEl.style.color = 'var(--red)';
    dotEl.style.background = 'var(--red)';
    dotEl.style.boxShadow = '0 0 8px var(--red)';
  } else {
    phaseEl.textContent = state.winner === 'survivors' ? '🎉 VITÓRIA!' : '💀 DERROTA';
  }

  // End turn button
  const btnEnd = document.getElementById('btn-end-turn');
  const isMyTurn = state.activePlayer === localPlayerId && state.phase === 'players';
  btnEnd.style.opacity = isMyTurn ? '1' : '0.4';
  btnEnd.style.pointerEvents = isMyTurn ? 'all' : 'none';
}

function renderObjectives(state) {
  const el = document.getElementById('objectives-list');
  if (!el) return;
  el.innerHTML = state.objectives.map(obj => `
    <div class="obj-item">
      <div class="obj-check ${obj.done ? 'done' : state.objectives.indexOf(obj) === state.objectives.findIndex(o => !o.done) ? 'active' : 'todo'}">
        ${obj.done ? '✓' : '→'}
      </div>
      <span class="obj-text ${obj.done ? 'done' : !state.objectives.slice(0, state.objectives.indexOf(obj)).some(o => !o.done) ? 'active' : ''}">
        ${obj.text}
      </span>
    </div>
  `).join('');
}

function renderSpawnInfo(state) {
  const el = document.getElementById('spawn-info');
  if (!el) return;
  const spawnMap = { S1:'spawn_norte', S2:'spawn_sul', S3:'armazem' };
  const level = getHighestDangerLevel(state);
  const rules = MISSION_01.spawnRules[level];
  el.innerHTML = Object.entries(spawnMap).map(([sid, zid]) => {
    const zone = MISSION_01.zones.find(z => z.id === zid);
    const spawnRules = rules[sid] || [];
    const tags = spawnRules.map(r => `<span class="spawn-tag ${r.type.charAt(0)}">${r.type.charAt(0).toUpperCase()}×${r.qty}</span>`).join('');
    return `<div class="spawn-row"><span class="spawn-zone">${sid} ${zone?.name?.toUpperCase() || zid}</span><div class="spawn-types">${tags || '—'}</div></div>`;
  }).join('');
}

function renderNoiseInfo(state) {
  const el = document.getElementById('noise-info');
  if (!el) return;
  const noiseZones = Object.entries(state.noise || {})
    .filter(([,v]) => v > 0)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 6);

  if (noiseZones.length === 0) {
    el.innerHTML = '<div style="padding:4px;font-family:Share Tech Mono;font-size:9px;color:#444">Silêncio...</div>';
    return;
  }

  el.innerHTML = '<div class="noise-map">' + noiseZones.map(([zid, count]) => {
    const zone = MISSION_01.zones.find(z => z.id === zid);
    const cls = count >= 4 ? 'hot' : count >= 2 ? 'warm' : '';
    return `<div class="noise-cell ${cls}"><span class="noise-val">${count}</span>${zone?.name?.toUpperCase().slice(0,6) || zid}</div>`;
  }).join('') + '</div>';
}

function renderActionLog(state) {
  const el = document.getElementById('action-log');
  if (!el) return;
  const logs = (state.log || []).slice(0, 20);
  el.innerHTML = logs.map(entry => `
    <div class="log-entry">
      <span class="log-turn">T${entry.turn}</span>
      <span class="log-text">${entry.message}</span>
    </div>
  `).join('');
}

function renderActivePlayer(state) {
  const player = state.players[state.activePlayer];
  const el = document.getElementById('ap-name');
  const roleEl = document.getElementById('ap-role');
  const levelEl = document.getElementById('ap-level');
  const pipsEl = document.getElementById('actions-pips');
  const xpEl = document.getElementById('ap-xp');
  const xpFill = document.getElementById('ap-xp-fill');
  const photoEl = document.getElementById('ap-photo');
  const photoImg = document.getElementById('ap-photo-img');
  const photoBadge = document.getElementById('ap-photo-badge');

  if (!player) {
    if (el) el.textContent = '—';
    return;
  }

  const char = CHARACTERS[player.character];
  if (!char) return;

  if (el) el.textContent = char.name;
  if (roleEl) roleEl.textContent = char.role;

  // Level
  const levelColors = { blue:'var(--blue)', yellow:'var(--yellow)', orange:'var(--orange)', red:'var(--red)' };
  if (levelEl) {
    levelEl.textContent = `● ${player.dangerLevel.toUpperCase()}`;
    levelEl.style.color = levelColors[player.dangerLevel];
    levelEl.style.borderColor = levelColors[player.dangerLevel];
  }

  // Actions pips
  if (pipsEl) {
    const total = player.maxActions;
    const left = player.actionsLeft;
    pipsEl.innerHTML = Array.from({ length: total }, (_, i) =>
      `<div class="action-pip ${i >= left ? 'used' : ''}">${i >= left ? '✗' : i + 1}</div>`
    ).join('');
  }

  // XP
  const levelXP = { blue:0, yellow:7, orange:19, red:43 };
  const nextLevel = { blue:7, yellow:19, orange:43, red:99 };
  const xpBase = levelXP[player.dangerLevel];
  const xpNext = nextLevel[player.dangerLevel];
  const xpProgress = ((player.xp - xpBase) / (xpNext - xpBase)) * 100;
  if (xpEl) xpEl.textContent = `${player.xp} / ${xpNext}`;
  if (xpFill) xpFill.style.width = `${Math.min(100, Math.max(0, xpProgress))}%`;
}

function renderInventory(state) {
  const myPlayer = state.players[localPlayerId];
  const el = document.getElementById('inv-grid');
  if (!el || !myPlayer) return;

  const slots = 5;
  el.innerHTML = Array.from({ length: slots }, (_, i) => {
    const itemId = myPlayer.inventory[i];
    if (!itemId) return `<div class="inv-slot empty"><span class="inv-icon">⬜</span><span class="inv-name">VAZIO</span></div>`;
    const item = WEAPONS[itemId];
    const isEquipped = itemId === myPlayer.equippedLeft || itemId === myPlayer.equippedRight;
    return `<div class="inv-slot ${isEquipped ? 'equipped' : ''}" data-item="${itemId}" title="${item?.name || itemId}">
      <span class="inv-icon">${item?.icon || '📦'}</span>
      <span class="inv-name">${item?.name?.substring(0, 6) || itemId.substring(0, 6)}</span>
    </div>`;
  }).join('');
}

function renderActionButtons(state) {
  const el = document.getElementById('action-buttons');
  if (!el) return;

  const isMyTurn = state.activePlayer === localPlayerId && state.phase === 'players';
  const myPlayer = state.players[localPlayerId];
  const hasActions = myPlayer && myPlayer.actionsLeft > 0;

  const actions = [
    { id:'move',   icon:'🚶', label:'MOVER',          cost:'1 AÇÃO', primary:true,  available: isMyTurn && hasActions },
    { id:'melee',  icon:'⚔️', label:'COMBATE C.C.',   cost:'1 AÇÃO', primary:true,  available: isMyTurn && hasActions },
    { id:'ranged', icon:'🔫', label:'ATIRAR',          cost:'1 AÇÃO', primary:true,  available: isMyTurn && hasActions },
    { id:'search', icon:'🔍', label:'BUSCAR',          cost:'1 AÇÃO', primary:false, available: isMyTurn && hasActions },
    { id:'collect',icon:'🎯', label:'PEGAR OBJETIVO', cost:'1 AÇÃO', primary:false, available: isMyTurn && hasActions },
    { id:'heal',   icon:'💊', label:'USAR CURA',       cost:'1 AÇÃO', primary:false, available: isMyTurn && hasActions },
    { id:'pass',   icon:'⏹',  label:'PASSAR TURNO',   cost:'—',      primary:false, available: isMyTurn },
  ];

  el.innerHTML = actions.map(a => `
    <button class="action-btn ${a.primary ? 'primary' : ''} ${!a.available ? 'disabled' : ''}"
      data-action="${a.id}" ${!a.available ? 'disabled' : ''}>
      <span class="btn-icon">${a.icon}</span>
      ${a.label}
      <span class="btn-cost">${a.cost}</span>
    </button>
  `).join('');

  // Bind events
  el.querySelectorAll('.action-btn:not(.disabled)').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      if (onActionCallback) onActionCallback(action);
    });
  });
}

function renderStatusPanel(state) {
  const el = document.getElementById('status-panel');
  if (!el) return;

  const myPlayer = state.players[localPlayerId];
  if (!myPlayer) return;

  const zombiesInZone = Object.values(state.zombies).filter(z => z.zone === myPlayer.zone).length;
  const noise = state.noise?.[myPlayer.zone] || 0;
  const zone = MISSION_01.zones.find(z => z.id === myPlayer.zone);

  el.innerHTML = `
    <div class="status-row">
      <span class="status-key">FERIDOS</span>
      <span class="status-val ${myPlayer.wounds > 0 ? 'danger' : 'ok'}">${myPlayer.wounds} / ${myPlayer.maxWounds}</span>
    </div>
    <div class="status-row">
      <span class="status-key">ZONA ATUAL</span>
      <span class="status-val">${zone?.name?.toUpperCase() || myPlayer.zone}</span>
    </div>
    <div class="status-row">
      <span class="status-key">ZUMBIS NA ZONA</span>
      <span class="status-val ${zombiesInZone > 0 ? 'danger' : 'ok'}">${zombiesInZone}</span>
    </div>
    <div class="status-row">
      <span class="status-key">RUÍDO NA ZONA</span>
      <span class="status-val ${noise >= 4 ? 'danger' : noise >= 2 ? 'warn' : 'ok'}">${noise} tokens</span>
    </div>
    <div class="status-row">
      <span class="status-key">PASSIVA</span>
      <span class="status-val ok" style="font-size:10px">${CHARACTERS[myPlayer.character]?.passive?.split(':')[0] || '—'}</span>
    </div>
  `;
}

function renderPlayersBar(state) {
  const el = document.getElementById('players-bar');
  if (!el) return;

  const playerIds = Object.keys(state.players);
  el.style.gridTemplateColumns = `repeat(${playerIds.length}, 1fr)`;

  el.innerHTML = playerIds.map(pid => {
    const p = state.players[pid];
    const char = CHARACTERS[p.character];
    if (!char) return '';
    const isActive = state.activePlayer === pid;
    const isMe = pid === localPlayerId;

    // Level bar segments
    const xpThresholds = [0, 7, 19, 43, 99];
    const xpPercent = (p.xp / 43) * 100;

    const itemSlots = Array.from({ length: 4 }, (_, i) => {
      const item = p.inventory[i];
      const w = item ? WEAPONS[item] : null;
      const isEquipped = item && (item === p.equippedLeft || item === p.equippedRight);
      return `<div class="pc-item ${!item ? 'empty' : isEquipped ? 'equipped' : ''}">${w?.icon || ''}</div>`;
    }).join('');

    return `
      <div class="player-card ${isActive ? 'active' : ''} ${p.eliminated ? 'eliminated' : ''} ${isMe ? 'is-me' : ''}"
           style="${isActive ? `border-top: 2px solid ${char.color};` : ''}">
        <div class="pc-header">
          <div class="pc-photo" style="border-color:${char.color}">
            <div style="width:100%;height:100%;background:${char.color}22;display:flex;align-items:center;justify-content:center;font-family:'Bebas Neue';font-size:14px;color:${char.color}">${char.name.charAt(0)}</div>
          </div>
          <div>
            <div class="pc-name" style="${isMe ? 'color:'+char.color : ''}">${char.name}</div>
          </div>
          ${isActive ? '<span class="pc-active-badge">VEZ</span>' : ''}
        </div>
        <div class="pc-role">${char.archetype.toUpperCase()}</div>
        <div class="pc-stats">
          <div class="pc-stat"><span class="pc-stat-label">AÇÕES</span><span class="pc-stat-val actions">${p.actionsLeft}</span></div>
          <div class="pc-stat"><span class="pc-stat-label">XP</span><span class="pc-stat-val xp">${p.xp}</span></div>
          <div class="pc-stat"><span class="pc-stat-label">FERIDO</span><span class="pc-stat-val wounds ${p.wounds === 0 ? 'safe' : ''}">${p.wounds}</span></div>
        </div>
        <div class="pc-items">${itemSlots}</div>
        <div class="pc-level-bar">
          ${Array.from({length:7},(_,i)=>`<div class="level-seg ${i < Math.floor(xpPercent/14.3) ? 'filled' : ''}"></div>`).join('')}
        </div>
      </div>`;
  }).join('');
}

function renderStatusBar(state) {
  const alive = Object.values(state.players).filter(p => !p.eliminated).length;
  const total = Object.keys(state.players).length;
  const totalZombies = Object.keys(state.zombies).length;
  const totalNoise = Object.values(state.noise || {}).reduce((a, b) => a + b, 0);
  const activePlayer = state.players[state.activePlayer];
  const activeChar = activePlayer ? CHARACTERS[activePlayer.character] : null;

  const onlineEl = document.getElementById('sb-online');
  const activeEl = document.getElementById('sb-active');
  const zombiesEl = document.getElementById('sb-zombies');
  const noiseEl = document.getElementById('sb-noise');

  if (onlineEl) onlineEl.textContent = `${alive}/${total} JOGADORES ONLINE`;
  if (activeEl) activeEl.textContent = activeChar ? `${activeChar.name} ESTÁ JOGANDO` : '—';
  if (zombiesEl) zombiesEl.textContent = `🧟 ${totalZombies} ZUMBIS NO MAPA`;
  if (noiseEl) noiseEl.textContent = `🔊 RUÍDO TOTAL: ${totalNoise}`;
}

function updateDangerLevels(state) {
  const level = getHighestDangerLevel(state);
  const levels = ['blue','yellow','orange','red'];
  const idx = levels.indexOf(level);
  document.querySelectorAll('.dlvl').forEach((el, i) => {
    el.classList.toggle('active', i <= idx);
  });
}

// ---- LOBBY UI ----

export function renderWaitingPlayers(players, localId) {
  const el = document.getElementById('waiting-player-list');
  const countEl = document.getElementById('player-count');
  if (!el) return;

  const playerList = Object.entries(players);
  if (countEl) countEl.textContent = playerList.length;

  el.innerHTML = playerList.map(([pid, p]) => {
    const char = CHARACTERS[p.character];
    return `
      <div class="player-entry">
        <div class="pe-token" style="border-color:${char?.color || '#fff'};color:${char?.color || '#fff'};background:${char?.color || '#fff'}22">
          ${char?.name?.charAt(0) || '?'}
        </div>
        <div class="pe-info">
          <div class="pe-name">${p.name} ${pid === localId ? '<em style="color:#555;font-size:11px">(você)</em>' : ''}</div>
          <div class="pe-char">${char?.name || p.character} · ${char?.archetype || ''}</div>
        </div>
        ${p.isHost ? '<span class="pe-host">HOST</span>' : '<span class="pe-ready">✓ PRONTO</span>'}
      </div>
    `;
  }).join('');
}

export function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(`screen-${screenId}`);
  if (el) el.classList.add('active');
}

export function showNotification(msg, type = '') {
  const el = document.getElementById('notification');
  if (!el) return;
  el.textContent = msg;
  el.className = `notification ${type}`;
  el.style.display = 'block';
  setTimeout(() => { el.style.display = 'none'; }, 3000);
}

export function showDiceModal(title, rolls, accuracy, onConfirm) {
  const modal = document.getElementById('dice-modal');
  const titleEl = document.getElementById('dice-title');
  const container = document.getElementById('dice-container');
  const resultEl = document.getElementById('dice-result');
  const confirmBtn = document.getElementById('dice-confirm');

  if (!modal) return;
  modal.style.display = 'flex';
  titleEl.textContent = title;
  resultEl.textContent = '';
  confirmBtn.style.display = 'none';

  // Animate dice rolling
  container.innerHTML = rolls.map(() => `<div class="die rolling">?</div>`).join('');

  setTimeout(() => {
    const dice = container.querySelectorAll('.die');
    let hits = 0;
    rolls.forEach((val, i) => {
      dice[i].classList.remove('rolling');
      dice[i].textContent = val;
      if (val >= accuracy) {
        dice[i].classList.add('hit');
        hits++;
      } else {
        dice[i].classList.add('miss');
      }
    });
    resultEl.textContent = `${hits} acerto(s) de ${rolls.length} dado(s)`;
    confirmBtn.style.display = 'block';
    confirmBtn.onclick = () => {
      modal.style.display = 'none';
      if (onConfirm) onConfirm(hits);
    };
  }, 600);
}

// Map controls — zoom/pan
function initMapControls() {
  const viewport = document.getElementById('mapViewport');
  const wrap = document.getElementById('mapSvgWrap');
  if (!viewport || !wrap) return;

  const SVG_W = 840, SVG_H = 520;
  let scale = 1, tx = 0, ty = 0;
  let dragging = false, startX = 0, startY = 0, startTx = 0, startTy = 0;
  const MIN_SCALE = 0.3, MAX_SCALE = 4;

  function applyTransform() {
    wrap.style.transform = `translate(${tx}px, ${ty}px) scale(${scale})`;
  }
  function clamp() {
    const vw = viewport.offsetWidth, vh = viewport.offsetHeight;
    const sw = SVG_W * scale, sh = SVG_H * scale;
    if (sw <= vw) { tx = (vw - sw) / 2; } else { tx = Math.max(vw - sw, Math.min(0, tx)); }
    if (sh <= vh) { ty = (vh - sh) / 2; } else { ty = Math.max(vh - sh, Math.min(0, ty)); }
  }
  function fitToViewport() {
    const vw = viewport.offsetWidth, vh = viewport.offsetHeight;
    if (vw === 0 || vh === 0) { requestAnimationFrame(fitToViewport); return; }
    scale = Math.min(vw / SVG_W, vh / SVG_H) * 0.95;
    tx = (vw - SVG_W * scale) / 2;
    ty = (vh - SVG_H * scale) / 2;
    applyTransform();
  }
  function zoomAt(cx, cy, factor) {
    const ns = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale * factor));
    const r = ns / scale;
    tx = cx - r * (cx - tx); ty = cy - r * (cy - ty); scale = ns;
    clamp(); applyTransform();
  }

  viewport.addEventListener('wheel', e => { e.preventDefault(); const rect = viewport.getBoundingClientRect(); zoomAt(e.clientX - rect.left, e.clientY - rect.top, e.deltaY < 0 ? 1.15 : 0.87); }, { passive: false });
  viewport.addEventListener('mousedown', e => { if (e.button !== 0) return; dragging = true; startX = e.clientX; startY = e.clientY; startTx = tx; startTy = ty; viewport.style.cursor = 'grabbing'; });
  document.addEventListener('mousemove', e => { if (!dragging) return; tx = startTx + (e.clientX - startX); ty = startTy + (e.clientY - startY); clamp(); applyTransform(); });
  document.addEventListener('mouseup', () => { dragging = false; viewport.style.cursor = 'grab'; });

  const zIn = document.getElementById('zoomIn');
  const zOut = document.getElementById('zoomOut');
  const zReset = document.getElementById('zoomReset');
  if (zIn) { zIn.addEventListener('mousedown', e => e.stopPropagation()); zIn.addEventListener('click', e => { e.stopPropagation(); zoomAt(viewport.offsetWidth/2, viewport.offsetHeight/2, 1.3); }); }
  if (zOut) { zOut.addEventListener('mousedown', e => e.stopPropagation()); zOut.addEventListener('click', e => { e.stopPropagation(); zoomAt(viewport.offsetWidth/2, viewport.offsetHeight/2, 0.77); }); }
  if (zReset) { zReset.addEventListener('mousedown', e => e.stopPropagation()); zReset.addEventListener('click', e => { e.stopPropagation(); fitToViewport(); }); }

  if (document.readyState === 'complete') { requestAnimationFrame(fitToViewport); }
  else { window.addEventListener('load', () => requestAnimationFrame(fitToViewport)); }
  window.addEventListener('resize', fitToViewport);
}

// Helper
function getHighestDangerLevel(state) {
  const order = ['blue','yellow','orange','red'];
  let highest = 'blue';
  for (const p of Object.values(state.players)) {
    if (!p.eliminated && order.indexOf(p.dangerLevel) > order.indexOf(highest)) {
      highest = p.dangerLevel;
    }
  }
  return highest;
}
