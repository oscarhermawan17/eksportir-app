#!/usr/bin/env python3
"""Regenerates the route table in docs/API.md from the @Controller/@Get/@Post/... decorators and guards in apps/api/src/*/*.controller.ts.
Run from the repository root: `pnpm docs:api`. The text above the table and the Realtime section are kept in this script, so edit them here."""
import re,glob,subprocess
rows=[]
for f in sorted(glob.glob('apps/api/src/*/*.controller.ts')):
    lines=open(f).read().split('\n')
    prefix=''; cls_dec=[]; buf=[]; in_class=False; pending=''
    for l in lines:
        s=l.strip()
        # A decorator may span several lines (e.g. @Throttle({ ... }) with one limit per line). Collect
        # them into one string first; otherwise the continuation lines look like code and clear `buf`,
        # which silently drops the route that follows. The assert at the end catches it, loudly.
        if pending or (s.startswith('@') and s.count('(')>s.count(')')):
            pending+=s
            if pending.count('(')>pending.count(')'): continue
            s=pending; pending=''
        m=re.match(r"@Controller\((?:'([^']*)')?\)",s)
        if m: prefix=m.group(1) or ''; buf.append(s); continue
        if s.startswith('export class'):
            cls_dec=buf; buf=[]; in_class=True; continue
        if not in_class:
            if s.startswith('@'): buf.append(s)
            continue
        if s.startswith('@'): buf.append(s); continue
        sig=re.match(r'^(?:async )?([a-zA-Z_]\w*)\(',s)
        if sig and buf:
            dec=buf; buf=[]
            route=next((d for d in dec if re.match(r'@(Get|Post|Put|Patch|Delete)\(',d)),None)
            if not route: continue
            mm=re.match(r"@(Get|Post|Put|Patch|Delete)\((?:'([^']*)')?\)",route)
            verb=mm.group(1).upper(); sub=mm.group(2) or ''
            path='/api/'+'/'.join(x for x in (prefix,sub) if x)
            alld=cls_dec+dec; guards=' '.join(alld); roles=None
            for d in alld:
                r=re.match(r'@Roles\((.*)\)',d)
                if r: roles=r.group(1)
            if 'JwtAuthGuard' not in guards: access='public'
            else:
                if roles:
                    access='any admin' if 'ADMIN_ROLES' in roles else ', '.join(x.strip().strip("'") for x in roles.split(','))
                else: access='logged in'
                if 'ApprovedSellerGuard' in guards: access+=' (approved seller)'
            if re.search(r'Throttle\w*Guard',guards): access+=' · rate-limited'  # ThrottlerGuard, UploadThrottleGuard, ...
            rows.append((path,verb,access,sig.group(1),f.split('/')[-1].replace('.controller.ts','')))
        else: buf=[]
total=int(subprocess.check_output("grep -hE '^\\s*@(Get|Post|Put|Patch|Delete)\\(' apps/api/src/*/*.controller.ts | wc -l",shell=True).decode().strip())
assert len(rows)==total,(len(rows),total)
rows.sort(key=lambda r:(r[0].split('/')[2] if len(r[0].split('/'))>2 else '', r[0], r[1]))
head=['# API reference', '', 'All routes live under the `/api` prefix (global prefix, `apps/api/src/app.setup.ts`). Auth is the httpOnly cookie `bt_session`; **access** is what the', 'guards enforce (`JwtAuthGuard` + `RolesGuard`, `ApprovedSellerGuard` for seller-only routes). Resources that belong to another user answer **404**, not 403.', 'Input is validated by DTOs (`whitelist` + `forbidNonWhitelisted`), so unknown fields are rejected with 400. Keep this file in sync when you add or change a route.', '']
out=head+['| Method | Path | Access | Handler | Module |','|---|---|---|---|---|']
out+=[f'| {v} | `{p}` | {a} | `{h}` | {m} |' for p,v,a,h,m in rows]
out+=['','## Realtime (Socket.IO)','',
'The Socket.IO server runs on the API origin (path `/socket.io`). The browser connects with its session cookie; the server checks the cookie and the `Origin` (must equal `WEB_ORIGIN`) in a handshake middleware, so an unauthenticated or foreign-origin client gets `connect_error`. Messages are **written through REST only** (`POST /api/conversations/:id/messages`, limited to 20 per user per minute: 429 beyond that); sockets only join rooms and receive pushes. Constants: `CHAT_EVENTS` in `packages/shared/src/chat.ts`.','',
'| Direction | Event | Payload | Notes |','|---|---|---|---|',
'| client → server | `conversation:join` | conversation id | Ack `{ ok: true }` for the buyer, the seller and ADMIN_OPS / ADMIN_OWNER; `{ ok: false }` for anyone else or an invalid id |',
'| client → server | `conversation:leave` | conversation id | |',
'| server → room `conversation:<id>` | `message:new` | `ChatMessageView` | Only sockets that joined the room |',
'| server → buyer, seller and moderators | `conversation:updated` | `{ conversationId }` | Id only; the inbox re-reads the list through REST, which checks access again |',
'| server → user room `user:<id>` | `notification:new` | `NotificationPush` (`item`, `unreadCount`) | A notification was created or updated (all tabs of that user) |',
'| server → user room `user:<id>` | `notification:count` | `NotificationCount` | Unread count changed, e.g. read in another tab |','']
out+=['','Query/body shapes: the DTOs in each module\'s `dto/` folder and the shared types in `packages/shared/src`. Business rules per feature: `docs/ARCHITECTURE.md`.','']
open('docs/API.md','w').write('\n'.join(out)); print('routes:',len(rows))
