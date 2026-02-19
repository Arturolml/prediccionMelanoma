import { ApiProperty } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsDate, IsNumber, IsOptional, IsString } from "class-validator";



export class CreateLesioneDto {

    @ApiProperty({ example: 1 })
    @IsOptional()
    @IsNumber()
    id_paciente?: number;

    @ApiProperty({ example: 'Espalda superior' })
    @IsString()
    zona_cuerpo!: string;

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
