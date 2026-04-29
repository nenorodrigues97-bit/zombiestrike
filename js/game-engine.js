// ============================================================
// GAME ENGINE — ZombieStrike
// All game logic: turns, combat, spawning, objectives
// ============================================================

import { CHARACTERS, WEAPONS, ZOMBIES, MISSION_01, LEVEL_NAMES, LEVEL_XP, LEVEL_ACTIONS } from './game-data.js';

// ---- STATE HELPERS ----

export function createInitialGameState(players) {
  const state = {
    phase: 'players',       // 'players' | 'zombies' | 'end'
    turn: 1,
    maxTurns: MISSION_01.maxTurns,
    turnOrder: [],          // array of player IDs in turn order
    activePlayer: null,     // current player's ID
    winner: null,           // null | 'survivors' | 'zombies'
    players: {},
    zombies: {},
    tokens: JSON.parse(JSON.stringify(MISSION_01.tokens)),
    noise: {},
    objectives: MISSION_01.objectives.map(o => ({ ...o })),
    log: [],
    spawnZones: { S1:'spawn_norte', S2:'spawn_sul', S3:'armazem' },
    nextZombieId: 1,
  };

  // Init players
  for (const [pid, p] of Object.entries(players)) {
    const char = CHARACTERS[p.character];
    const startZone = MISSION_01.startZones[p.character] || 'entrada';
    state.players[pid] = {
      id: pid,
      name: p.name,
      character: p.character,
      zone: startZone,
      xp: 0,
      dangerLevel: 'blue',
      actionsLeft: LEVEL_ACTIONS.blue,
      maxActions: LEVEL_ACTIONS.blue,
      wounds: 0,
      maxWounds: char.maxWounds,
      eliminated: false,
      inventory: [...char.equipment],
      equippedLeft:  char.equipment[0] || null,
      equippedRight: char.equipment[1] || null,
      isHost: p.isHost || false,
      connected: true,
    };
  }

  // Init zombies from mission
  let zombieId = 1;
  for (const [zone, zombieList] of Object.entries(MISSION_01.initialZombies)) {
    for (const z of zombieList) {
      state.zombies[`z${zombieId}`] = { type: z.type, zone, id: `z${zombieId}` };
      zombieId++;
    }
  }
  state.nextZombieId = zombieId;

  // Init noise
  for (const zone of MISSION_01.zones) {
    state.noise[zone.id] = 0;
  }
  // Survivors count as noise tokens in their zone
  for (const p of Object.values(state.players)) {
    state.noise[p.zone] = (state.noise[p.zone] || 0) + 1;
  }

  // Turn order (alphabetical by name for fairness)
  state.turnOrder = Object.keys(state.players).sort();
  state.activePlayer = state.turnOrder[0];

  // Set first active player actions
  resetPlayerActions(state, state.activePlayer);

  return state;
}

// ---- TURN MANAGEMENT ----

export function endPlayerTurn(state, playerId) {
  if (state.phase !== 'players') return { state, error: 'Not player phase' };
  if (state.activePlayer !== playerId) return { state, error: 'Not your turn' };

  const newState = deepClone(state);
  addLog(newState, `${getPlayerName(newState, playerId)} encerrou o turno.`, 'info');

  // Move to next player
  const idx = newState.turnOrder.indexOf(playerId);
  const nextIdx = idx + 1;

  if (nextIdx >= newState.turnOrder.length) {
    // All players done — start zombie phase
    return startZombiePhase(newState);
  } else {
    const nextPlayer = newState.turnOrder[nextIdx];
    // Skip eliminated players
    if (newState.players[nextPlayer]?.eliminated) {
      newState.activePlayer = nextPlayer;
      return endPlayerTurn(newState, nextPlayer);
    }
    newState.activePlayer = nextPlayer;
    resetPlayerActions(newState, nextPlayer);
    addLog(newState, `VEZ DE ${getPlayerName(newState, nextPlayer).toUpperCase()}`, 'info');
    return { state: newState };
  }
}

export function startZombiePhase(state) {
  const newState = deepClone(state);
  newState.phase = 'zombies';
  addLog(newState, '— FASE DOS ZUMBIS —', 'warn');

  // Process zombie actions
  processZombieActions(newState);

  // Spawn new zombies
  spawnZombies(newState);

  // Process events
  processEvents(newState);

  // Check defeat
  const alive = Object.values(newState.players).filter(p => !p.eliminated);
  if (alive.length === 0) {
    newState.winner = 'zombies';
    newState.phase = 'end';
    addLog(newState, '💀 TODOS OS SOBREVIVENTES FORAM ELIMINADOS!', 'hit');
    return { state: newState };
  }

  // Check turn limit
  if (newState.turn >= newState.maxTurns) {
    newState.winner = 'zombies';
    newState.phase = 'end';
    addLog(newState, `⏰ TURNO ${newState.maxTurns} ATINGIDO — DERROTA!`, 'hit');
    return { state: newState };
  }

  // Next turn
  return endTurn(newState);
}

function endTurn(state) {
  state.turn++;
  state.phase = 'players';

  // Remove noise tokens (except survivor noise)
  for (const zoneId of Object.keys(state.noise)) {
    state.noise[zoneId] = 0;
  }
  // Re-add survivor noise
  for (const p of Object.values(state.players)) {
    if (!p.eliminated && p.character !== 'bigbi') {
      state.noise[p.zone] = (state.noise[p.zone] || 0) + 1;
    }
  }

  // Reset turn order to first alive player
  const firstAlive = state.turnOrder.find(pid => !state.players[pid]?.eliminated);
  state.activePlayer = firstAlive || null;
  if (firstAlive) {
    resetPlayerActions(state, firstAlive);
    addLog(state, `— TURNO ${state.turn} —`, 'info');
    addLog(state, `VEZ DE ${getPlayerName(state, firstAlive).toUpperCase()}`, 'info');
  }

  return { state };
}

// ---- PLAYER ACTIONS ----

export function movePlayer(state, playerId, targetZone) {
  const newState = deepClone(state);
  const player = newState.players[playerId];
  if (!player || player.eliminated) return { state, error: 'Player not available' };
  if (newState.activePlayer !== playerId) return { state, error: 'Not your turn' };
  if (newState.phase !== 'players') return { state, error: 'Not player phase' };
  if (player.zone === targetZone) return { state, error: 'Já está nessa zona' };

  // Find shortest-cost path via Dijkstra
  const path = findPath(newState, player.zone, targetZone, player);
  if (!path) return { state, error: 'Zona inacessível' };

  // Calculate total action cost along the path
  let totalCost = 0;
  let cur = player.zone;
  for (const next of path) {
    const zombiesHere = Object.values(newState.zombies).filter(z => z.zone === cur).length;
    const stepCost = (player.character === 'bilico' || player.character === 'felipinho')
      ? 1 : 1 + zombiesHere;
    totalCost += stepCost;
    cur = next;
  }

  if (player.actionsLeft < totalCost) {
    return { state, error: `Precisa de ${totalCost} ações para chegar (você tem ${player.actionsLeft})` };
  }

  const oldZone = player.zone;
  player.zone = targetZone;
  player.actionsLeft -= totalCost;

  if (player.character !== 'bigbi' && player.character !== 'felipinho') {
    newState.noise[oldZone] = Math.max(0, (newState.noise[oldZone] || 0) - 1);
    newState.noise[targetZone] = (newState.noise[targetZone] || 0) + 1;
  }

  const steps = path.length > 1 ? ` (${path.length} zonas, ${totalCost} ações)` : '';
  addLog(newState, `${getPlayerName(newState, playerId)} moveu para <strong>${getZoneName(targetZone)}</strong>${steps}`, 'info');
  checkAutoObjectives(newState, playerId);

  return { state: newState };
}

function findPath(state, from, to, player) {
  const zombiesByZone = {};
  for (const z of Object.values(state.zombies)) {
    zombiesByZone[z.zone] = (zombiesByZone[z.zone] || 0) + 1;
  }

  const costs = { [from]: 0 };
  const prev  = {};
  const queue = [{ zone: from, cost: 0 }];

  while (queue.length > 0) {
    queue.sort((a, b) => a.cost - b.cost);
    const { zone, cost } = queue.shift();
    if (zone === to) {
      const path = [];
      let cur = to;
      while (cur !== from) { path.unshift(cur); cur = prev[cur]; }
      return path;
    }
    const zombiesHere = zombiesByZone[zone] || 0;
    const exitCost = (player.character === 'bilico' || player.character === 'felipinho')
      ? 1 : 1 + zombiesHere;
    for (const next of (MISSION_01.adjacency[zone] || [])) {
      const newCost = cost + exitCost;
      if (costs[next] === undefined || newCost < costs[next]) {
        costs[next] = newCost;
        prev[next]  = zone;
        queue.push({ zone: next, cost: newCost });
      }
    }
  }
  return null;
}

export function performMeleeAttack(state, playerId, weaponId) {
  const newState = deepClone(state);
  const player = newState.players[playerId];
  if (!player || player.actionsLeft < 1) return { state, error: 'Sem ações' };
  if (newState.activePlayer !== playerId) return { state, error: 'Not your turn' };

  const weapon = WEAPONS[weaponId];
  if (!weapon || weapon.range?.[0] > 0) return { state, error: 'Arma não é corpo a corpo' };

  const zombiesInZone = Object.entries(newState.zombies).filter(([,z]) => z.zone === player.zone);
  if (zombiesInZone.length === 0) return { state, error: 'Sem zumbis na zona' };

  player.actionsLeft--;

  // Roll dice
  const rolls = rollDice(weapon.dice);
  const hits = rolls.filter(r => r >= weapon.accuracy).length;

  addLog(newState, `${getPlayerName(newState, playerId)} atacou com <strong>${weapon.name}</strong> — rolou [${rolls.join(',')}] — <span class="hit">${hits} hit(s)</span>`, 'info');

  // Apply damage to zombies (priority: walkers first for melee)
  let remainingHits = hits;
  const killed = [];

  for (const [zid, z] of zombiesInZone) {
    if (remainingHits <= 0) break;
    const zdata = ZOMBIES[z.type];
    if (!zdata) continue;
    if (weapon.damage >= zdata.minDamage) {
      delete newState.zombies[zid];
      killed.push(z);
      remainingHits -= zdata.minDamage;
      // Give XP
      awardXP(newState, playerId, zdata.xp);
      addLog(newState, `<span class="success">${zdata.name} eliminado! +${zdata.xp} XP</span>`, 'info');
    }
  }

  if (killed.length === 0 && hits > 0) {
    addLog(newState, 'Dano insuficiente para eliminar.', 'warn');
  }

  return { state: newState, rolls, hits, killed };
}

export function performRangedAttack(state, playerId, weaponId, targetZone) {
  const newState = deepClone(state);
  const player = newState.players[playerId];
  if (!player || player.actionsLeft < 1) return { state, error: 'Sem ações' };
  if (newState.activePlayer !== playerId) return { state, error: 'Not your turn' };

  const weapon = WEAPONS[weaponId];
  if (!weapon || !weapon.range || weapon.range[0] === 0 && weapon.range[1] === 0) return { state, error: 'Arma não é à distância' };

  // Add noise
  if (weapon.noise) {
    newState.noise[player.zone] = (newState.noise[player.zone] || 0) + 1;
  }

  player.actionsLeft--;

  const rolls = rollDice(weapon.dice);
  const hits = rolls.filter(r => r >= weapon.accuracy).length;

  addLog(newState, `${getPlayerName(newState, playerId)} atirou com <strong>${weapon.name}</strong> em <strong>${getZoneName(targetZone)}</strong> — [${rolls.join(',')}] — <span class="hit">${hits} hit(s)</span>`, 'info');

  // Apply damage with target priority: walkers > fatty > colosso > runners
  const zombiesInTarget = Object.entries(newState.zombies)
    .filter(([,z]) => z.zone === targetZone)
    .sort(([,a],[,b]) => {
      const priority = { walker:0, fatty:1, colosso:2, runner:3 };
      return (priority[a.type]||0) - (priority[b.type]||0);
    });

  let remainingHits = hits;
  const killed = [];

  for (const [zid, z] of zombiesInTarget) {
    if (remainingHits <= 0) break;
    const zdata = ZOMBIES[z.type];
    if (!zdata) continue;
    if (weapon.damage >= zdata.minDamage && remainingHits >= zdata.minDamage) {
      delete newState.zombies[zid];
      killed.push(z);
      remainingHits -= zdata.minDamage;
      awardXP(newState, playerId, zdata.xp);
      addLog(newState, `<span class="success">${zdata.name} eliminado! +${zdata.xp} XP</span>`, 'info');
    } else {
      remainingHits = 0;
    }
  }

  // Check friendly fire (survivors in target zone)
  for (const [pid, p] of Object.entries(newState.players)) {
    if (p.zone === targetZone && pid !== playerId && !p.eliminated) {
      p.wounds++;
      addLog(newState, `<span class="hit">⚠ FOGO AMIGO! ${getPlayerName(newState, pid)} recebeu 1 ferimento!</span>`, 'warn');
      checkElimination(newState, pid);
    }
  }

  return { state: newState, rolls, hits, killed };
}

export function searchZone(state, playerId) {
  const newState = deepClone(state);
  const player = newState.players[playerId];
  if (!player || player.actionsLeft < 1) return { state, error: 'Sem ações' };
  if (newState.activePlayer !== playerId) return { state, error: 'Not your turn' };

  // Check no zombies in zone
  const zombiesInZone = Object.values(newState.zombies).filter(z => z.zone === player.zone);
  if (zombiesInZone.length > 0) return { state, error: 'Impossível buscar com zumbis na zona!' };

  player.actionsLeft--;

  // Loot table — random item
  const lootTable = [
    'chave_inglesa','facão','pistola_enferrujada','atadura_suja',
    'analgésicos','kit_medico_avancado','espingarda_serrada',
    'coquetel_molotov','kit_ferramentas'
  ];

  const item = lootTable[Math.floor(Math.random() * lootTable.length)];
  const itemData = WEAPONS[item];

  if (player.inventory.length < 5) {
    player.inventory.push(item);
    addLog(newState, `${getPlayerName(newState, playerId)} buscou e encontrou: <strong>${itemData?.name || item}</strong>`, 'success');
  } else {
    addLog(newState, `${getPlayerName(newState, playerId)} encontrou ${itemData?.name || item} mas inventário está cheio!`, 'warn');
  }

  return { state: newState, item };
}

export function collectObjective(state, playerId, tokenId) {
  const newState = deepClone(state);
  const player = newState.players[playerId];
  if (!player || player.actionsLeft < 1) return { state, error: 'Sem ações' };
  if (newState.activePlayer !== playerId) return { state, error: 'Not your turn' };

  const token = newState.tokens[tokenId];
  if (!token) return { state, error: 'Token não encontrado' };
  if (token.zone !== player.zone) return { state, error: 'Não está na zona do objetivo' };
  if (token.collected) return { state, error: 'Já coletado' };

  player.actionsLeft--;
  token.collected = true;
  token.collectedBy = playerId;

  addLog(newState, `<span class="success">🎯 ${getPlayerName(newState, playerId)} coletou objetivo ${tokenId}!</span>`, 'info');

  // Update objective status
  for (const obj of newState.objectives) {
    if (obj.tokenId === tokenId) {
      obj.done = true;
      addLog(newState, `<span class="success">✓ OBJETIVO CONCLUÍDO: ${obj.text}</span>`, 'success');
    }
  }

  // Check special event for rescue
  for (const event of MISSION_01.events) {
    if (event.trigger === 'rescue' && tokenId === 'OBJ_A') {
      triggerEvent(newState, event);
    }
  }

  // Check victory
  checkVictory(newState);

  return { state: newState };
}

export function useHealItem(state, playerId, itemId, targetPlayerId) {
  const newState = deepClone(state);
  const player = newState.players[playerId];
  if (!player || player.actionsLeft < 1) return { state, error: 'Sem ações' };

  const item = WEAPONS[itemId];
  if (!item || item.type !== 'heal') return { state, error: 'Item não é de cura' };

  const target = newState.players[targetPlayerId || playerId];
  if (!target) return { state, error: 'Alvo não encontrado' };

  player.actionsLeft--;
  player.inventory = player.inventory.filter((it, i) => {
    if (it === itemId) { itemId = null; return false; }
    return true;
  });

  if (item.effect === 'remove2wounds') {
    const healed = Math.min(target.wounds, 2);
    target.wounds -= healed;
    addLog(newState, `${getPlayerName(newState, playerId)} curou ${healed} ferimento(s) de ${getPlayerName(newState, targetPlayerId||playerId)}`, 'success');
  } else if (item.effect === 'remove1wound') {
    if (target.wounds > 0) { target.wounds--; }
    addLog(newState, `${getPlayerName(newState, playerId)} removeu 1 ferimento de ${getPlayerName(newState, targetPlayerId||playerId)}`, 'success');
  }

  return { state: newState };
}

// ---- ZOMBIE AI ----

function processZombieActions(state) {
  const zombieIds = Object.keys(state.zombies);

  for (const zid of zombieIds) {
    const zombie = state.zombies[zid];
    if (!zombie) continue;
    const zdata = ZOMBIES[zombie.type];
    if (!zdata) continue;

    const actions = zdata.actions;
    for (let a = 0; a < actions; a++) {
      if (!state.zombies[zid]) break;
      zombieAct(state, zid);
    }
  }
}

function zombieAct(state, zid) {
  const zombie = state.zombies[zid];
  if (!zombie) return;

  // Priority 1: Attack survivor in same zone
  const survivorsInZone = Object.entries(state.players).filter(([,p]) => p.zone === zombie.zone && !p.eliminated);
  if (survivorsInZone.length > 0) {
    // Attack: always hits — remove equipped item first, then wounds
    const target = survivorsInZone[0];
    const targetPlayer = target[1];
    const targetId = target[0];

    if (targetPlayer.equippedLeft || targetPlayer.equippedRight) {
      // Destroy equipped item
      if (targetPlayer.equippedLeft) {
        addLog(state, `🧟 ${ZOMBIES[zombie.type].name} atacou ${getPlayerName(state, targetId)} — item <strong>${WEAPONS[targetPlayer.equippedLeft]?.name || targetPlayer.equippedLeft}</strong> destruído!`, 'hit');
        targetPlayer.inventory = targetPlayer.inventory.filter(i => i !== targetPlayer.equippedLeft);
        targetPlayer.equippedLeft = targetPlayer.inventory[0] || null;
      } else {
        addLog(state, `🧟 ${ZOMBIES[zombie.type].name} atacou ${getPlayerName(state, targetId)} — item destruído!`, 'hit');
        targetPlayer.inventory = targetPlayer.inventory.filter(i => i !== targetPlayer.equippedRight);
        targetPlayer.equippedRight = targetPlayer.inventory[0] || null;
      }
    } else {
      // Direct wound
      targetPlayer.wounds++;
      addLog(state, `<span class="hit">🧟 ${ZOMBIES[zombie.type].name} feriu ${getPlayerName(state, targetId)}! (${targetPlayer.wounds}/${targetPlayer.maxWounds})</span>`, 'hit');
      checkElimination(state, targetId);
    }
    return;
  }

  // Priority 2: Move toward loudest zone in line of sight
  const adj = MISSION_01.adjacency[zombie.zone] || [];
  if (adj.length === 0) return;

  // Find zone with most noise OR survivors
  let bestZone = null, bestScore = -1;

  for (const z of adj) {
    const survivors = Object.values(state.players).filter(p => p.zone === z && !p.eliminated).length;
    const noise = state.noise[z] || 0;
    const score = survivors * 10 + noise;
    if (score > bestScore) { bestScore = score; bestZone = z; }
  }

  // Colosso ignores noise — goes for nearest survivor
  if (zombie.type === 'colosso') {
    const survZones = Object.values(state.players).filter(p => !p.eliminated).map(p => p.zone);
    for (const z of adj) {
      if (survZones.includes(z)) { bestZone = z; break; }
    }
  }

  if (bestZone && bestScore > 0) {
    zombie.zone = bestZone;
  } else if (adj.length > 0) {
    zombie.zone = adj[Math.floor(Math.random() * adj.length)];
  }
}

// ---- SPAWNING ----

function spawnZombies(state) {
  const dangerLevel = getHighestDangerLevel(state);
  const rules = MISSION_01.spawnRules[dangerLevel];

  for (const [spawnId, spawnList] of Object.entries(rules)) {
    const zoneId = state.spawnZones[spawnId];
    if (!zoneId) continue;

    for (const rule of spawnList) {
      for (let i = 0; i < rule.qty; i++) {
        // Handle fatty escort
        if (rule.type === 'fatty') {
          spawnZombie(state, 'fatty', zoneId);
          spawnZombie(state, 'walker', zoneId);
          spawnZombie(state, 'walker', zoneId);
        } else {
          spawnZombie(state, rule.type, zoneId);
        }
      }
    }
    addLog(state, `Spawn ${spawnId}: novos zumbis em ${getZoneName(zoneId)}`, 'warn');
  }
}

function spawnZombie(state, type, zone) {
  // Colosso: max 1 on board
  if (type === 'colosso') {
    const existing = Object.values(state.zombies).find(z => z.type === 'colosso');
    if (existing) return;
  }
  const id = `z${state.nextZombieId++}`;
  state.zombies[id] = { id, type, zone };
}

// ---- XP & LEVELS ----

function awardXP(state, playerId, amount) {
  const player = state.players[playerId];
  if (!player) return;
  player.xp += amount;

  // Check level up
  const levels = ['blue','yellow','orange','red'];
  for (let i = levels.length - 1; i >= 0; i--) {
    if (player.xp >= LEVEL_XP[levels[i]]) {
      if (player.dangerLevel !== levels[i]) {
        player.dangerLevel = levels[i];
        player.maxActions = LEVEL_ACTIONS[levels[i]];
        addLog(state, `⬆️ ${getPlayerName(state, playerId)} subiu para nível <strong>${levels[i].toUpperCase()}</strong>!`, 'success');
      }
      break;
    }
  }
}

// ---- OBJECTIVE & VICTORY ----

function checkAutoObjectives(state, playerId) {
  const player = state.players[playerId];

  // Reached pharmacy
  if (player.zone === 'farmacia_1' || player.zone === 'farmacia_2') {
    const obj = state.objectives.find(o => o.id === 'reach_pharmacy');
    if (obj && !obj.done) {
      obj.done = true;
      addLog(state, `<span class="success">✓ OBJETIVO: Chegou à farmácia!</span>`, 'success');
      // Door event
      const event = MISSION_01.events.find(e => e.trigger === 'door_open');
      if (event) triggerEvent(state, event);
    }
  }

  // Escape zone
  if (player.zone === 'saida') {
    const obj = state.objectives.find(o => o.id === 'escape');
    if (obj && !obj.done) {
      // Check all main objectives done
      const mainDone = state.objectives.filter(o => o.id !== 'escape').every(o => o.done);
      if (mainDone) {
        obj.done = true;
        checkVictory(state);
      }
    }
  }
}

function checkVictory(state) {
  const allDone = state.objectives.every(o => o.done);
  if (allDone) {
    state.winner = 'survivors';
    state.phase = 'end';
    addLog(state, '🎉 VITÓRIA! TODOS OS OBJETIVOS CONCLUÍDOS!', 'success');
  }
}

function checkElimination(state, playerId) {
  const player = state.players[playerId];
  if (!player) return;
  if (player.wounds >= player.maxWounds) {
    player.eliminated = true;
    addLog(state, `💀 ${getPlayerName(state, playerId)} foi ELIMINADO!`, 'hit');
    // Remove from turn order active tracking
    if (state.activePlayer === playerId) {
      // Will be handled in next endPlayerTurn
    }
  }
}

function processEvents(state) {
  for (const event of MISSION_01.events) {
    if (event.trigger === 'turn' && event.turn === state.turn) {
      triggerEvent(state, event);
    }
  }
}

function triggerEvent(state, event) {
  addLog(state, `⚡ EVENTO: ${event.message}`, 'warn');
  if (event.effect === 'noise+2') {
    const zone = event.zone;
    state.noise[zone] = (state.noise[zone] || 0) + 2;
  } else if (event.effect === 'noise_all+1') {
    for (const z of Object.keys(state.noise)) {
      state.noise[z]++;
    }
  } else if (event.effect?.startsWith('spawn_')) {
    const [, rest] = event.effect.split('spawn_');
    const [spawnId, qtyStr] = rest.split('+');
    const qty = parseInt(qtyStr);
    const zoneId = state.spawnZones[spawnId.toUpperCase()] || 'spawn_sul';
    for (let i = 0; i < qty; i++) {
      spawnZombie(state, 'walker', zoneId);
    }
  }
}

// ---- HELPERS ----

function rollDice(count) {
  return Array.from({ length: count }, () => Math.floor(Math.random() * 6) + 1);
}

function resetPlayerActions(state, playerId) {
  const player = state.players[playerId];
  if (!player) return;
  player.actionsLeft = player.maxActions || LEVEL_ACTIONS[player.dangerLevel] || 3;
  // Felipinho bonus action
  if (player.character === 'felipinho') player.actionsLeft++;
}

function getHighestDangerLevel(state) {
  let highest = 'blue';
  const order = ['blue','yellow','orange','red'];
  for (const p of Object.values(state.players)) {
    if (!p.eliminated) {
      const idx = order.indexOf(p.dangerLevel);
      if (idx > order.indexOf(highest)) highest = p.dangerLevel;
    }
  }
  return highest;
}

function getPlayerName(state, playerId) {
  return state.players[playerId]?.name || playerId;
}

function getZoneName(zoneId) {
  return MISSION_01.zones.find(z => z.id === zoneId)?.name || zoneId;
}

function addLog(state, message, type = 'info') {
  state.log.unshift({ turn: state.turn, message, type, ts: Date.now() });
  if (state.log.length > 50) state.log.pop();
}

function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export { rollDice, getZoneName, deepClone };
