import { PrismaClient, tipo_rol } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
    // Credenciales por variable de entorno (antes: admin123 fijo en el codigo).
    // Uso: ADMIN_EMAIL=... ADMIN_PASSWORD=... npx ts-node prisma/create-admin.ts
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) {
        throw new Error('Define ADMIN_EMAIL y ADMIN_PASSWORD (al menos 12 caracteres)');
    }

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
