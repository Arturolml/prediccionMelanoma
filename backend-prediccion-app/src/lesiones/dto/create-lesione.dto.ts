import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsIn, IsNumber, IsOptional, IsString } from "class-validator";
import { VALORES_SITIO } from "../../ia/sitios";



export class CreateLesioneDto {

    @ApiProperty({ example: 1 })
    @IsOptional()
    @IsNumber()
    id_paciente?: number;

    @ApiProperty({ example: 'Espalda superior' })
    @IsString()
    zona_cuerpo!: string;

    @ApiProperty({ example: 'back', enum: VALORES_SITIO, required: false, description: 'Sitio anatómico para la IA (por defecto unknown)' })
    @IsOptional()
    @IsIn(VALORES_SITIO, { message: `sitio_anatomico debe ser uno de: ${VALORES_SITIO.join(', ')}` })
    sitio_anatomico?: string;

    @ApiProperty({ example: '2024-01-01' })
    @IsOptional()
    @IsDate()
    @Type(() => Date)
    fecha_deteccion?: Date;

    @ApiProperty({ example: 'Lesion cercana al hombro derecho' })
    @IsOptional()
    @IsString()
    notas_ubicacion?: string;

}
