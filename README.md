# Workspace — кастомный Zulip-клиент

Монорепозиторий (Lerna): фронтенд `web` и опциональный `mock-server`.

## Запуск для разработки (без mock-server)

### Требования

- Node.js 18+
- npm или yarn

### 1. Установка зависимостей

Из корня репозитория:

```bash
npm install
npm run bootstrap
```

### 2. Переменные окружения

В `packages/web/` скопируйте пример и заполните под свой стенд:

```bash
cd packages/web
cp .env.example .env
```

В `.env` задайте:

- **`VITE_WORKSPACE_API_ORIGIN`** — URL бэкенда/API (например `https://api.example.com`). Без него запросы к API не будут проксироваться/работать.
- **`VITE_JITSI_MEET_DOMAIN`** — домен Jitsi Meet без протокола (например `meet.jit.si`), если используете видеозвонки.

### 3. Запуск фронтенда

Из **корня** репозитория:

```bash
npm run dev:web
```

Или из `packages/web`:

```bash
cd packages/web
npm run dev
```

Приложение откроется по адресу из вывода Vite (обычно `http://localhost:5173`).

---

**Примечание:** без mock-server нужен реальный бэкенд; укажите его в `VITE_WORKSPACE_API_ORIGIN`.
