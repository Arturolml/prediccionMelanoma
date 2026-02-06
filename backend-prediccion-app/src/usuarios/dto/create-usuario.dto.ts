import { ApiProperty } from "@nestjs/swagger";
import { tipo_rol, usuarios_sistema } from "@prisma/client";
import { IsEmail, IsNotEmpty, IsString, IsEnum, IsOptional } from "class-validator";


export class CreateUsuarioDto {

    @ApiProperty({ example: 'Juan Pérez' })
    @IsNotEmpty({ message: 'El nombre completo es obligatorio' })
    @IsString()
    nombre_completo!: string;

    @ApiProperty({ example: 'juan@correo.com' })
    @IsEmail()
    email!: string;

    @ApiProperty({ example: 'password123' })
    @IsString()
    password!: string; // 👈 NO uses password_hash aquí

    @ApiProperty({ enum: tipo_rol })
    @IsEnum(tipo_rol)
    rol!: tipo_rol;

    @ApiProperty({ example: '1234567', required: false })
    @IsOptional()
    @IsString()
    cedula_profesional?: string;

    @ApiProperty({ example: '4921234567', required: false })
    @IsOptional()
    @IsString()
    telefono_contacto?: string;

}
