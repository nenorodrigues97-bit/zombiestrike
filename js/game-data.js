// ============================================================
// GAME DATA — ZombieStrike
// All game constants: characters, weapons, zombies, map
// ============================================================

export const CHARACTERS = {
  nick: {
    id: 'nick', name: 'NICK', role: 'SGT. de Infantaria', type: 'militar',
    archetype: 'Atirador', color: '#1a6fc4',
    baseActions: 3, maxWounds: 2,
    passive: 'Mira Treinada: +1 dado em distância 2+ zonas',
    equipment: ['rifle_adaptado', 'faca_caca'],
    skills: {
      blue:   { name: 'Supressão',       desc: '1x/turno: combate à distância grátis se zona sem zumbis' },
      yellow: { name: 'Rajada',           desc: 'Dual à distância pode atingir 2 zonas diferentes' },
      orange: { name: 'Ponto Cego',       desc: 'Ignora prioridade de alvo à distância' },
      red:    { name: 'Modo Francatirador', desc: '+2 alcance máximo em todas as armas à distância' }
    }
  },
  bilico: {
    id: 'bilico', name: 'BILICO', role: 'Operativo Especial', type: 'militar',
    archetype: 'Combatente', color: '#ff3a50',
    baseActions: 3, maxWounds: 2,
    passive: 'Corpo Forjado: absorve 1 ferimento/rodada se não moveu',
    equipment: ['machado_bombeiro', 'pistola_enferrujada'],
    skills: {
      blue:   { name: 'Avanço',        desc: 'Não gasta ações extras ao sair de zonas com zumbis' },
      yellow: { name: 'Golpe Devastador', desc: '2 ações: próximo hit +2 dano' },
      orange: { name: 'Escudo Humano',  desc: 'Aliados na mesma zona recebem -1 dano' },
      red:    { name: 'Berserker',      desc: 'Ao receber Ferido: +1 ação de C.C. grátis' }
    }
  },
  allastor: {
    id: 'allastor', name: 'ALLASTOR55', role: 'Técnico de Combate', type: 'militar',
    archetype: 'Engenheiro', color: '#e07520',
    baseActions: 3, maxWounds: 2,
    passive: 'Carrega 6 itens no inventário (padrão 5)',
    equipment: ['kit_ferramentas', 'pistola_enferrujada'],
    skills: {
      blue:   { name: 'Armadilha Improvisada', desc: '1x/turno: combina 2 itens em armadilha' },
      yellow: { name: 'Demolidor',        desc: 'Abre portas sem arma; pode atrasar revelação' },
      orange: { name: 'Campo Minado',     desc: 'Até 2 armadilhas ativas no mapa' },
      red:    { name: 'Detonação em Cadeia', desc: 'Explosão afeta zonas adjacentes também' }
    }
  },
  math: {
    id: 'math', name: 'MATH', role: 'Enfermeira de Emergência', type: 'civil',
    archetype: 'Médica', color: '#2a9a3a',
    baseActions: 3, maxWounds: 2,
    passive: 'Triagem: busca por itens médicos rende 1 carta bônus',
    equipment: ['kit_medico_avancado', 'bisturi'],
    skills: {
      blue:   { name: 'Primeiros Socorros', desc: '1x/turno: remove 1 Ferido de aliado (grátis)' },
      yellow: { name: 'Estabilizar',   desc: 'Impede eliminação iminente de aliado' },
      orange: { name: 'Adrenalina',    desc: '1x/missão: +2 ações para aliado no próximo turno' },
      red:    { name: 'Ressuscitar',   desc: '1x/missão: reativa sobrevivente eliminado' }
    }
  },
  felipinho: {
    id: 'felipinho', name: 'FELIPINHO', role: 'Ex-Atleta / Correio Urbano', type: 'civil',
    archetype: 'Sobrevivente', color: '#f5c518',
    baseActions: 3, maxWounds: 2,
    passive: 'Movimento Livre: +1 ação de movimento grátis por turno',
    equipment: ['crowbar', 'mochila_reforcada'],
    skills: {
      blue:   { name: 'Saqueador',    desc: '2 buscas por turno' },
      yellow: { name: 'Corrida Livre', desc: '+1 ação de movimento = 2 zonas; ignora penalidades de saída' },
      orange: { name: 'Isca Humana',  desc: '1x/turno: move tokens de ruído para zona adjacente' },
      red:    { name: 'Fantasma Urbano', desc: 'Não gera ruído ao mover; zumbis não priorizam' }
    }
  },
  solamentos: {
    id: 'solamentos', name: 'SOLAMENTOS', role: 'Ex-Analista Estratégico', type: 'civil',
    archetype: 'Estrategista', color: '#9a5aca',
    baseActions: 3, maxWounds: 2,
    passive: 'Análise Tática: revela tipo de zumbis do próximo spawn',
    equipment: ['radio_tatico', 'pistola_enferrujada'],
    skills: {
      blue:   { name: 'Coordenar',   desc: '1x/turno: +1 ação grátis para aliado em qualquer zona' },
      yellow: { name: 'Ponto Fraco', desc: '1x/turno: designa zumbi; próximo ataque +2 dados' },
      orange: { name: 'Evacuação',   desc: '1x/missão: move aliado 1 zona durante fase dos zumbis' },
      red:    { name: 'Modo Operação', desc: '1 rodada: todos +1 ação e +1 dado; Solamentos não age' }
    }
  },
  bigbi: {
    id: 'bigbi', name: 'BIGBI', role: 'Caçadora / Ex-Atirador Olímpico', type: 'civil',
    archetype: 'Furtiva', color: '#aaaaaa',
    baseActions: 3, maxWounds: 2,
    passive: 'Silêncio Total: nunca gera tokens de ruído',
    equipment: ['arco_composto', 'faca_caca'],
    skills: {
      blue:   { name: 'Tiro Certeiro',   desc: '1x/turno: re-rola dados de combate à distância' },
      yellow: { name: 'Alvo Prioritário', desc: 'Ignora regra de prioridade de alvos' },
      orange: { name: 'Tiro Penetrante', desc: 'Hit atravessa e atinge próximo zumbi na linha' },
      red:    { name: 'Fantasma',         desc: 'Após atacar: move 1 zona grátis' }
    }
  }
};

export const WEAPONS = {
  // CORPO A CORPO
  chave_inglesa:       { name: 'Chave Inglesa',    icon:'🔧', dice:2, accuracy:4, damage:1, range:[0,0], noise:false, tags:['door'] },
  machado_bombeiro:    { name: 'Machado',           icon:'🪓', dice:2, accuracy:3, damage:2, range:[0,0], noise:false, tags:['door','dual'] },
  facão:               { name: 'Facão',             icon:'🗡️', dice:3, accuracy:4, damage:1, range:[0,0], noise:false, tags:['dual'] },
  faca_caca:           { name: 'Faca de Caça',      icon:'🔪', dice:2, accuracy:4, damage:1, range:[0,0], noise:false, tags:[] },
  bisturi:             { name: 'Bisturi',           icon:'🩺', dice:1, accuracy:3, damage:1, range:[0,0], noise:false, tags:[] },
  crowbar:             { name: 'Crowbar',           icon:'🔩', dice:2, accuracy:4, damage:1, range:[0,0], noise:false, tags:['door'] },
  // DISTÂNCIA
  pistola_enferrujada: { name: 'Pistola',           icon:'🔫', dice:2, accuracy:4, damage:1, range:[0,1], noise:true,  tags:['dual'] },
  espingarda_serrada:  { name: 'Espingarda',        icon:'💥', dice:4, accuracy:4, damage:1, range:[0,1], noise:true,  tags:['reload'] },
  rifle_adaptado:      { name: 'Rifle',             icon:'🎯', dice:2, accuracy:3, damage:1, range:[1,3], noise:true,  tags:[] },
  arco_composto:       { name: 'Arco Composto',     icon:'🏹', dice:2, accuracy:3, damage:1, range:[1,2], noise:false, tags:[] },
  // ITENS
  kit_medico_avancado: { name: 'Kit Médico',        icon:'💉', type:'heal', effect:'remove2wounds', uses:1 },
  atadura_suja:        { name: 'Atadura',           icon:'🩹', type:'heal', effect:'remove1wound',  uses:1 },
  analgésicos:         { name: 'Analgésicos',       icon:'💊', type:'heal', effect:'blockNextWound', uses:1 },
  mochila_reforcada:   { name: 'Mochila',           icon:'🎒', type:'passive', effect:'extraSlot' },
  kit_ferramentas:     { name: 'Kit Ferramentas',   icon:'🔧', type:'tool', uses:3 },
  radio_tatico:        { name: 'Rádio Tático',      icon:'📻', type:'passive', effect:'exchange' },
  coquetel_molotov:    { name: 'Molotov',           icon:'🔥', type:'special', effect:'killAll', range:[0,2], uses:1 },
};

export const ZOMBIES = {
  walker: { id:'walker', name:'Arrastão', label:'W', actions:1, minDamage:1, xp:1, color:'#5a8a5a', special:'Horda: 5+ bloqueiam saída' },
  runner: { id:'runner', name:'Espasmo',  label:'R', actions:2, minDamage:1, xp:1, color:'#c8a820', special:'2 ações independentes por turno' },
  fatty:  { id:'fatty',  name:'Inchaço',  label:'F', actions:1, minDamage:2, xp:1, color:'#c86820', special:'Imune a dano 1; spawna com 2 Arrastões' },
  colosso:{ id:'colosso',name:'Colosso', label:'C', actions:1, minDamage:3, xp:5, color:'#ff1a35', special:'Único no tabuleiro; ataca todos na zona; destrói portas' },
};

// MISSION 01 — MAP ZONES
// Zone format: { id, name, type, x, y, w, h, spawnZone, isExit, isBuilding }
export const MISSION_01 = {
  name: 'SINAL DE SOCORRO',
  maxTurns: 10,
  players: [2, 7],
  difficulty: 'easy',

  // Initial survivor positions by character
  startZones: {
    nick: 'farmacia_1', bilico: 'farmacia_1',
    allastor: 'rua_central_s', felipinho: 'estacionamento',
    math: 'cruzamento', solamentos: 'rua_central_n',
    bigbi: 'entrada'
  },

  objectives: [
    { id:'reach_pharmacy',  text:'Chegar à farmácia',           type:'auto',   done:false },
    { id:'rescue_survivor', text:'Resgatar sobrevivente (2º andar)', type:'collect', zone:'farmacia_2', tokenId:'OBJ_A', done:false },
    { id:'supply_b1',       text:'Coletar suprimento B1',       type:'collect', zone:'farmacia_1',    tokenId:'OBJ_B1', done:false },
    { id:'supply_b2',       text:'Coletar suprimento B2',       type:'collect', zone:'edificio_leste',tokenId:'OBJ_B2', done:false },
    { id:'escape',          text:'Alcançar Zona de Saída',      type:'exit',   zone:'saida', done:false },
  ],

  zones: [
    // ZONA id, nome, tipo (road/building/grass/parking), linha/coluna no grid
    { id:'rua_oeste',       name:'Rua Oeste',       type:'road',     row:0, col:0, rows:3, cols:1 },
    { id:'spawn_norte',     name:'Spawn Norte',     type:'grass',    row:0, col:1, rows:2, cols:2, spawnId:'S1' },
    { id:'rua_norte',       name:'Rua Norte',       type:'road',     row:0, col:3, rows:1, cols:1 },
    { id:'saida',           name:'Saída',           type:'grass',    row:0, col:4, rows:2, cols:2, isExit:true },
    { id:'armazem',         name:'Armazém',         type:'building', row:0, col:6, rows:2, cols:1, spawnId:'S3' },
    { id:'farmacia_1',      name:'Farmácia 1º',     type:'building', row:1, col:1, rows:2, cols:2, hasDoor:true },
    { id:'farmacia_2',      name:'Farmácia 2º',     type:'building', row:1, col:3, rows:1, cols:1, hasDoor:true },
    { id:'cruzamento',      name:'Cruzamento',      type:'road',     row:1, col:4, rows:1, cols:1 },
    { id:'edificio_leste',  name:'Edifício Leste',  type:'building', row:1, col:5, rows:2, cols:2, hasDoor:true },
    { id:'rua_central_n',   name:'Rua Central',     type:'road',     row:2, col:3, rows:1, cols:1 },
    { id:'estacionamento',  name:'Estacionamento',  type:'parking',  row:2, col:4, rows:1, cols:1 },
    { id:'rua_central_s',   name:'Rua Central',     type:'road',     row:3, col:1, rows:1, cols:3 },
    { id:'spawn_sul',       name:'Spawn Sul',       type:'grass',    row:4, col:1, rows:1, cols:2, spawnId:'S2' },
    { id:'entrada',         name:'Entrada',         type:'road',     row:4, col:3, rows:1, cols:1 },
    { id:'hotel',           name:'Hotel',           type:'building', row:4, col:4, rows:1, cols:3 },
  ],

  // Adjacency: which zones connect to which
  adjacency: {
    rua_oeste:      ['spawn_norte', 'farmacia_1', 'rua_central_s', 'spawn_sul'],
    spawn_norte:    ['rua_oeste', 'farmacia_1', 'saida', 'rua_norte'],
    rua_norte:      ['spawn_norte', 'saida', 'farmacia_2', 'cruzamento'],
    saida:          ['rua_norte', 'spawn_norte', 'armazem', 'cruzamento', 'edificio_leste'],
    armazem:        ['saida', 'edificio_leste'],
    farmacia_1:     ['rua_oeste', 'spawn_norte', 'farmacia_2', 'rua_central_n', 'cruzamento'],
    farmacia_2:     ['farmacia_1', 'rua_norte', 'cruzamento'],
    cruzamento:     ['farmacia_1', 'farmacia_2', 'rua_norte', 'saida', 'rua_central_n', 'edificio_leste'],
    edificio_leste: ['saida', 'armazem', 'cruzamento', 'rua_central_n'],
    rua_central_n:  ['farmacia_1', 'cruzamento', 'edificio_leste', 'estacionamento', 'rua_central_s'],
    estacionamento: ['rua_central_n', 'cruzamento', 'rua_central_s'],
    rua_central_s:  ['rua_oeste', 'farmacia_1', 'rua_central_n', 'estacionamento', 'spawn_sul', 'entrada', 'hotel'],
    spawn_sul:      ['rua_oeste', 'rua_central_s', 'entrada'],
    entrada:        ['spawn_sul', 'rua_central_s', 'hotel'],
    hotel:          ['rua_central_s', 'entrada'],
  },

  // Initial zombie placement
  initialZombies: {
    farmacia_1:     [{ type:'walker' }],
    farmacia_2:     [{ type:'walker' }],
    spawn_norte:    [{ type:'walker' }, { type:'walker' }, { type:'walker' }],
    armazem:        [{ type:'walker' }],
    edificio_leste: [{ type:'runner' }, { type:'fatty' }, { type:'walker' }, { type:'walker' }],
    rua_oeste:      [{ type:'walker' }, { type:'walker' }],
    spawn_sul:      [{ type:'walker' }, { type:'walker' }, { type:'walker' }],
  },

  // Objective tokens initial positions
  tokens: {
    OBJ_A:  { zone:'farmacia_2',    type:'objective', label:'🎯' },
    OBJ_B1: { zone:'farmacia_1',    type:'objective', label:'📦' },
    OBJ_B2: { zone:'edificio_leste',type:'objective', label:'📦' },
  },

  // Spawn rules per danger level
  spawnRules: {
    blue:   { S1:[{type:'walker',qty:1}], S2:[{type:'walker',qty:1}], S3:[{type:'walker',qty:1}] },
    yellow: { S1:[{type:'walker',qty:2}], S2:[{type:'walker',qty:1},{type:'runner',qty:1}], S3:[{type:'walker',qty:2}] },
    orange: { S1:[{type:'walker',qty:3}], S2:[{type:'walker',qty:2},{type:'runner',qty:1}], S3:[{type:'walker',qty:2},{type:'fatty',qty:1}] },
    red:    { S1:[{type:'walker',qty:4},{type:'runner',qty:1}], S2:[{type:'walker',qty:3},{type:'fatty',qty:1}], S3:[{type:'walker',qty:3},{type:'runner',qty:2}] },
  },

  // Special events
  events: [
    { trigger:'door_open', zone:'farmacia_1', effect:'noise+2', message:'Alarme antifurto disparou! +2 ruído na farmácia' },
    { trigger:'rescue',    zone:'farmacia_2', effect:'spawn_s1+3', message:'EVENTO: 3 Arrastões surgem na Entrada Sul!' },
    { trigger:'turn',      turn:8,           effect:'noise_all+1', message:'ALERTA: Tensão aumenta! Todos os tokens de ruído +1' },
  ],

  // XP danger thresholds
  dangerLevels: { blue:0, yellow:7, orange:19, red:43 },
};

// DANGER LEVEL CONFIG
export const LEVEL_NAMES = ['blue','yellow','orange','red'];
export const LEVEL_COLORS = { blue:'#1a6fc4', yellow:'#f5c518', orange:'#e07520', red:'#ff1a35' };
export const LEVEL_XP = { blue:0, yellow:7, orange:19, red:43 };
export const LEVEL_ACTIONS = { blue:3, yellow:4, orange:4, red:4 };
