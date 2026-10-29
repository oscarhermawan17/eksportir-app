import 'dotenv/config';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';

// Requires the database from docker-compose.yml (`pnpm db:up`) and apps/api/.env.
describe('Security headers (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends the standard hardening headers and hides the framework', async () => {
    const res = await request(app.getHttpServer()).get('/api/health').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['referrer-policy']).toBeDefined();
    expect(res.headers['cross-origin-resource-policy']).toBe('same-site');
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('also sets them on error responses (404, 401)', async () => {
    const notFound = await request(app.getHttpServer()).get('/api/does-not-exist').expect(404);
    expect(notFound.headers['x-content-type-options']).toBe('nosniff');
    const unauthorized = await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    expect(unauthorized.headers['x-content-type-options']).toBe('nosniff');
    expect(unauthorized.headers['x-powered-by']).toBeUndefined();
  });
});
