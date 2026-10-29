import { CheckCircle, ShieldAlert } from 'lucide-react';

/** Color y texto de la decisión de la IA (sospecha / derivar / sin sospecha). */
export const estiloDecision = (decision) => {
    if (decision === 'sospecha') return { clase: 'maligno', texto: 'Sospecha de malignidad', Icono: ShieldAlert };
    if (decision === 'derivar') return { clase: 'maligno', texto: 'Derivar', Icono: ShieldAlert };
    if (decision === 'sin_sospecha') return { clase: 'benigno', texto: 'Sin sospecha', Icono: CheckCircle };
    return null;
};
