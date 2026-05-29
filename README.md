# 🎴 UNO для Telegram — Полная инструкция запуска

## Что вы получаете

Полноценная игра УНО прямо в Telegram:
- До 6 игроков онлайн
- Все правила УНО (Skip, Reverse, +2, Wild, +4)
- Инвайт-ссылки прямо из Telegram
- Работает на телефоне

---

## Шаг 1 — Создать Telegram бота

1. Открыть [@BotFather](https://t.me/BotFather) в Telegram
2. Отправить `/newbot`
3. Придумать имя (например: `UNO Party Bot`)
4. Придумать username (например: `unoparty_bot`)
5. Сохранить токен: `7123456789:AAF...` (он понадобится)

---

## Шаг 2 — Деплой сервера (бесплатно на Railway)

### Вариант A: Railway (рекомендуется, бесплатно)

1. Зарегистрироваться на [railway.app](https://railway.app)
2. Нажать **New Project → Deploy from GitHub**
3. Загрузить папку с файлами (`index.html`, `server.js`, `package.json`)
4. Railway автоматически запустит сервер
5. В Settings → Domains → **Generate Domain** → получите URL типа `https://uno-xxx.railway.app`

### Вариант B: Render (тоже бесплатно)

1. Зарегистрироваться на [render.com](https://render.com)
2. New → Web Service → подключить GitHub
3. Build Command: `npm install`
4. Start Command: `node server.js`
5. Получите URL вида `https://uno-xxx.onrender.com`

### package.json (нужно создать рядом с server.js):

```json
{
  "name": "uno-telegram",
  "version": "1.0.0",
  "main": "server.js",
  "scripts": { "start": "node server.js" },
  "dependencies": { "ws": "^8.0.0", "express": "^4.18.0" }
}
```

---

## Шаг 3 — Подключить Mini App к боту

1. В [@BotFather](https://t.me/BotFather) отправить `/newapp`
2. Выбрать вашего бота
3. Ввести URL вашего сервера: `https://uno-xxx.railway.app`
4. BotFather даст ссылку: `https://t.me/unoparty_bot/game`

---

## Шаг 4 — Обновить index.html

В файле `index.html` найти строку:
```js
const botUrl = `https://t.me/YOUR_BOT_USERNAME?startapp=room_${code}`;
```
Заменить `YOUR_BOT_USERNAME` на username вашего бота:
```js
const botUrl = `https://t.me/unoparty_bot?startapp=room_${code}`;
```

Также подключить WebSocket вместо localStorage (для реального мультиплеера):
В конце `<script>` в index.html добавить/заменить подключение к серверу.

---

## Шаг 5 — Добавить кнопку в бота (опционально)

В [@BotFather](https://t.me/BotFather):
```
/setmenubutton
```
Выбрать бота → ввести URL → текст кнопки: `🎴 Играть в UNO`

---

## Как играть

1. Открыть бота в Telegram
2. Нажать кнопку **Играть** или отправить `/start`
3. Нажать **Создать игру** — получить код
4. Нажать **Поделиться** — друзья получат инвайт-ссылку
5. Когда все зашли — нажать **Начать**

---

## Режим demo (без сервера)

Файл `index.html` уже работает через `localStorage` — это значит:
- Можно тестировать на ОДНОМ устройстве (открыть в нескольких вкладках)
- Для настоящего мультиплеера между разными устройствами нужен сервер (Шаг 2)

---

## Структура файлов

```
uno-telegram/
├── index.html   ← Вся игра (фронтенд)
├── server.js    ← WebSocket сервер (мультиплеер)
├── package.json ← Зависимости Node.js
└── README.md    ← Эта инструкция
```

---

## Технологии

| Компонент | Технология |
|-----------|-----------|
| Фронтенд | HTML + CSS + Vanilla JS |
| Бэкенд | Node.js + WebSocket (ws) |
| Хостинг | Railway / Render (бесплатно) |
| Интеграция | Telegram Web App API |

---

## Правила УНО в игре

- ✅ Числа 0-9
- ✅ Skip (пропустить ход)
- ✅ Reverse (изменить порядок)
- ✅ +2 (следующий берёт 2 карты)
- ✅ Wild (смена цвета)
- ✅ Wild +4 (смена цвета + 4 карты)
- ✅ Кнопка UNO! (нажать когда 1 карта)
