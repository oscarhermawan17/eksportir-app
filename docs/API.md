# API reference

All routes live under the `/api` prefix (global prefix, `apps/api/src/app.setup.ts`). Auth is the httpOnly cookie `bt_session`; **access** is what the
guards enforce (`JwtAuthGuard` + `RolesGuard`, `ApprovedSellerGuard` for seller-only routes). Resources that belong to another user answer **404**, not 403.
Input is validated by DTOs (`whitelist` + `forbidNonWhitelisted`), so unknown fields are rejected with 400. Keep this file in sync when you add or change a route.

| Method | Path | Access | Handler | Module |
|---|---|---|---|---|
| GET | `/api/admin/categories` | ADMIN_OWNER | `list` | admin-categories |
| POST | `/api/admin/categories` | ADMIN_OWNER | `create` | admin-categories |
| PATCH | `/api/admin/categories/:id` | ADMIN_OWNER | `update` | admin-categories |
| GET | `/api/admin/exchange-rates` | ADMIN_OWNER | `history` | admin-exchange-rates |
| POST | `/api/admin/exchange-rates` | ADMIN_OWNER | `set` | admin-exchange-rates |
| POST | `/api/admin/orders/:id/confirm-paid` | ADMIN_FINANCE, ADMIN_OWNER | `confirmPaid` | admin-order-payments |
| POST | `/api/admin/orders/:id/start-qc` | ADMIN_OPS, ADMIN_OWNER | `startQc` | admin-order-payments |
| GET | `/api/admin/payments` | ADMIN_FINANCE, ADMIN_OWNER | `list` | admin-payments |
| POST | `/api/admin/payments/:id/reject` | ADMIN_FINANCE, ADMIN_OWNER | `reject` | admin-payments |
| POST | `/api/admin/payments/:id/verify` | ADMIN_FINANCE, ADMIN_OWNER | `verify` | admin-payments |
| GET | `/api/admin/ping` | any admin | `ping` | admin |
| GET | `/api/admin/products` | ADMIN_OPS, ADMIN_OWNER | `list` | admin-products |
| GET | `/api/admin/products/:id` | ADMIN_OPS, ADMIN_OWNER | `get` | admin-products |
| POST | `/api/admin/products/:id/approve` | ADMIN_OPS, ADMIN_OWNER | `approve` | admin-products |
| POST | `/api/admin/products/:id/reject` | ADMIN_OPS, ADMIN_OWNER | `reject` | admin-products |
| PUT | `/api/admin/products/:id/translations` | ADMIN_OPS, ADMIN_OWNER | `saveTranslations` | admin-products |
| GET | `/api/admin/sellers` | ADMIN_OPS, ADMIN_OWNER | `list` | admin-sellers |
| POST | `/api/admin/sellers/:id/approve` | ADMIN_OPS, ADMIN_OWNER | `approve` | admin-sellers |
| POST | `/api/admin/sellers/:id/reject` | ADMIN_OPS, ADMIN_OWNER | `reject` | admin-sellers |
| POST | `/api/auth/login` | public · rate-limited | `login` | auth |
| POST | `/api/auth/logout` | public | `logout` | auth |
| GET | `/api/auth/me` | logged in | `me` | auth |
| PATCH | `/api/auth/me` | logged in | `updateMe` | auth |
| POST | `/api/auth/register` | public · rate-limited | `register` | auth |
| GET | `/api/categories` | public | `list` | categories |
| GET | `/api/conversations` | logged in | `list` | chat |
| POST | `/api/conversations` | logged in | `start` | chat |
| GET | `/api/conversations/:id` | logged in | `get` | chat |
| GET | `/api/conversations/:id/messages` | logged in | `messages` | chat |
| POST | `/api/conversations/:id/messages` | logged in | `send` | chat |
| GET | `/api/fx/current` | public | `current` | fx |
| GET | `/api/health` | public | `check` | health |
| GET | `/api/media/download-url` | logged in · rate-limited | `downloadUrl` | media |
| POST | `/api/media/presign-upload` | logged in · rate-limited | `presignUpload` | media |
| GET | `/api/notifications` | logged in | `list` | notifications |
| POST | `/api/notifications/:id/read` | logged in | `read` | notifications |
| POST | `/api/notifications/conversations/:conversationId/read` | logged in | `readConversation` | notifications |
| POST | `/api/notifications/read-all` | logged in | `readAll` | notifications |
| GET | `/api/orders` | logged in | `list` | orders |
| POST | `/api/orders` | logged in | `create` | orders |
| GET | `/api/orders/:id` | logged in | `get` | orders |
| POST | `/api/orders/:id/accept` | logged in | `accept` | orders |
| POST | `/api/orders/:id/accept-change` | logged in | `acceptChange` | orders |
| POST | `/api/orders/:id/cancel` | logged in | `cancel` | orders |
| POST | `/api/orders/:id/decline` | logged in | `decline` | orders |
| GET | `/api/orders/:id/payments` | logged in | `summary` | payments |
| POST | `/api/orders/:id/payments` | logged in | `submit` | payments |
| POST | `/api/orders/:id/propose-change` | logged in | `proposeChange` | orders |
| GET | `/api/payments/instructions` | logged in | `instructions` | payments |
| GET | `/api/products` | public | `list` | catalog |
| GET | `/api/products/:id` | public | `detail` | catalog |
| GET | `/api/public/sellers/:id` | public | `seller` | catalog |
| GET | `/api/qc-zones` | public | `listQcZones` | sellers |
| GET | `/api/seller/ping` | SELLER (approved seller) | `ping` | sellers |
| GET | `/api/seller/products` | SELLER (approved seller) | `list` | products |
| POST | `/api/seller/products` | SELLER (approved seller) | `create` | products |
| GET | `/api/seller/products/:id` | SELLER (approved seller) | `get` | products |
| PUT | `/api/seller/products/:id` | SELLER (approved seller) | `update` | products |
| POST | `/api/seller/products/:id/archive` | SELLER (approved seller) | `archive` | products |
| POST | `/api/seller/products/:id/restore` | SELLER (approved seller) | `restore` | products |
| POST | `/api/seller/products/:id/submit` | SELLER (approved seller) | `submit` | products |
| POST | `/api/sellers/apply` | logged in | `apply` | sellers |
| GET | `/api/sellers/me` | logged in | `getOwn` | sellers |
| PATCH | `/api/sellers/me` | logged in | `updateOwn` | sellers |

## Realtime (Socket.IO)

The Socket.IO server runs on the API origin (path `/socket.io`). The browser connects with its session cookie; the server checks the cookie and the `Origin` (must equal `WEB_ORIGIN`) in a handshake middleware, so an unauthenticated or foreign-origin client gets `connect_error`. Messages are **written through REST only** (`POST /api/conversations/:id/messages`, limited to 20 per user per minute: 429 beyond that); sockets only join rooms and receive pushes. Constants: `CHAT_EVENTS` in `packages/shared/src/chat.ts`.

| Direction | Event | Payload | Notes |
|---|---|---|---|
| client → server | `conversation:join` | conversation id | Ack `{ ok: true }` for the buyer, the seller and ADMIN_OPS / ADMIN_OWNER; `{ ok: false }` for anyone else or an invalid id |
| client → server | `conversation:leave` | conversation id | |
| server → room `conversation:<id>` | `message:new` | `ChatMessageView` | Only sockets that joined the room |
| server → buyer, seller and moderators | `conversation:updated` | `{ conversationId }` | Id only; the inbox re-reads the list through REST, which checks access again |
| server → user room `user:<id>` | `notification:new` | `NotificationPush` (`item`, `unreadCount`) | A notification was created or updated (all tabs of that user) |
| server → user room `user:<id>` | `notification:count` | `NotificationCount` | Unread count changed, e.g. read in another tab |


Query/body shapes: the DTOs in each module's `dto/` folder and the shared types in `packages/shared/src`. Business rules per feature: `docs/ARCHITECTURE.md`.
