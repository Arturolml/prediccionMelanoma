import { Module } from '@nestjs/common';
import { EvaluacionesService } from './evaluaciones.service';
import { EvaluacionesController } from './evaluaciones.controller';
import { PacientesModule } from 'src/pacientes/pacientes.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  imports: [PacientesModule, HttpModule],
  controllers: [EvaluacionesController],
  providers: [EvaluacionesService],
})
export class EvaluacionesModule { }
