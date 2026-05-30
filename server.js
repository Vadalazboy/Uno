const express = require('express');
const path    = require('path');
const app     = express();

app.use(express.json());
app.use(express.static(path.join(__dirname)));

// In-memory хранилище комнат
const rooms = {};

// Очистка старых комнат (старше 2 часов)
setInterval(() => {
  const now = Date.now();
  for (const code in rooms) {
    if (now - rooms[code].created > 2 * 60 * 60 * 1000) delete rooms[code];
  }
}, 10 * 60 * 1000);

// ── API ───────────────────────────────────────────────────────

// Получить комнату
app.get('/room/:code', (req, res) => {
  const room = rooms[req.params.code.toUpperCase()];
  if (!room) return res.status(404).json({ error: 'not found' });
  res.json(room);
});

// Сохранить комнату
app.post('/room/:code', (req, res) => {
  const code = req.params.code.toUpperCase();
  rooms[code] = { ...req.body, created: rooms[code]?.created || Date.now() };
  res.json({ ok: true });
});

// Ping
app.get('/ping', (_, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('UNO server on port', PORT));