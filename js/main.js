// ============================================================
// MAIN — ZombieStrike
// Entry point: connects Firebase, game engine, UI and map
// ============================================================

import { db, ref, set, get, onValue, update, push, remove, onDisconnect } from './firebase-config.js';
import { createInitialGameState, endPlayerTurn, movePlayer, performMeleeAttack, performRangedAttack, searchZone, collectObjective, useHealItem, rollDice, deepClone } from './game-engine.js';
import { initRenderer, onZoneClick, setPendingAction } from './map-renderer.js';
import { initUI, renderGameState, renderWaitingPlayers, showScreen, showNotification, showDiceModal } from './ui.js';
import { CHARACTERS, WEAPONS, MISSION_01 } from './game-data.js';

// ---- STATE ----
let roomCode = '';
let localPlayerId = '';
let localPlayerData = {};
let isHost = false;
let currentGameState = null;
let pendingAction = null; // action waiting for zone selection

// ---- INIT ----
window.addEventListener('DOMContentLoaded', () => {
  localPlayerId = generatePlayerId();
  setupLobbyUI();
  initUI(localPlayerId, handlePlayerAction);
  initRenderer(document.getElementById('gameCanvas'));
  onZoneClick(handleZoneClick);

  // Escape cancels pending actions
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && pendingAction) {
      pendingAction = null;
      setPendingAction(null);
      showNotification('Ação cancelada', '');
    }
  });
});

// ---- LOBBY ----

function setupLobbyUI() {
  // Character selection
  document.querySelectorAll('.char-opt').forEach(opt => {
    opt.addEventListener('click', () => {
      const parent = opt.closest('.char-select');
      parent.querySelectorAll('.char-opt').forEach(o => o.classList.remove('selected'));
      opt.classList.add('selected');
    });
  });

  document.getElementById('btn-create').addEventListener('click', createRoom);
  document.getElementById('btn-join').addEventListener('click', joinRoom);
  document.getElementById('btn-copy-code').addEventListener('click', copyRoomCode);
  document.getElementById('btn-start-game').addEventListener('click', startGame);
  document.getElementById('btn-end-turn').addEventListener('click', () => handlePlayerAction('pass'));
  document.getElementById('btn-rules').addEventListener('click', showRulesModal);
}

async function createRoom() {
  const name = document.getElementById('create-name').value.trim();
  const charEl = document.querySelector('#create-char-select .char-opt.selected');
  const character = charEl?.dataset?.char;

  if (!name) { showNotification('Digite seu nome!', 'warning'); return; }
  if (!character) { showNotification('Selecione um personagem!', 'warning'); return; }

  roomCode = generateRoomCode();
  localPlayerData = { name, character, isHost: true };
  isHost = true;

  // Create room in Firebase
  await set(ref(db, `rooms/${roomCode}`), {
    status: 'waiting',
    createdAt: Date.now(),
    players: {
      [localPlayerId]: { name, character, isHost: true, connected: true }
    }
  });

  // Handle disconnect
  onDisconnect(ref(db, `rooms/${roomCode}/players/${localPlayerId}`)).remove();

  document.getElementById('display-room-code').textContent = roomCode;
  document.getElementById('btn-start-game').style.display = 'block';
  document.getElementById('waiting-status').style.display = 'none';

  showScreen('waiting');
  listenToRoom();
  showNotification(`Sala ${roomCode} criada!`, 'success');
}

async function joinRoom() {
  const name = document.getElementById('join-name').value.trim();
  const charEl = document.querySelector('#join-char-select .char-opt.selected');
  const character = charEl?.dataset?.char;
  const code = document.getElementById('join-code').value.trim().toUpperCase();

  if (!name) { showNotification('Digite seu nome!', 'warning'); return; }
  if (!character) { showNotification('Selecione um personagem!', 'warning'); return; }
  if (!code) { showNotification('Digite o código da sala!', 'warning'); return; }

  // Check room exists
  const roomSnap = await get(ref(db, `rooms/${code}`));
  if (!roomSnap.exists()) { showNotification('Sala não encontrada!', 'warning'); return; }

  const room = roomSnap.val();
  if (room.status === 'playing') { showNotification('Partida já em andamento!', 'warning'); return; }

  // Check character not taken
  const players = room.players || {};
  const takenChars = Object.values(players).map(p => p.character);
  if (takenChars.includes(character)) { showNotification('Personagem já escolhido! Selecione outro.', 'warning'); return; }

  roomCode = code;
  localPlayerData = { name, character, isHost: false };
  isHost = false;

  await set(ref(db, `rooms/${roomCode}/players/${localPlayerId}`), { name, character, isHost: false, connected: true });
  onDisconnect(ref(db, `rooms/${roomCode}/players/${localPlayerId}`)).remove();

  document.getElementById('display-room-code').textContent = roomCode;
  showScreen('waiting');
  listenToRoom();
  showNotification(`Entrou na sala ${roomCode}!`, 'success');
}

function listenToRoom() {
  onValue(ref(db, `rooms/${roomCode}`), (snap) => {
    if (!snap.exists()) return;
    const room = snap.val();

    // Update taken characters in lobby
    if (room.players) {
      const taken = Object.values(room.players).map(p => p.character);
      document.querySelectorAll('.char-opt').forEach(opt => {
        const char = opt.dataset.char;
        const isMine = opt.closest('.char-select')?.querySelector('.selected') === opt;
        if (taken.includes(char) && !isMine) {
          opt.classList.add('taken');
        }
      });
      renderWaitingPlayers(room.players, localPlayerId);
    }

    // Game started
    if (room.status === 'playing' && room.gameState) {
      currentGameState = room.gameState;
      showScreen('game');
      renderGameState(currentGameState);
    }
  });

  // Listen to game state changes during game
  onValue(ref(db, `rooms/${roomCode}/gameState`), (snap) => {
    if (!snap.exists()) return;
    const state = snap.val();
    if (!state) return;
    currentGameState = state;
    renderGameState(currentGameState);

    // Handle end game
    if (state.winner) {
      setTimeout(() => {
        const msg = state.winner === 'survivors'
          ? '🎉 VITÓRIA! Os sobreviventes escaparam!'
          : '💀 DERROTA! Os zumbis venceram!';
        showNotification(msg, state.winner === 'survivors' ? 'success' : '');
      }, 500);
    }
  });
}

async function startGame() {
  if (!isHost) return;
  const snap = await get(ref(db, `rooms/${roomCode}/players`));
  if (!snap.exists()) return;

  const players = snap.val();
  if (Object.keys(players).length < 1) { showNotification('Precisa de pelo menos 1 jogador!', 'warning'); return; }

  const initialState = createInitialGameState(players);

  await update(ref(db, `rooms/${roomCode}`), {
    status: 'playing',
    gameState: initialState
  });
}

function copyRoomCode() {
  navigator.clipboard.writeText(roomCode).then(() => {
    showNotification('Código copiado!', 'success');
  });
}

// ---- GAME ACTIONS ----

function handlePlayerAction(action) {
  if (!currentGameState) return;
  const myPlayer = currentGameState.players[localPlayerId];
  if (!myPlayer || myPlayer.eliminated) return;
  if (currentGameState.activePlayer !== localPlayerId) {
    showNotification('Não é sua vez!', 'warning'); return;
  }

  switch (action) {
    case 'move':
      pendingAction = 'move';
      setPendingAction('move');
      showNotification('Clique em uma zona adjacente para mover  [ESC = cancelar]', '');
      break;

    case 'melee':
      const zombiesInZone = Object.values(currentGameState.zombies).filter(z => z.zone === myPlayer.zone);
      if (zombiesInZone.length === 0) { showNotification('Sem zumbis nesta zona!', 'warning'); return; }
      const meleeWeapon = getMeleeWeapon(myPlayer);
      if (!meleeWeapon) { showNotification('Sem arma corpo a corpo!', 'warning'); return; }
      const meleeResult = performMeleeAttack(deepClone(currentGameState), localPlayerId, meleeWeapon);
      if (meleeResult.error) { showNotification(meleeResult.error, 'warning'); return; }
      if (meleeResult.rolls) {
        const weapon = WEAPONS[meleeWeapon];
        showDiceModal(`COMBATE — ${weapon?.name || meleeWeapon}`, meleeResult.rolls, weapon?.accuracy || 4, () => {
          pushGameState(meleeResult.state);
        });
      } else {
        pushGameState(meleeResult.state);
      }
      break;

    case 'ranged':
      const rangedWeapon = getRangedWeapon(myPlayer);
      if (!rangedWeapon) { showNotification('Sem arma à distância!', 'warning'); return; }
      pendingAction = { type: 'ranged', weapon: rangedWeapon };
      setPendingAction('ranged');
      showNotification('Clique em uma zona para atirar  [ESC = cancelar]', '');
      break;

    case 'search':
      const searchResult = searchZone(deepClone(currentGameState), localPlayerId);
      if (searchResult.error) { showNotification(searchResult.error, 'warning'); return; }
      pushGameState(searchResult.state);
      if (searchResult.item) showNotification(`Encontrou: ${WEAPONS[searchResult.item]?.name || searchResult.item}!`, 'success');
      break;

    case 'collect':
      const tokenInZone = Object.entries(currentGameState.tokens)
        .find(([,t]) => t.zone === myPlayer.zone && !t.collected);
      if (!tokenInZone) { showNotification('Sem objetivo nesta zona!', 'warning'); return; }
      const collectResult = collectObjective(deepClone(currentGameState), localPlayerId, tokenInZone[0]);
      if (collectResult.error) { showNotification(collectResult.error, 'warning'); return; }
      pushGameState(collectResult.state);
      break;

    case 'heal':
      const healItem = myPlayer.inventory.find(i => WEAPONS[i]?.type === 'heal');
      if (!healItem) { showNotification('Sem item de cura!', 'warning'); return; }
      const healResult = useHealItem(deepClone(currentGameState), localPlayerId, healItem, localPlayerId);
      if (healResult.error) { showNotification(healResult.error, 'warning'); return; }
      pushGameState(healResult.state);
      break;

    case 'pass':
      const passResult = endPlayerTurn(deepClone(currentGameState), localPlayerId);
      if (passResult.error) { showNotification(passResult.error, 'warning'); return; }
      pushGameState(passResult.state);
      break;
  }
}

function handleZoneClick(zoneId) {
  if (!pendingAction || !currentGameState) return;

  if (pendingAction === 'move') {
    pendingAction = null;
    setPendingAction(null);
    const result = movePlayer(deepClone(currentGameState), localPlayerId, zoneId);
    if (result.error) { showNotification(result.error, 'warning'); return; }
    pushGameState(result.state);
  } else if (pendingAction?.type === 'ranged') {
    const weapon = WEAPONS[pendingAction.weapon];
    const action = pendingAction;
    pendingAction = null;
    setPendingAction(null);
    const result = performRangedAttack(deepClone(currentGameState), localPlayerId, action.weapon, zoneId);
    if (result.error) { showNotification(result.error, 'warning'); return; }
    if (result.rolls) {
      showDiceModal(`TIRO — ${weapon?.name || action.weapon}`, result.rolls, weapon?.accuracy || 4, () => {
        pushGameState(result.state);
      });
    } else {
      pushGameState(result.state);
    }
  }
}

async function pushGameState(state) {
  currentGameState = state;
  await set(ref(db, `rooms/${roomCode}/gameState`), state);
}

// ---- HELPERS ----

function getMeleeWeapon(player) {
  const meleeItems = (player.inventory || []).filter(id => {
    const w = WEAPONS[id];
    return w && w.dice && w.range && w.range[0] === 0 && w.range[1] === 0;
  });
  return player.equippedLeft && WEAPONS[player.equippedLeft]?.range?.[1] === 0
    ? player.equippedLeft
    : meleeItems[0] || null;
}

function getRangedWeapon(player) {
  const rangedItems = (player.inventory || []).filter(id => {
    const w = WEAPONS[id];
    return w && w.dice && w.range && (w.range[0] > 0 || w.range[1] > 0);
  });
  return player.equippedRight && WEAPONS[player.equippedRight]?.range?.[1] > 0
    ? player.equippedRight
    : rangedItems[0] || null;
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code + '-' + Math.floor(1000 + Math.random() * 9000);
}

function generatePlayerId() {
  return 'p' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
}

function showRulesModal() {
  showNotification('Acesse os documentos de regras na pasta do projeto!', '');
}
