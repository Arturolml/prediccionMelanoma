import { ApiProperty } from "@nestjs/swagger";
import { IsInt, IsOptional, IsString, IsNumber, IsBoolean } from "class-validator";



export class CreateEvaluacioneDto {
    @ApiProperty({ example: 1 })
    @IsInt()
    id_lesion!: number;

    @ApiProperty({ example: 1 })
    @IsInt()
    id_usuario_registro!: number;

    @ApiProperty({ example: 2, required: false })
    @IsOptional()
    @IsInt()
    id_medico_validador?: number;

    @ApiProperty({ example: '/uploads/img1.jpg' })
    @IsString()
    ruta_imagen!: string;

    @ApiProperty({ example: 85.5 })
    @IsOptional()
    @IsNumber()
    prediccion_ia?: number;

    @IsOptional()
    @IsBoolean()
    asimetria?: boolean;

    @IsOptional()
    @IsBoolean()
    bordes_irregulares?: boolean;

    @IsOptional()
    @IsBoolean()
    color_variable?: boolean;

    @IsOptional()
    @IsNumber()
    diametro_mm?: number;

    @IsOptional()
    @IsBoolean()
    evolucion_cambios?: boolean;

    @IsOptional()
    @IsBoolean()
    sintoma_sangrado?: boolean;

    @IsOptional()
    @IsBoolean()
    sintoma_picazon?: boolean;

    @IsOptional()
    @IsBoolean()
    sintoma_dolor?: boolean;

    @IsOptional()
    @IsBoolean()
    sintoma_ulceracion?: boolean;

    @ApiProperty({ example: 'Benigno' })
    @IsOptional()
    @IsString()
    diagnostico_medico?: string;

    @IsOptional()
    @IsString()
    notas_medico?: string;

    @IsOptional()
    @IsBoolean()
    requiere_biopsia?: boolean;

    @IsOptional()
    fecha_evaluacion?: Date;
}
