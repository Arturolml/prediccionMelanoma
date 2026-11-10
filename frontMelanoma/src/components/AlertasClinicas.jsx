import { AlertTriangle } from 'lucide-react';
import { alertasClinicas } from '../constants/alertas';
import './ResultadoIA.css';

const AlertasClinicas = ({ paciente, evaluacion }) => {
    const alertas = alertasClinicas(paciente, evaluacion);
    if (alertas.length === 0) return null;
    return (
        <div className="ria-alertas">
            <div className="ria-alertas-titulo"><AlertTriangle size={14} /> Datos clínicos a considerar</div>
            <ul>{alertas.map(a => <li key={a}>{a}</li>)}</ul>
            <div className="text-xs text-muted">La IA no usa estos datos: su resultado no los incluye.</div>
        </div>
    );
};

export default AlertasClinicas;
