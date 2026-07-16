import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  const allowedOrigins = (process.env.FRONTEND_URL ?? 'http://localhost:3000')
    .split(',')
    .map((o) => o.trim());
  const isProd = process.env.NODE_ENV === 'production';

  app.enableCors({
    origin: (origin, callback) => {
      // Permite requests sin origin (curl, same-origin) y los orígenes de la lista.
      // En desarrollo, además cualquier localhost (puertos dinámicos de preview).
      if (
        !origin ||
        allowedOrigins.includes(origin) ||
        (!isProd && /^http:\/\/localhost:\d+$/.test(origin))
      ) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, transform: true }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`Masamor API escuchando en http://localhost:${port}`);
}
bootstrap();
