// ============================================================
// MAP RENDERER — ZombieStrike
// Draws the game map on an HTML5 Canvas
// ============================================================

import { MISSION_01, CHARACTERS } from './game-data.js';

const COLS = 7, ROWS = 5;
const CELL_W = 120, CELL_H = 104;
const CANVAS_W = 840, CANVAS_H = 520;

// Color palette
const C = {
  road:     '#181816', roadLine: 'rgba(255,210,0,0.2)',
  grass:    '#0c130a', grassDark: '#0e180b',
  building: '#131210', buildingWall: '#2a2520',
  floor:    '#161412', parking: '#131311',
  spawn:    'rgba(192,21,42,0.2)', spawnBorder: 'rgba(192,21,42,0.6)',
  exit:     'rgba(42,154,58,0.2)', exitBorder: 'rgba(42,154,58,0.7)',
  selected: 'rgba(245,197,24,0.12)', selectedBorder: '#f5c518',
  reachable:'rgba(26,111,196,0.12)', reachableBorder: 'rgba(26,111,196,0.5)',
  wall:     '#2a2520', door: '#7a5a20', window: '#0d2535',
  text:     'rgba(255,255,255,0.2)', textDim: 'rgba(255,255,255,0.12)',
  walker:   '#5a8a5a', runner: '#c8a820', fatty: '#c86820', colosso: '#ff1a35',
  noise:    '#c0152a',
  objective:'#f5c518',
};

// Zone grid positions (row, col, rowspan, colspan)
// Maps zone id to pixel rect
let zoneRects = {};

function buildZoneRects() {
  zoneRects = {};
  for (const zone of MISSION_01.zones) {
    zoneRects[zone.id] = {
      x: zone.col * CELL_W,
      y: zone.row * CELL_H,
      w: zone.cols * CELL_W,
      h: zone.rows * CELL_H,
      zone
    };
  }
}

let canvas, ctx;
let gameState = null;
let selectedZone = null;
let reachableZones = [];
let animFrame = 0;
let clickHandler = null;

export function initRenderer(canvasEl) {
  canvas = canvasEl;
  ctx = canvas.getContext('2d');
  buildZoneRects();
  canvas.addEventListener('click', handleCanvasClick);
  startRenderLoop();
}

export function updateGameState(state) {
  gameState = state;
}

export function setSelectedZone(zoneId) {
  selectedZone = zoneId;
}

export function setReachableZones(zones) {
  reachableZones = zones;
}

export function onZoneClick(handler) {
  clickHandler = handler;
}

function handleCanvasClick(e) {
  if (!clickHandler) return;
  const rect = canvas.getBoundingClientRect();
  // Account for canvas scaling via CSS transform
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const x = (e.clientX - rect.left) * scaleX;
  const y = (e.clientY - rect.top) * scaleY;

  for (const [id, r] of Object.entries(zoneRects)) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) {
      clickHandler(id);
      break;
    }
  }
}

function startRenderLoop() {
  function loop() {
    animFrame++;
    draw();
    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);
}

function draw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  ctx.fillStyle = '#111110';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawRoads();
  drawZones();
  drawZoneLabels();
  if (gameState) {
    drawTokens();
    drawZombies();
    drawSurvivors();
    drawTurnIndicator();
  }
  drawBorder();
  drawCompass();
}

function drawRoads() {
  // Draw road base everywhere
  ctx.fillStyle = C.road;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  // Road dash lines horizontal
  ctx.strokeStyle = C.roadLine;
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 10]);
  for (let row = 0; row <= ROWS; row++) {
    const y = row * CELL_H + CELL_H / 2;
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(CANVAS_W, y); ctx.stroke();
  }
  // Vertical
  for (let col = 0; col <= COLS; col++) {
    const x = col * CELL_W + CELL_W / 2;
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, CANVAS_H); ctx.stroke();
  }
  ctx.setLineDash([]);
}

function drawZones() {
  for (const [id, r] of Object.entries(zoneRects)) {
    const { zone } = r;
    const isSelected  = id === selectedZone;
    const isReachable = reachableZones.includes(id) && !isSelected;
    const isExit      = zone.isExit;
    const isSpawn     = !!zone.spawnId;

    // Base fill by type
    switch (zone.type) {
      case 'grass':
        ctx.fillStyle = C.grass;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        drawGrassTexture(r);
        break;
      case 'building':
        ctx.fillStyle = C.floor;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        drawBuildingDetails(r, zone);
        break;
      case 'parking':
        ctx.fillStyle = C.parking;
        ctx.fillRect(r.x, r.y, r.w, r.h);
        drawParkingLines(r);
        break;
      default: // road
        ctx.fillStyle = '#1a1a18';
        ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    // Overlays
    if (isSpawn) {
      ctx.fillStyle = C.spawn;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (isExit) {
      const pulse = 0.15 + 0.1 * Math.sin(animFrame * 0.05);
      ctx.fillStyle = `rgba(42,154,58,${pulse})`;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (isReachable) {
      ctx.fillStyle = C.reachable;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }
    if (isSelected) {
      ctx.fillStyle = C.selected;
      ctx.fillRect(r.x, r.y, r.w, r.h);
    }

    // Border
    let borderColor = 'rgba(255,255,255,0.06)';
    let borderWidth = 1;
    if (isSelected)  { borderColor = C.selectedBorder; borderWidth = 2.5; }
    else if (isReachable) { borderColor = C.reachableBorder; borderWidth = 1.5; }
    else if (isExit) { borderColor = C.exitBorder; borderWidth = 2; }
    else if (isSpawn) {
      ctx.strokeStyle = C.spawnBorder;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([7, 4]);
      ctx.strokeRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5);
      ctx.setLineDash([]);
      continue;
    }
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.strokeRect(r.x + 0.75, r.y + 0.75, r.w - 1.5, r.h - 1.5);
  }
}

function drawGrassTexture(r) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = '#0e1a0b';
  for (let i = 0; i < 6; i++) {
    const cx = r.x + ((i * 47) % r.w);
    const cy = r.y + ((i * 31 + 15) % r.h);
    ctx.beginPath();
    ctx.arc(cx, cy, 8 + (i % 3) * 4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawBuildingDetails(r, zone) {
  // Walls
  ctx.strokeStyle = C.wall;
  ctx.lineWidth = 4;
  ctx.strokeRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4);

  // Windows
  ctx.fillStyle = C.window;
  const winW = 28, winH = 12;
  const cols = Math.floor(r.w / 40);
  const rows = Math.floor(r.h / 35);
  for (let wr = 0; wr < rows; wr++) {
    for (let wc = 0; wc < cols; wc++) {
      const wx = r.x + 12 + wc * (r.w - 24) / Math.max(cols - 1, 1) - winW / 2;
      const wy = r.y + 16 + wr * (r.h - 32) / Math.max(rows - 1, 1);
      ctx.fillRect(wx, wy, winW, winH);
      ctx.strokeStyle = 'rgba(26,64,96,0.6)';
      ctx.lineWidth = 1;
      ctx.strokeRect(wx, wy, winW, winH);
    }
  }

  // Door if applicable
  if (zone.hasDoor) {
    ctx.fillStyle = C.door;
    ctx.fillRect(r.x + r.w / 2 - 9, r.y + r.h - 8, 18, 8);
    ctx.strokeStyle = '#c8a040';
    ctx.lineWidth = 1;
    ctx.strokeRect(r.x + r.w / 2 - 9, r.y + r.h - 8, 18, 8);
  }
}

function drawParkingLines(r) {
  ctx.strokeStyle = '#1e1e1c';
  ctx.lineWidth = 1.5;
  const spaces = 3;
  for (let i = 1; i < spaces; i++) {
    const x = r.x + (r.w / spaces) * i;
    ctx.beginPath(); ctx.moveTo(x, r.y + 8); ctx.lineTo(x, r.y + r.h - 8); ctx.stroke();
  }
}

function drawZoneLabels() {
  ctx.font = "7px 'Share Tech Mono'";
  ctx.textAlign = 'left';
  ctx.textBaseline = 'bottom';

  for (const [id, r] of Object.entries(zoneRects)) {
    const { zone } = r;
    const isExit = zone.isExit;
    const isSpawn = !!zone.spawnId;

    ctx.fillStyle = isExit ? 'rgba(42,154,58,0.7)' : isSpawn ? 'rgba(192,21,42,0.6)' : C.textDim;
    ctx.fillText(zone.name.toUpperCase(), r.x + 4, r.y + r.h - 3);

    // Spawn ID badge
    if (zone.spawnId) {
      ctx.fillStyle = '#7a0d1a';
      ctx.fillRect(r.x + 4, r.y + 4, 22, 13);
      ctx.strokeStyle = '#c0152a';
      ctx.lineWidth = 1;
      ctx.strokeRect(r.x + 4, r.y + 4, 22, 13);
      ctx.fillStyle = '#ff4050';
      ctx.font = "bold 9px 'Bebas Neue'";
      ctx.textAlign = 'center';
      ctx.fillText(zone.spawnId, r.x + 15, r.y + 14);
      ctx.font = "7px 'Share Tech Mono'";
      ctx.textAlign = 'left';
    }

    // Exit marker
    if (isExit) {
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const pulse = 0.4 + 0.2 * Math.sin(animFrame * 0.05);
      ctx.save();
      ctx.globalAlpha = pulse;
      ctx.strokeStyle = '#2a9a3a';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(cx, cy, 22, 0, Math.PI * 2); ctx.stroke();
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.arc(cx, cy, 14, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();
      ctx.fillStyle = '#2a9a3a';
      ctx.font = "10px 'Bebas Neue'";
      ctx.textAlign = 'center';
      ctx.fillText('SAÍDA', cx, cy - 4);
      ctx.font = '13px serif';
      ctx.fillText('🚁', cx - 6, cy + 12);
      ctx.font = "7px 'Share Tech Mono'";
      ctx.textAlign = 'left';
    }
  }
  ctx.textAlign = 'left';
}

function drawTokens() {
  if (!gameState?.tokens) return;
  for (const [tokenId, token] of Object.entries(gameState.tokens)) {
    if (token.collected) continue;
    const r = zoneRects[token.zone];
    if (!r) continue;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const pulse = 0.7 + 0.3 * Math.sin(animFrame * 0.08);

    ctx.save();
    ctx.globalAlpha = pulse;
    ctx.strokeStyle = C.objective;
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(cx, cy, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = 'rgba(245,197,24,0.12)';
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.font = '11px serif';
    ctx.textAlign = 'center';
    ctx.fillText(token.label || '⭐', cx - 5, cy + 4);
    ctx.font = "6px 'Share Tech Mono'";
    ctx.fillStyle = C.objective;
    ctx.fillText(tokenId, cx, cy + 18);
    ctx.restore();
  }
}

function drawZombies() {
  if (!gameState?.zombies) return;

  // Group zombies by zone
  const byZone = {};
  for (const [zid, z] of Object.entries(gameState.zombies)) {
    if (!byZone[z.zone]) byZone[z.zone] = [];
    byZone[z.zone].push({ ...z, id: zid });
  }

  for (const [zoneId, zombies] of Object.entries(byZone)) {
    const r = zoneRects[zoneId];
    if (!r) continue;

    // Draw zombie tokens top-right area
    let ox = r.x + r.w - 6, oy = r.y + 6;
    for (const z of zombies) {
      const zdata = getZombieData(z.type);
      if (!zdata) continue;
      const size = z.type === 'colosso' ? 20 : 16;
      ox -= size + 2;
      if (ox < r.x + 4) { ox = r.x + r.w - size - 8; oy += size + 3; }

      ctx.fillStyle = hexToRgba(zdata.color, 0.6);
      ctx.fillRect(ox, oy, size, size);
      ctx.strokeStyle = zdata.color;
      ctx.lineWidth = z.type === 'colosso' ? 2 : 1.5;
      ctx.strokeRect(ox, oy, size, size);

      ctx.fillStyle = zdata.color;
      ctx.font = `bold ${z.type === 'colosso' ? 11 : 9}px 'Share Tech Mono'`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(zdata.label, ox + size / 2, oy + size / 2);
    }
  }
  ctx.textBaseline = 'alphabetic';
}

function drawSurvivors() {
  if (!gameState?.players) return;

  // Group by zone
  const byZone = {};
  for (const [pid, p] of Object.entries(gameState.players)) {
    if (!p.zone || p.eliminated) continue;
    if (!byZone[p.zone]) byZone[p.zone] = [];
    byZone[p.zone].push({ ...p, id: pid });
  }

  for (const [zoneId, players] of Object.entries(byZone)) {
    const r = zoneRects[zoneId];
    if (!r) continue;

    let ox = r.x + 4, oy = r.y + r.h - 18;
    for (const p of players) {
      const char = getCharData(p.character);
      if (!char) continue;
      const isActive = gameState.activePlayer === p.id;
      const color = char.color;
      const radius = isActive ? 12 : 10;

      // Active pulse ring
      if (isActive) {
        const pulse = 0.4 + 0.3 * Math.sin(animFrame * 0.12);
        ctx.save();
        ctx.globalAlpha = pulse;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath(); ctx.arc(ox + radius, oy - radius + 2, radius + 5, 0, Math.PI * 2); ctx.stroke();
        ctx.setLineDash([]);
        ctx.restore();
      }

      ctx.fillStyle = hexToRgba(color, 0.5);
      ctx.beginPath(); ctx.arc(ox + radius, oy - radius + 2, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = color;
      ctx.lineWidth = isActive ? 2.5 : 2;
      ctx.beginPath(); ctx.arc(ox + radius, oy - radius + 2, radius, 0, Math.PI * 2); ctx.stroke();

      ctx.fillStyle = color;
      ctx.font = `bold ${isActive ? 11 : 10}px 'Bebas Neue'`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(char.name.charAt(0), ox + radius, oy - radius + 3);

      // Wound indicators
      if (p.wounds > 0) {
        ctx.fillStyle = '#c0152a';
        ctx.font = "8px sans-serif";
        ctx.fillText('⚠', ox + radius * 2, oy - radius * 2 + 2);
      }

      ox += radius * 2 + 4;
      if (ox > r.x + r.w - 20) { ox = r.x + 4; oy -= radius * 2 + 4; }
    }
  }

  // Noise tokens
  if (gameState?.noise) {
    for (const [zoneId, count] of Object.entries(gameState.noise)) {
      if (count <= 0) continue;
      const r = zoneRects[zoneId];
      if (!r) continue;
      let nx = r.x + 5, ny = r.y + 5;
      for (let i = 0; i < Math.min(count, 6); i++) {
        ctx.fillStyle = C.noise;
        ctx.globalAlpha = 0.85;
        ctx.beginPath(); ctx.arc(nx, ny, 4, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
        nx += 10;
        if (nx > r.x + 40) { nx = r.x + 5; ny += 10; }
      }
    }
  }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

function drawTurnIndicator() {
  if (!gameState?.activePlayer) return;
  const player = gameState.players?.[gameState.activePlayer];
  if (!player) return;
  const char = getCharData(player.character);
  if (!char) return;

  const text = `▶ VEZ DE ${char.name} — ${player.actionsLeft ?? 0} AÇÕES`;
  const textW = ctx.measureText(text).width + 24;
  const bx = CANVAS_W / 2 - textW / 2, by = CANVAS_H * 0.38;

  ctx.fillStyle = 'rgba(0,0,0,0.92)';
  ctx.strokeStyle = '#1a6fc4';
  ctx.lineWidth = 1.5;
  ctx.fillRect(bx, by, textW, 20);
  ctx.strokeRect(bx, by, textW, 20);
  ctx.fillStyle = '#4a9af5';
  ctx.font = "9px 'Share Tech Mono'";
  ctx.textAlign = 'center';
  ctx.letterSpacing = '1px';
  ctx.fillText(text, CANVAS_W / 2, by + 13);
  ctx.textAlign = 'left';
}

function drawBorder() {
  ctx.strokeStyle = '#3a3530';
  ctx.lineWidth = 3;
  ctx.strokeRect(1.5, 1.5, CANVAS_W - 3, CANVAS_H - 3);
  // Corner accents
  const corners = [[0,0],[CANVAS_W-16,0],[0,CANVAS_H-16],[CANVAS_W-16,CANVAS_H-16]];
  ctx.fillStyle = 'rgba(192,21,42,0.35)';
  corners.forEach(([cx,cy]) => ctx.fillRect(cx, cy, 16, 16));
}

function drawCompass() {
  const cx = CANVAS_W - 24, cy = CANVAS_H - 24;
  ctx.fillStyle = 'rgba(0,0,0,0.85)';
  ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#3a3530'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(cx, cy, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.fillStyle = '#c0152a';
  ctx.font = "bold 11px 'Bebas Neue'";
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText('N', cx, cy - 6);
  ctx.fillStyle = '#444';
  ctx.font = "8px 'Bebas Neue'";
  ctx.fillText('S', cx, cy + 7);
  ctx.fillText('W', cx - 9, cy + 1);
  ctx.fillText('E', cx + 9, cy + 1);
  // North arrow
  ctx.strokeStyle = '#c0152a'; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.moveTo(cx, cy - 14); ctx.lineTo(cx, cy - 8); ctx.stroke();
  ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
}

// Helpers
function getZombieData(type) {
  return { walker:{color:'#5a8a5a',label:'W'}, runner:{color:'#c8a820',label:'R'}, fatty:{color:'#c86820',label:'F'}, colosso:{color:'#ff1a35',label:'C'} }[type];
}
function getCharData(charId) {
  const map = { nick:{name:'NICK',color:'#4a9af5'}, bilico:{name:'BILICO',color:'#ff3a50'}, allastor:{name:'ALLASTOR55',color:'#e07520'}, math:{name:'MATH',color:'#2a9a3a'}, felipinho:{name:'FELIPINHO',color:'#f5c518'}, solamentos:{name:'SOLAMENTOS',color:'#9a5aca'}, bigbi:{name:'BIGBI',color:'#aaaaaa'} };
  return map[charId];
}
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function getZoneAt(x, y) {
  for (const [id, r] of Object.entries(zoneRects)) {
    if (x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h) return id;
  }
  return null;
}

export function getZoneRect(zoneId) {
  return zoneRects[zoneId] || null;
}
