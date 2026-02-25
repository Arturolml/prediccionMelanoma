import { ApiProperty } from "@nestjs/swagger";
import { tipo_sexo } from "@prisma/client";
import { Type } from "class-transformer";
import { IsDate, IsEnum, IsString, IsOptional } from "class-validator";


export class CreatePacienteDto {

    @ApiProperty({ example: 'Carlos' })
    @IsString()
    nombres!: string

    @ApiProperty({ example: 'Lopez' })
    @IsString()
    apellido_paterno!: string

    @ApiProperty({ example: 'Garcia', required: false })
    @IsOptional()
    @IsString()
    apellido_materno?: string

    @ApiProperty({ example: 'SEMAxxxx' })
    @IsString()
    curp!: string

    @ApiProperty({ enum: tipo_sexo })
    @IsEnum(tipo_sexo)
    sexo!: tipo_sexo

    @ApiProperty({ example: '2000-01-01' })
    @IsDate()
    @Type(() => Date)
    fecha_nacimiento!: Date

    @ApiProperty({ example: 3, required: false })
    @IsOptional()
    fototipo_fitzpatrick?: number;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    antecedentes_familiares?: boolean;

    @ApiProperty({ example: 'Abuelo con melanoma', required: false })
    @IsOptional()
    @IsString()
    notas_antecedentes?: string;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    historial_cancer_previo?: boolean;

    @ApiProperty({ example: false, required: false })
    @IsOptional()
    inmunosuprimido?: boolean;

    @ApiProperty({ example: 1, required: false })
    @IsOptional()
    id_usuario_registro?: number;

}
