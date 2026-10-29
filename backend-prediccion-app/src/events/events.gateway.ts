import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

/**
 * Canal web <-> app móvil para tomar la foto con el celular.
 *
 * Cada socket se autentica con el mismo JWT del login (handshake
 * `auth: { token }`) y queda solo en la sala de SU usuario. Antes la sala la
 * elegía el cliente con un `userId` en el mensaje, así que cualquiera podía
 * unirse a la sala de otro usuario y recibir sus fotos de pacientes.
 */
@WebSocketGateway({ cors: true })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  constructor(private readonly jwtService: JwtService) { }

  private sala(client: Socket): string | null {
    const userId = client.data?.userId;
    return userId ? `room_user_${userId}` : null;
  }

  handleConnection(client: Socket) {
    const auth = client.handshake.auth?.token ?? client.handshake.headers?.authorization;
    const token = typeof auth === 'string' ? auth.replace(/^Bearer\s+/i, '') : null;
    try {
      if (!token) throw new Error('sin token');
      const payload = this.jwtService.verify(token);
      client.data.userId = payload.sub;
      client.join(`room_user_${payload.sub}`);
    } catch {
      client.emit('error_autenticacion', { message: 'Sesión inválida o vencida' });
      client.disconnect(true);
    }
  }

  handleDisconnect(_client: Socket) { }

  // Se mantiene por compatibilidad con los clientes que lo emiten al conectar;
  // la sala ya se asignó en handleConnection y el userId del mensaje se ignora.
  @SubscribeMessage('join_room')
  handleJoinRoom(@ConnectedSocket() client: Socket) {
    const sala = this.sala(client);
    return sala ? { event: 'joined', data: sala } : undefined;
  }

  @SubscribeMessage('solicitar_camara_movil')
  handleSolicitarCamara(@ConnectedSocket() client: Socket) {
    const sala = this.sala(client);
    if (sala) {
      this.server.to(sala).emit('abrir_camara', { message: 'Por favor toma la foto' });
    }
  }

  @SubscribeMessage('foto_capturada')
  handleFotoCapturada(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { imageBase64: string },
  ) {
    const sala = this.sala(client);
    if (sala && payload && typeof payload.imageBase64 === 'string') {
      this.server.to(sala).emit('foto_recibida', { imageBase64: payload.imageBase64 });
    }
  }
}
