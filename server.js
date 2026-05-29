/**
 * UNO Telegram Mini App — WebSocket Server
 * 
 * Запуск:
 *   npm install ws express
 *   node server.js
 * 
 * Для продакшна: деплой на Railway / Render / VPS
 */

const express = require('express');
const http    = require('http');
const { WebSocketServer, WebSocket } = require('ws');
const path    = require('path');

const app    = express();
const server = http.createServer(app);
const wss    = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname)));

// ── State ──────────────────────────────────────────────────────
const rooms = {}; 
// rooms[code] = { players:[{id,name,ws}], started, gs:{...gameState} }

// ── UNO Deck ───────────────────────────────────────────────────
const COLORS = ['red','blue','green','yellow'];
const VALUES = ['0','1','2','3','4','5','6','7','8','9','Skip','Reverse','+2'];

function makeDeck() {
  const deck = [];
  for (const c of COLORS)
    for (const v of VALUES) {
      deck.push({color:c,value:v});
      if (v!=='0') deck.push({color:c,value:v});
    }
  for (let i=0;i<4;i++) deck.push({color:'wild',value:'Wild'});
  for (let i=0;i<4;i++) deck.push({color:'wild',value:'+4'});
  return shuffle(deck);
}

function shuffle(a) {
  for (let i=a.length-1;i>0;i--) {
    const j=Math.floor(Math.random()*(i+1));
    [a[i],a[j]]=[a[j],a[i]];
  }
  return a;
}

function genCode() { return Math.random().toString(36).substr(2,4).toUpperCase(); }

// ── Broadcast helpers ──────────────────────────────────────────
function sendTo(ws, obj)         { if(ws.readyState===WebSocket.OPEN) ws.send(JSON.stringify(obj)); }
function broadcastRoom(code, obj) { rooms[code]?.players.forEach(p => sendTo(p.ws, obj)); }

// Send state to each player with only THEIR hand visible
function broadcastState(code) {
  const room = rooms[code];
  if (!room || !room.gs) return;
  const gs = room.gs;
  room.players.forEach(p => {
    sendTo(p.ws, {
      type: 'state',
      players: gs.players.map(pl => ({ id:pl.id, name:pl.name, cardCount: gs.hands[pl.id]?.length||0 })),
      myHand:  gs.hands[p.id] || [],
      topCard: gs.topCard,
      currentColor: gs.currentColor,
      currentPlayer: gs.currentPlayer,
      direction: gs.direction,
      winner: gs.winner || null,
      winnerName: gs.winnerName || null,
    });
  });
}

// ── WebSocket handler ──────────────────────────────────────────
wss.on('connection', ws => {
  ws.playerId   = null;
  ws.playerName = null;
  ws.roomCode   = null;

  ws.on('message', raw => {
    let msg;
    try { msg = JSON.parse(raw); } catch { return; }
    handlers[msg.type]?.(ws, msg);
  });

  ws.on('close', () => {
    const code = ws.roomCode;
    if (!code || !rooms[code]) return;
    rooms[code].players = rooms[code].players.filter(p => p.id !== ws.playerId);
    if (rooms[code].players.length === 0) { delete rooms[code]; return; }
    broadcastRoom(code, { type:'playerLeft', name: ws.playerName });
    broadcastRoom(code, { type:'lobbyUpdate', players: rooms[code].players.map(p=>({id:p.id,name:p.name,isHost:p.isHost})) });
  });
});

const handlers = {

  createRoom(ws, msg) {
    const code = genCode();
    rooms[code] = { players:[], started:false, gs:null };
    const player = { id:msg.playerId, name:msg.playerName, ws, isHost:true };
    rooms[code].players.push(player);
    ws.playerId = msg.playerId; ws.playerName = msg.playerName; ws.roomCode = code;
    sendTo(ws, { type:'roomCreated', code });
    sendTo(ws, { type:'lobbyUpdate', players:[{ id:msg.playerId, name:msg.playerName, isHost:true }] });
  },

  joinRoom(ws, msg) {
    const code = msg.code?.toUpperCase();
    if (!rooms[code])         return sendTo(ws, { type:'error', text:'Комната не найдена' });
    if (rooms[code].started)  return sendTo(ws, { type:'error', text:'Игра уже началась' });
    if (rooms[code].players.length >= 6) return sendTo(ws, { type:'error', text:'Комната заполнена' });

    const player = { id:msg.playerId, name:msg.playerName, ws, isHost:false };
    rooms[code].players.push(player);
    ws.playerId = msg.playerId; ws.playerName = msg.playerName; ws.roomCode = code;
    broadcastRoom(code, { type:'lobbyUpdate', players: rooms[code].players.map(p=>({id:p.id,name:p.name,isHost:p.isHost})) });
    sendTo(ws, { type:'joinedRoom', code });
  },

  startGame(ws, msg) {
    const code = ws.roomCode;
    const room = rooms[code];
    if (!room) return;
    if (!ws.isHost && room.players[0].id !== ws.playerId) return sendTo(ws, {type:'error',text:'Только хост может начать'});
    if (room.players.length < 2) return sendTo(ws, {type:'error',text:'Нужно минимум 2 игрока'});

    const deck = makeDeck();
    const hands = {};
    for (const p of room.players) hands[p.id] = deck.splice(0,7);
    let topCard;
    do { topCard = deck.shift(); } while (topCard.color==='wild');

    room.gs = {
      deck, hands, topCard,
      currentColor: topCard.color,
      currentPlayer: 0,
      direction: 1,
      players: room.players.map(p=>({id:p.id,name:p.name})),
    };
    room.started = true;
    broadcastRoom(code, { type:'gameStarted' });
    broadcastState(code);
  },

  playCard(ws, msg) {
    const code = ws.roomCode;
    const room = rooms[code];
    if (!room?.gs) return;
    const gs = room.gs;
    const pCount = gs.players.length;
    if (gs.players[gs.currentPlayer].id !== ws.playerId) return sendTo(ws,{type:'error',text:'Не ваш ход'});

    const hand = gs.hands[ws.playerId];
    const card = hand[msg.cardIndex];
    if (!card) return;

    if (!canPlay(card, gs)) return sendTo(ws,{type:'error',text:'Карту нельзя сыграть'});

    hand.splice(msg.cardIndex, 1);
    gs.topCard = card;
    gs.currentColor = msg.chosenColor || card.color;

    // Win check
    if (hand.length === 0) {
      gs.winner = ws.playerId; gs.winnerName = ws.playerName;
      broadcastState(code); return;
    }

    applyEffect(gs, card, pCount);
    broadcastState(code);
  },

  drawCard(ws, msg) {
    const code = ws.roomCode;
    const room = rooms[code];
    if (!room?.gs) return;
    const gs = room.gs;
    const pCount = gs.players.length;
    if (gs.players[gs.currentPlayer].id !== ws.playerId) return sendTo(ws,{type:'error',text:'Не ваш ход'});

    const card = gs.deck.shift();
    if (!card) return sendTo(ws,{type:'error',text:'Колода пуста'});
    gs.hands[ws.playerId].push(card);
    if (!canPlay(card, gs)) {
      gs.currentPlayer = (gs.currentPlayer + gs.direction + pCount) % pCount;
    }
    broadcastState(code);
  },
};

function canPlay(card, gs) {
  if (card.color==='wild') return true;
  return card.color===gs.currentColor || card.value===gs.topCard.value;
}

function applyEffect(gs, card, pCount) {
  let next = (gs.currentPlayer + gs.direction + pCount) % pCount;
  if (card.value==='Skip') {
    next = (next + gs.direction + pCount) % pCount;
  } else if (card.value==='Reverse') {
    gs.direction *= -1;
    next = (gs.currentPlayer + gs.direction + pCount) % pCount;
    if (pCount===2) next = gs.currentPlayer;
  } else if (card.value==='+2') {
    const vid = gs.players[next].id;
    gs.hands[vid].push(...gs.deck.splice(0,2));
    next = (next + gs.direction + pCount) % pCount;
  } else if (card.value==='+4') {
    const vid = gs.players[next].id;
    gs.hands[vid].push(...gs.deck.splice(0,4));
    next = (next + gs.direction + pCount) % pCount;
  }
  gs.currentPlayer = next;
}

// ── Start ──────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`UNO server running on port ${PORT}`));
