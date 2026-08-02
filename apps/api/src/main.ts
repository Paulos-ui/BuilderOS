import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(cookieParser());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // strip properties not in the DTO
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: process.env.APP_BASE_URL ?? 'http://localhost:3000',
    credentials: true, // required for the httpOnly refresh cookie
  });

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`BuilderOS Core Platform API listening on :${port}`);
}
void bootstrap();
