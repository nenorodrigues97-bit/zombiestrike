// ============================================================
// MAP RENDERER — ZombieStrike v2.0
// Zombicide-inspired visuals + tactical movement system
// ============================================================

import { MISSION_01, CHARACTERS } from './game-data.js';

const CELL_W = 120, CELL_H = 104;
const CANVAS_W = 840, CANVAS_H = 520;

const C = {
  street: '#424040', streetLine: 'rgba(255,255,255,0.08)',
  building: '#d0b878', buildingWall: '#1c1208', buildingTile: 'rgba(0,0,0,0.07)',
  grass: '#3a6c1a', grassAlt: '#2e5a12',
  parking: '#2a2826', parkingLine: 'rgba(255,210,0,0.40)',
  window: '#1a3352', door: '#7a4e18',
  spawnFill: 'rgba(200,40,20,0.14)', spawnBorder: '#dd2810',
  exitFill:  'rgba(30,170,60,0.14)', exitBorder:  '#22b03a',
  selFill:   'rgba(245,197,24,0.22)', selBorder:  '#f5c518',
  mv1Fill: 'rgba(30,120,220,0.30)', mv1Border: 'rgba(80,160,255,0.90)',
  mv2Fill: 'rgba(30,120,220,0.18)', mv2Border: 'rgba(80,160,255,0.60)',
  mv3Fill: 'rgba(30,120,220,0.10)', mv3Border: 'rgba(80,160,255,0.35)',
  atkFill: 'rgba(220,80,20,0.24)',  atkBorder: 'rgba(255,120,40,0.85)',
  walker: '#4e8a4e', runner: '#b89818', fatty: '#b86018', colosso: '#cc1028',
  noise: '#c0152a', objective: '#e8b810',
};

let zoneRects = {};
let canvas, ctx;
let gameState    = null;
let selectedZone = null;
let reachableZones = [];
let reachableCosts  = {};
let rangedZones  = [];
let mapActionMode = null;
let mouseDownX = 0, mouseDownY = 0;
let animFrame  = 0;
let clickHandler = null;

// ── Zone rects ────────────────────────────────────────────────────────────────
function buildZoneRects() {
  zoneRects = {};
  for (const zone of MISSION_01.zones) {
    zoneRects[zone.id] = {
      x: zone.col * CELL_W, y: zone.row * CELL_H,
      w: zone.cols * CELL_W, h: zone.rows * CELL_H,
      zone
    };
  }
}

// ── Exports ───────────────────────────────────────────────────────────────────
export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  buildZoneRects();

  canvas.addEventListener('mousedown', e => { mouseDownX = e.clientX; mouseDownY = e.clientY; });
  canvas.addEventListener('click', handleCanvasClick);
  canvas.addEventListener('mousemove', e => {
    if (!mapActionMode) { canvas.style.cursor = 'default'; return; }
    const z = getZoneAtEvent(e);
    const valid = z && (reachableZones.includes(z) || rangedZones.includes(z));
    canvas.style.cursor = valid ? 'pointer' : 'crosshair';
  });
  canvas.addEventListener('mouseleave', () => { if (!mapActionMode) canvas.style.cursor = 'default'; });
  startRenderLoop();
}

export function updateGameState(state) { gameState = state; }
export function setSelectedZone(zoneId) { selectedZone = zoneId; }

export function setReachableZones(zones) {
  if (Array.isArray(zones)) {
    reachableZones = zones;
    reachableCosts = {};
    for (const z of zones) reachableCosts[z] = 1;
  } else {
    reachableZones = Object.keys(zones);
    reachableCosts = { ...zones };
  }
}

export function setRangedZones(zones) { rangedZones = Array.isArray(zones) ? zones : []; }

export function setPendingAction(mode) {
  mapActionMode = mode;
  if (!mode) rangedZones = [];
  if (canvas) canvas.style.cursor = mode ? 'crosshair' : 'default';
}

export function onZoneClick(handler) { clickHandler = handler; }

export function getZoneAt(x, y) {
  for (const [id, r] of Object.entries(zoneRects)) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return id;
  }
  return null;
}

export function getZoneRect(zoneId) { return zoneRects[zoneId] || null; }

// ── Event handlers ────────────────────────────────────────────────────────────
function handleCanvasClick(e) {
  if (!clickHandler) return;
  if (Math.abs(e.clientX - mouseDownX) > 6 || Math.abs(e.clientY - mouseDownY) > 6) return;
  const z = getZoneAtEvent(e);
  if (z) clickHandler(z);
}

function getZoneAtEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top)  * (canvas.height / rect.height);
  return getZoneAt(x, y);
}

// ── Render loop ───────────────────────────────────────────────────────────────
function startRenderLoop() {
  function loop() { animFrame++; draw(); requestAnimationFrame(loop); }
  requestAnimationFrame(loop);
}

// ── Main draw ─────────────────────────────────────────────────────────────────
function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = C.street;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  drawStreetGrid();
  for (const r of Object.values(zoneRects)) drawZoneBase(r);
  for (const [id, r] of Object.entries(zoneRects)) drawZoneOverlays(id, r);
  drawZoneLabels();
  if (gameState) {
    drawObjectiveTokens();
    drawZombieTokens();
    drawNoiseTokens();
    drawSurvivorTokens();
    drawTurnIndicator();
  }
  drawBorder();
  drawCompass();
  if (mapActionMode) drawActionModeOverlay();
}

// ── Street grid ───────────────────────────────────────────────────────────────
function drawStreetGrid() {
  ctx.strokeStyle = C.streetLine;
  ctx.lineWidth = 1;
  ctx.setLineDash([14, 9]);
  for (let r = 0; r <= 5; r++) {
    const y = r * CELL_H + CELL_H / 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }
  for (let c = 0; c <= 7; c++) {
    const x = c * CELL_W + CELL_W / 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  ctx.setLineDash([]);
}

// ── Zone base rendering ───────────────────────────────────────────────────────
function drawZoneBase(r) {
  switch (r.zone.type) {
    case 'building': drawBuildingZone(r); break;
    case 'grass':    drawGrassZone(r); break;
    case 'parking':  drawParkingZone(r); break;
    default:         drawRoadZone(r); break;
  }
}

function drawRoadZone(r) {
  ctx.fillStyle = '#3e3c3a';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 10]);
  const mx = r.x + r.w / 2, my = r.y + r.h / 2;
  ctx.beginPath(); ctx.moveTo(mx, r.y + 4); ctx.lineTo(mx, r.y + r.h - 4); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(r.x + 4, my); ctx.lineTo(r.x + r.w - 4, my); ctx.stroke();
  ctx.setLineDash([]);
}

function drawBuildingZone(r) {
  const { zone } = r;
  ctx.fillStyle = C.building;
  ctx.fillRect(r.x, r.y, r.w, r.h);

  // Tile grid clipped to zone
  ctx.save();
  ctx.beginPath(); ctx.rect(r.x + 3, r.y + 3, r.w - 6, r.h - 6); ctx.clip();
  ctx.strokeStyle = C.buildingTile;
  ctx.lineWidth = 0.7;
  const ts = 20;
  const sx = Math.floor(r.x / ts) * ts, sy = Math.floor(r.y / ts) * ts;
  for (let x = sx; x < r.x + r.w; x += ts) { ctx.beginPath(); ctx.moveTo(x, r.y); ctx.lineTo(x, r.y + r.h); ctx.stroke(); }
  for (let y = sy; y < r.y + r.h; y += ts) { ctx.beginPath(); ctx.moveTo(r.x, y); ctx.lineTo(r.x + r.w, y); ctx.stroke(); }
  ctx.restore();

  // Thick wall border
  ctx.strokeStyle = C.buildingWall;
  ctx.lineWidth = 5;
  ctx.strokeRect(r.x + 2.5, r.y + 2.5, r.w - 5, r.h - 5);

  // Windows — horizontal walls
  ctx.fillStyle = C.window;
  const wW = 18, wH = 8, hCols = Math.max(1, Math.floor(r.w / 38));
  for (let i = 0; i < hCols; i++) {
    const wx = r.x + 14 + i * (r.w - 28) / Math.max(hCols - 1, 1) - wW / 2;
    ctx.fillRect(wx, r.y + 7, wW, wH);
    if (r.h > 110) ctx.fillRect(wx, r.y + r.h - 7 - wH, wW, wH);
  }
  // Windows — vertical walls
  const vRows = Math.max(1, Math.floor(r.h / 38));
  for (let i = 0; i < vRows; i++) {
    const wy = r.y + 14 + i * (r.h - 28) / Math.max(vRows - 1, 1) - wW / 2;
    ctx.fillRect(r.x + 7, wy, wH, wW);
    ctx.fillRect(r.x + r.w - 7 - wH, wy, wH, wW);
  }

  // Door
  if (zone.hasDoor) {
    ctx.fillStyle = C.door;
    ctx.fillRect(r.x + r.w / 2 - 11, r.y + r.h - 5, 22, 5);
    ctx.strokeStyle = '#c88030';
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + r.w / 2 - 11, r.y + r.h - 5, 22, 5);
  }
}

function drawGrassZone(r) {
  ctx.fillStyle = C.grass;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.fillStyle = C.grassAlt;
  for (let i = 0; i < 14; i++) {
    const gx = r.x + ((i * 71 + 13) % r.w);
    const gy = r.y + ((i * 43 + 19) % r.h);
    ctx.beginPath(); ctx.arc(gx, gy, 4 + (i % 3) * 3, 0, Math.PI * 2); ctx.fill();
  }
}

function drawParkingZone(r) {
  ctx.fillStyle = C.parking;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  ctx.strokeStyle = C.parkingLine;
  ctx.lineWidth = 1.5;
  const spaces = Math.max(2, Math.floor(r.w / 40));
  for (let i = 1; i < spaces; i++) {
    const x = r.x + (r.w / spaces) * i;
    ctx.beginPath(); ctx.moveTo(x, r.y + 6); ctx.lineTo(x, r.y + r.h - 6); ctx.stroke();
  }
  ctx.fillStyle = 'rgba(255,210,0,0.16)';
  ctx.font = "bold 30px 'Bebas Neue'";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('P', r.x + r.w / 2, r.y + r.h / 2);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Zone overlays ─────────────────────────────────────────────────────────────
function drawZoneOverlays(id, r) {
  const { zone } = r;
  const isSelected  = id === selectedZone;
  const isReachable = reachableZones.includes(id) && !isSelected;
  const isRanged    = rangedZones.includes(id);
  const isExit      = zone.isExit;
  const isSpawn     = !!zone.spawnId;
  const cost        = reachableCosts[id];

  if (isSpawn) {
    ctx.fillStyle = C.spawnFill;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  if (isExit) {
    const p = 0.14 + 0.08 * Math.sin(animFrame * 0.05);
    ctx.fillStyle = `rgba(30,170,60,${p})`;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }

  // Movement zones — color by cost
  if (isReachable && !isRanged) {
    let fill, border, bw;
    if      (cost <= 1) { fill = C.mv1Fill; border = C.mv1Border; bw = 2.5; }
    else if (cost <= 2) { fill = C.mv2Fill; border = C.mv2Border; bw = 2; }
    else                { fill = C.mv3Fill; border = C.mv3Border; bw = 1.5; }

    ctx.fillStyle = fill;
    ctx.fillRect(r.x, r.y, r.w, r.h);

    const p = mapActionMode ? 0.7 + 0.3 * Math.sin(animFrame * 0.10) : 1;
    ctx.save();
    ctx.globalAlpha = p;
    ctx.strokeStyle = border;
    ctx.lineWidth = bw;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.restore();

    // Action cost label
    if (mapActionMode === 'move' && cost !== undefined) {
      const label = `${cost} ação`;
      ctx.font = "bold 9px 'Share Tech Mono'";
      const tw = ctx.measureText(label).width + 8;
      ctx.fillStyle = 'rgba(5,20,60,0.82)';
      ctx.fillRect(r.x + r.w / 2 - tw / 2, r.y + r.h / 2 - 8, tw, 14);
      ctx.fillStyle = '#80c0ff';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, r.x + r.w / 2, r.y + r.h / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }

  // Attack zones
  if (isRanged) {
    const p = 0.7 + 0.3 * Math.sin(animFrame * 0.10);
    ctx.fillStyle = C.atkFill;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.strokeStyle = C.atkBorder;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    ctx.restore();
    if (mapActionMode === 'ranged') {
      ctx.font = '13px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🎯', r.x + r.w / 2, r.y + r.h / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
  }

  // Selected
  if (isSelected) {
    ctx.fillStyle = C.selFill;
    ctx.fillRect(r.x, r.y, r.w, r.h);
    ctx.strokeStyle = C.selBorder;
    ctx.lineWidth = 3;
    ctx.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
  }

  // Default border
  if (!isSelected && !isReachable && !isRanged) {
    if (isSpawn) {
      ctx.strokeStyle = C.spawnBorder;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
      ctx.setLineDash([]);
    } else if (isExit) {
      ctx.strokeStyle = C.exitBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
    } else {
      ctx.strokeStyle = 'rgba(255,255,255,0.07)';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 0.5, r.y + 0.5, r.w - 1, r.h - 1);
    }
  }
}

// ── Zone labels ───────────────────────────────────────────────────────────────
function drawZoneLabels() {
  for (const [id, r] of Object.entries(zoneRects)) {
    const { zone } = r;
    const isExit  = zone.isExit;
    const isSpawn = !!zone.spawnId;

    // Zone name with backdrop
    ctx.font = "bold 9px 'Share Tech Mono'";
    const label = zone.name.toUpperCase();
    const tw = ctx.measureText(label).width + 6;
    ctx.fillStyle = 'rgba(0,0,0,0.60)';
    ctx.fillRect(r.x + 4, r.y + r.h - 14, tw, 12);
    ctx.fillStyle = isExit ? '#22c048' : isSpawn ? '#ff6050' : 'rgba(255,255,255,0.55)';
    ctx.textAlign = 'left'; ctx.textBaseline = 'bottom';
    ctx.fillText(label, r.x + 7, r.y + r.h - 3);

    // Spawn badge
    if (isSpawn) {
      ctx.fillStyle = 'rgba(170,25,10,0.88)';
      ctx.fillRect(r.x + 4, r.y + 4, 26, 16);
      ctx.strokeStyle = '#ee2810';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 4, r.y + 4, 26, 16);
      ctx.fillStyle = '#ffaa90';
      ctx.font = "bold 11px 'Bebas Neue'";
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(zone.spawnId, r.x + 17, r.y + 12);
    }

    // Exit marker
    if (isExit) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const p = 0.5 + 0.25 * Math.sin(animFrame * 0.06);
      ctx.save();
      ctx.globalAlpha = p;
      ctx.strokeStyle = '#22c048'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 24, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, 15, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.font = '22px serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🚁', cx, cy - 4);
      ctx.fillStyle = '#22c048';
      ctx.font = "bold 10px 'Bebas Neue'";
      ctx.textBaseline = 'top';
      ctx.fillText('SAÍDA', cx, cy + 14);
    }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Objective tokens ──────────────────────────────────────────────────────────
function drawObjectiveTokens() {
  if (!gameState?.tokens) return;
  for (const [tid, token] of Object.entries(gameState.tokens)) {
    if (token.collected) continue;
    const r = zoneRects[token.zone];
    if (!r) continue;
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2 - 16;
    const p = 0.7 + 0.3 * Math.sin(animFrame * 0.09);
    ctx.save();
    ctx.globalAlpha = p;
    ctx.strokeStyle = C.objective; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(230,184,16,0.12)'; ctx.fill();
    ctx.restore();
    ctx.font = '13px serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(token.label || '⭐', cx, cy + 0.5);
    ctx.font = "bold 7px 'Share Tech Mono'";
    ctx.fillStyle = C.objective;
    ctx.fillText(tid, cx, cy + 20);
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Zombie tokens (grouped by zone + type, with count badge) ──────────────────
function drawZombieTokens() {
  if (!gameState?.zombies) return;
  const byZone = {};
  for (const z of Object.values(gameState.zombies)) {
    if (!byZone[z.zone]) byZone[z.zone] = {};
    byZone[z.zone][z.type] = (byZone[z.zone][z.type] || 0) + 1;
  }
  for (const [zoneId, typeCounts] of Object.entries(byZone)) {
    const r = zoneRects[zoneId];
    if (!r) continue;
    let ox = r.x + r.w - 6, oy = r.y + 6;
    for (const [type, count] of Object.entries(typeCounts)) {
      const zd = getZombieData(type);
      if (!zd) continue;
      const size = type === 'colosso' ? 24 : 18;
      ox -= size + 4;
      if (ox < r.x + 4) { ox = r.x + r.w - size - 8; oy += size + 6; }
      const cx = ox + size / 2, cy = oy + size / 2;

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.55)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
      ctx.fillStyle = darken(zd.color, 0.3);
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.fillStyle = zd.color;
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = lighten(zd.color);
      ctx.lineWidth = type === 'colosso' ? 2 : 1.5;
      ctx.beginPath(); ctx.arc(cx, cy, size / 2, 0, Math.PI * 2); ctx.stroke();

      ctx.fillStyle = '#fff';
      ctx.font = `bold ${type === 'colosso' ? 13 : 10}px 'Bebas Neue'`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(zd.label, cx, cy + 0.5);

      if (count > 1) {
        const bx = cx + size / 2 - 4, by = cy - size / 2 + 4;
        ctx.fillStyle = '#c0152a';
        ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(bx, by, 7, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 7px sans-serif';
        ctx.fillText(count, bx, by + 0.5);
      }
    }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Noise tokens ──────────────────────────────────────────────────────────────
function drawNoiseTokens() {
  if (!gameState?.noise) return;
  for (const [zoneId, count] of Object.entries(gameState.noise)) {
    if (count <= 0) continue;
    const r = zoneRects[zoneId];
    if (!r) continue;
    let nx = r.x + 6, ny = r.y + 24;
    for (let i = 0; i < Math.min(count, 6); i++) {
      ctx.fillStyle = C.noise;
      ctx.globalAlpha = 0.80;
      ctx.beginPath(); ctx.arc(nx, ny, 4, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      nx += 10;
      if (nx > r.x + r.w - 8) { nx = r.x + 6; ny += 10; }
    }
  }
}

// ── Survivor tokens ───────────────────────────────────────────────────────────
function drawSurvivorTokens() {
  if (!gameState?.players) return;
  const byZone = {};
  for (const [pid, p] of Object.entries(gameState.players)) {
    if (!p.zone || p.eliminated) continue;
    if (!byZone[p.zone]) byZone[p.zone] = [];
    byZone[p.zone].push({ ...p, id: pid });
  }
  for (const [zoneId, players] of Object.entries(byZone)) {
    const r = zoneRects[zoneId];
    if (!r) continue;
    let ox = r.x + 6, oy = r.y + r.h - 20;
    for (const p of players) {
      const char = getCharData(p.character);
      if (!char) continue;
      const isActive = gameState.activePlayer === p.id;
      const radius = isActive ? 13 : 11;
      const cx = ox + radius, cy = oy - radius;

      if (isActive) {
        const pulse = 0.35 + 0.30 * Math.sin(animFrame * 0.14);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = char.color; ctx.lineWidth = 2;
        ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.arc(cx, cy, radius + 7, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.50)'; ctx.shadowBlur = 5; ctx.shadowOffsetY = 2;
      ctx.fillStyle = hexToRgba(char.color, 0.22);
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.restore();

      ctx.fillStyle = hexToRgba(char.color, 0.42);
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = char.color;
      ctx.lineWidth = isActive ? 2.5 : 2;
      ctx.beginPath(); ctx.arc(cx, cy, radius, 0, Math.PI * 2); ctx.stroke();

      ctx.fillStyle = char.color;
      ctx.font = `bold ${isActive ? 12 : 11}px 'Bebas Neue'`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(char.name.charAt(0), cx, cy + 0.5);

      if (p.wounds > 0) {
        const wx = cx + radius - 3, wy = cy - radius + 3;
        ctx.fillStyle = '#c0152a';
        ctx.beginPath(); ctx.arc(wx, wy, 5, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(wx, wy, 5, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 6px sans-serif';
        ctx.fillText(p.wounds, wx, wy + 0.5);
      }

      ox += radius * 2 + 4;
      if (ox > r.x + r.w - 14) { ox = r.x + 6; oy -= radius * 2 + 4; }
    }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Turn indicator ────────────────────────────────────────────────────────────
function drawTurnIndicator() {
  if (!gameState?.activePlayer) return;
  const player = gameState.players?.[gameState.activePlayer];
  if (!player) return;
  const char = getCharData(player.character);
  if (!char) return;

  ctx.font = "bold 10px 'Share Tech Mono'";
  const text = `▶ ${char.name} — ${player.actionsLeft ?? 0} AÇÕES`;
  const tw = ctx.measureText(text).width + 20;
  const bx = CANVAS_W / 2 - tw / 2, by = 6;

  ctx.fillStyle = 'rgba(0,0,0,0.88)';
  ctx.fillRect(bx, by, tw, 18);
  ctx.strokeStyle = char.color || '#1a6fc4';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, tw, 18);
  ctx.fillStyle = char.color || '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS_W / 2, by + 9);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
}

// ── Action mode overlay ───────────────────────────────────────────────────────
function drawActionModeOverlay() {
  const labels = {
    move:   '🚶 CLIQUE EM UMA ZONA AZUL PARA MOVER',
    ranged: '🔫 CLIQUE EM UMA ZONA LARANJA PARA ATIRAR',
  };
  const text = labels[mapActionMode] || '▶ SELECIONE UMA ZONA';
  const p = 0.88 + 0.12 * Math.sin(animFrame * 0.15);

  ctx.font = "bold 10px 'Share Tech Mono'";
  const tw = ctx.measureText(text).width + 24;
  const bx = CANVAS_W / 2 - tw / 2, by = CANVAS_H - 26;

  const isAtk = mapActionMode === 'ranged';
  ctx.fillStyle = isAtk ? `rgba(160,50,10,${0.88*p})` : `rgba(15,70,170,${0.88*p})`;
  ctx.fillRect(bx, by, tw, 20);
  ctx.strokeStyle = isAtk ? `rgba(255,120,40,${p})` : `rgba(80,160,255,${p})`;
  ctx.lineWidth = 1.5;
  ctx.strokeRect(bx, by, tw, 20);
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(text, CANVAS_W / 2, by + 10);
  ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

  ctx.strokeStyle = isAtk ? `rgba(255,120,40,${0.22*p})` : `rgba(80,160,255,${0.22*p})`;
  ctx.lineWidth = 3;
  ctx.globalAlpha = p;
  ctx.strokeRect(2, 2, CANVAS_W - 4, CANVAS_H - 4);
  ctx.globalAlpha = 1;
}

// ── Decorative border + compass ───────────────────────────────────────────────
function drawBorder() {
  ctx.strokeStyle = '#3a3530'; ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, CANVAS_W - 3, CANVAS_H - 3);
  const corners = [[0,0],[CANVAS_W-14,0],[0,CANVAS_H-14],[CANVAS_W-14,CANVAS_H-14]];
  ctx.fillStyle = 'rgba(192,21,42,0.28)';
  corners.forEach(([cx,cy]) => ctx.fillRect(cx, cy, 14, 14));
}

function drawCompass() {
  const cx = CANVAS_W - 22, cy = CANVAS_H - 22;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a3530'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 16, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#c0152a';
  ctx.font = "bold 10px 'Bebas Neue'";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy - 5);
  ctx.fillStyle = '#555';
  ctx.font = "7px 'Bebas Neue'";
  ctx.fillText('S', cx, cy + 6); ctx.fillText('W', cx - 8, cy); ctx.fillText('E', cx + 8, cy);
  ctx.strokeStyle = '#c0152a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy - 13); ctx.lineTo(cx, cy - 8); ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getZombieData(type) {
  return { walker:{color:C.walker,label:'W'}, runner:{color:C.runner,label:'R'}, fatty:{color:C.fatty,label:'F'}, colosso:{color:C.colosso,label:'C'} }[type] || null;
}

function getCharData(charId) {
  const c = CHARACTERS[charId];
  return c ? { name: c.name, color: c.color } : null;
}

function hexToRgba(hex, alpha) {
  if (!hex || hex.length < 7) return `rgba(150,150,150,${alpha})`;
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

function lighten(hex) {
  if (!hex || hex.length < 7) return '#fff';
  const r = Math.min(255, parseInt(hex.slice(1,3),16) + 55);
  const g = Math.min(255, parseInt(hex.slice(3,5),16) + 55);
  const b = Math.min(255, parseInt(hex.slice(5,7),16) + 55);
  return `rgb(${r},${g},${b})`;
}

function darken(hex, f) {
  if (!hex || hex.length < 7) return '#000';
  const r = Math.floor(parseInt(hex.slice(1,3),16) * (1-f));
  const g = Math.floor(parseInt(hex.slice(3,5),16) * (1-f));
  const b = Math.floor(parseInt(hex.slice(5,7),16) * (1-f));
  return `rgb(${r},${g},${b})`;
}
