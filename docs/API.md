# API reference

All routes live under the `/api` prefix (global prefix, `apps/api/src/app.setup.ts`). Auth is the httpOnly cookie `bt_session`; **access** is what the
guards enforce (`JwtAuthGuard` + `RolesGuard`, `ApprovedSellerGuard` for seller-only routes). Resources that belong to another user answer **404**, not 403.
Input is validated by DTOs (`whitelist` + `forbidNonWhitelisted`), so unknown fields are rejected with 400. Keep this file in sync when you add or change a route.

| Method | Path | Access | Handler | Module |
|---|---|---|---|---|
| GET | `/api/admin/exchange-rates` | ADMIN_OWNER | `history` | admin-exchange-rates |
| POST | `/api/admin/exchange-rates` | ADMIN_OWNER | `set` | admin-exchange-rates |
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
| GET | `/api/fx/current` | public | `current` | fx |
| GET | `/api/health` | public | `check` | health |
| GET | `/api/media/download-url` | logged in | `downloadUrl` | media |
| POST | `/api/media/presign-upload` | logged in | `presignUpload` | media |
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

Query/body shapes: the DTOs in each module's `dto/` folder and the shared types in `packages/shared/src`. Business rules per feature: `docs/ARCHITECTURE.md`.
