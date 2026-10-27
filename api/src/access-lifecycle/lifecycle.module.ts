import { Module } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { LifecycleController } from './lifecycle.controller';
import { LifecycleService } from './lifecycle.service';
import { IntakeService } from './intake.service';
import { ProviderHttp } from './provider-http';
import { ConnectorsService } from './connectors.service';
import { LifecycleWorker } from './lifecycle.worker';

@Module({
  controllers: [LifecycleController],
  providers: [
    PrismaService,
    LifecycleService,
    IntakeService,
    ProviderHttp,
    ConnectorsService,
    LifecycleWorker,
  ],
})
export class LifecycleModule {}
