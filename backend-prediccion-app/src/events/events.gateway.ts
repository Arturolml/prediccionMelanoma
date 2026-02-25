import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  ConnectedSocket,
  MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  handleConnection(client: Socket) {
    console.log(`Cliente conectado: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Cliente desconectado: ${client.id}`);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: number },
  ) {
    if (payload && payload.userId) {
      const roomName = `room_user_${payload.userId}`;
      client.join(roomName);
      console.log(`Cliente ${client.id} se unió a ${roomName}`);
      return { event: 'joined', data: roomName };
    }
  }

  @SubscribeMessage('solicitar_camara_movil')
  handleSolicitarCamara(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: number },
  ) {
    if (payload && payload.userId) {
      const roomName = `room_user_${payload.userId}`;
      console.log(`Solicitando cámara a ${roomName}`);
      // Emit to all clients in the room (including the mobile app)
      this.server.to(roomName).emit('abrir_camara', { message: 'Por favor toma la foto' });
    }
  }

  @SubscribeMessage('foto_capturada')
  handleFotoCapturada(
    @ConnectedSocket() client: Socket,
    @MessageBody() payload: { userId: number; imageBase64: string },
  ) {
    if (payload && payload.userId && payload.imageBase64) {
      const roomName = `room_user_${payload.userId}`;
      console.log(`Foto recibida de ${roomName}, reenviando...`);
      // Emit back to the room (so the web app receives it)
      this.server.to(roomName).emit('foto_recibida', { imageBase64: payload.imageBase64 });
    }
  }
}
