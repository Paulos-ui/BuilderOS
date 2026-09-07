import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
import { buildCorsOptions } from './common/cors';

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

  // Allowlist lives in common/cors.ts — a single origin string cannot serve
  // more than one deployed frontend.
  app.enableCors(buildCorsOptions());

  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  console.log(`BuilderOS Core Platform API listening on :${port}`);
  console.log(
    process.env.RESEND_API_KEY
      ? `Email delivery: ENABLED (from ${process.env.MAIL_FROM ?? 'onboarding@resend.dev'})`
      : 'Email delivery: DISABLED — sign-in codes will print to this log',
  );
}
void bootstrap();
