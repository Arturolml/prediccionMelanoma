import { Module } from '@nestjs/common';
import { LesionesService } from './lesiones.service';
import { LesionesController } from './lesiones.controller';

@Module({
  controllers: [LesionesController],
  providers: [LesionesService],
})
export class LesionesModule {}
