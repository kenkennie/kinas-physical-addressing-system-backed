import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';

async function bootstrap() {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors();
  app.enableShutdownHooks();

  // Swagger
  const config = new DocumentBuilder()
    .setTitle('Anwani Physical Addressing API')
    .setDescription(
      `REST API for Kenya's physical addressing system. 
      Manages land parcels, roads, administrative blocks, entry points, address generation and routing.
      All spatial data uses WGS84 (SRID 4326) coordinates — latitude/longitude.`,
    )
    .setVersion('1.0')
    .addTag('land-parcel', 'Land parcel management and spatial queries')
    .addTag('roads', 'Road network data from OpenStreetMap')
    .addTag('administrative-block', 'Administrative blocks, constituencies and counties')
    .addTag('entry-points', 'Entry points linked to land parcels')
    .addTag('address', 'Address search and parcel detail lookup')
    .addTag('routing', 'Mapbox-powered routing and navigation')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  logger.log(`Application is running on port ${port}`);
  logger.log(`Swagger docs available at http://localhost:${port}/docs`);
}
bootstrap();

