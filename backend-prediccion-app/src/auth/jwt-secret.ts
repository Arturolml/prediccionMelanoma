/**
 * Secreto para firmar y verificar los JWT. Es obligatorio: sin él, el backend
 * no arranca (antes usaba 'secretKey' por defecto, con lo que cualquiera podía
 * fabricar tokens válidos).
 */
export function jwtSecret(): string {
  const secreto = process.env.JWT_SECRET;
  if (!secreto || secreto.length < 32) {
    throw new Error('JWT_SECRET no está definido o tiene menos de 32 caracteres (ver .env.example)');
  }
  return secreto;
}
