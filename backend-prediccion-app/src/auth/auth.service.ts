import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UsuariosService } from 'src/usuarios/usuarios.service';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
    constructor(
        private usuariosService: UsuariosService,
        private jwtService: JwtService
    ) { }

    async validateUser(email: string, pass: string): Promise<any> {
        const user = await this.usuariosService.findOneByEmail(email);
        if (user && user.activo !== false && await bcrypt.compare(pass, user.password_hash)) {
            const { password_hash, ...result } = user;
            return result;
        }
        return null;
    }

    async login(user: any) {
        const payload = { email: user.email, sub: user.id_usuario, rol: user.rol };
        return {
            access_token: this.jwtService.sign(payload),
            user: {
                id_usuario: user.id_usuario,
                email: user.email,
                rol: user.rol,
                nombre_completo: user.nombre_completo
            }
        };
    }
}
