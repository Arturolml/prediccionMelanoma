import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsuariosModule } from './usuarios/usuarios.module';
import { PacientesModule } from './pacientes/pacientes.module';
import { LesionesModule } from './lesiones/lesiones.module';
import { EvaluacionesModule } from './evaluaciones/evaluaciones.module';
import { AuthModule } from './auth/auth.module';
import { EventsGateway } from './events/events.gateway';

@Module({
  imports: [
    PrismaModule,
    UsuariosModule,
    PacientesModule,
    LesionesModule,
    EvaluacionesModule,
    AuthModule,
    // /uploads ya no se sirve como estatico: las imagenes se piden por
    // /evaluaciones/:id/imagen, con sesion.
  ],
  controllers: [AppController],
  providers: [AppService, EventsGateway],
})
export class AppModule { }
