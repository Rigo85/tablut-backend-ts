# Tablut Backend (TypeScript)

Backend del juego Tablut (Cartier).

## Stack
- Node 24
- TypeScript (CJS)
- Express + Socket.IO
- Redis (estado de partida)
- PostgreSQL (sesiones, eventos, resultados)

## Scripts
```bash
npm run dev             # desarrollo (tsx watch)
npm run test            # tests
npm run build           # compilar
npm run start           # ejecutar dist/
npm run sync-frontend   # copiar dist frontend a src/browser
```

## Notas
- WebSocket namespace: `/game`
- Puerto por defecto: `3009`
- Variables de entorno base en `sample.env`
