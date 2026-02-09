import { ApiProperty } from "@nestjs/swagger";
import { tipo_sexo } from "@prisma/client";
import { IsEnum, IsString } from "class-validator";


export class CreatePacienteDto {

    @ApiProperty({ example: 'Carlos' })
    @IsString()
    nombres!: string

    @ApiProperty({ example: 'Lopez' })
    @IsString()
    apellido_paterno!: string

    @ApiProperty({ example: 'Garcia' })
    @IsString()
    apellido_materno!: string

    @ApiProperty({ example: 'SEMAxxxx' })
    @IsString()
    curp!: string

    @ApiProperty({ enum: tipo_sexo })
    @IsEnum(tipo_sexo)
    sexo!: tipo_sexo

    @ApiProperty({ example: '2000-01-01' })
    @IsString()
    fecha_nacimiento!: Date





}
