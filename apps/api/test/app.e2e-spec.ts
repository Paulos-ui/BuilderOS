import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('BuilderOS Core Platform (e2e)', () => {
  let app: INestApplication<App>;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
    );
    await app.init();
  });

  it('/healthz (GET) reports ok', () => {
    return request(app.getHttpServer())
      .get('/healthz')
      .expect(200)
      .expect((res) => {
        expect((res.body as { status: string }).status).toBe('ok');
      });
  });

  it('/v1/auth/wallet/challenge (POST) rejects a non-address', () => {
    return request(app.getHttpServer())
      .post('/v1/auth/wallet/challenge')
      .send({ address: 'not-an-address' })
      .expect(400);
  });

  afterEach(async () => {
    await app.close();
  });
});
