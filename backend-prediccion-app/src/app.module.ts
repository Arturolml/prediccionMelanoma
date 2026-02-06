import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PacientesModule } from './pacientes/pacientes.module';
import { LesionesModule } from './lesiones/lesiones.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';

@Module({
  imports: [PrismaModule, UsuariosModule, PacientesModule, LesionesModule, EvaluacionesModule, ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
