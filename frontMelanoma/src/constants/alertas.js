/**
 * Datos clínicos a tener presentes junto con el resultado de la IA. Son reglas
 * simples sobre lo que captura el personal: no cambian la decisión de los
 * modelos, que no usan estos datos.
 */
export const alertasClinicas = (paciente, evaluacion) => {
    const alertas = [];
    if (evaluacion?.sintoma_sangrado) alertas.push('La lesión presenta sangrado.');
    if (evaluacion?.sintoma_ulceracion) alertas.push('La lesión presenta ulceración.');
    if (evaluacion?.evolucion_cambios) alertas.push('Se reportan cambios en la lesión.');
    if (Number(evaluacion?.diametro_mm) > 6) alertas.push('Diámetro mayor de 6 mm.');
    if (paciente?.antecedentes_familiares) alertas.push('Antecedentes familiares.');
    if (paciente?.historial_cancer_previo) alertas.push('Cáncer previo.');
    if (paciente?.inmunosuprimido) alertas.push('Paciente inmunosuprimido.');
    return alertas;
};
