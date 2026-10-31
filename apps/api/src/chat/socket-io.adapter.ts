import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';

/** Socket.IO server that accepts browsers from the web app's origin only, with cookies (same rule as the REST CORS setup). */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly webOrigin: string,
  ) {
    super(app);
  }

  override createIOServer(port: number, options?: Parameters<IoAdapter['createIOServer']>[1]) {
    // The cast only bridges `exactOptionalPropertyTypes` (every option is optional here, the base signature wants `path` set).
    return super.createIOServer(port, { ...options, cors: { origin: this.webOrigin, credentials: true } } as never);
  }
}
