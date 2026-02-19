import { PrismaClient, tipo_rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    const email = 'admin@hospital.com';
    const password = 'admin123'; // Contraseña segura :)

    // Verificar si ya existe
    const existingUser = await prisma.usuarios_sistema.findUnique({
        where: { email },
    });

    if (existingUser) {
        console.log(`El usuario ${email} ya existe.`);
        return;
    }

    // Hash password
    const salt = await bcrypt.genSalt();
    const password_hash = await bcrypt.hash(password, salt);

    // Crear usuario
    const user = await prisma.usuarios_sistema.create({
        data: {
            nombre_completo: 'Administrador del Sistema',
            email,
            password_hash,
            rol: tipo_rol.admin,
            cedula_profesional: '00000000',
            telefono_contacto: '5555555555',
            activo: true,
        },
    });

    console.log(`Usuario creado: ${user.email} (Rol: ${user.rol})`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
