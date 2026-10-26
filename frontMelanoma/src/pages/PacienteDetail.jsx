import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Calendar, Activity, FileText } from 'lucide-react';
import { api } from '../services/api';
import './PacienteDetail.css';

const PacienteDetail = () => {
    const { id } = useParams();
    const [paciente, setPaciente] = useState(null);
    const [evaluaciones, setEvaluaciones] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchData = async () => {
            try {
                setIsLoading(true);
                const [pacienteData, evaluacionesData] = await Promise.all([
                    api.pacientes.getById(id),
                    api.evaluaciones.getAll({ id_paciente: id })
                ]);
                setPaciente(pacienteData);
                setEvaluaciones(evaluacionesData);
            } catch (err) {
                console.error("Error fetching paciente data:", err);
                setError('No se pudo cargar el expediente del paciente.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [id]);

    if (isLoading) {
        return (
            <div className="paciente-detail-page flex-center min-h-screen">
                <Activity className="spin text-primary" size={32} />
                <p className="ml-4 text-muted">Cargando expediente...</p>
            </div>
        );
    }

    if (error || !paciente) {
        return (
            <div className="paciente-detail-page flex-col flex-center min-h-screen">
                <div className="error-banner mb-4 p-4 text-center rounded text-danger bg-danger/10">{error || 'Paciente no encontrado'}</div>
                <Link to="/pacientes" className="btn btn-outline text-muted">
                    <ArrowLeft size={16} /> Volver
                </Link>
            </div>
        );
    }

    // Las lesiones venían del paciente antes, ahora usamos evaluaciones.

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' });
    };

    return (
        <div className="paciente-detail-page">
            <div className="page-header">
                <div className="flex-col">
                    <Link to="/pacientes" className="back-link text-muted">
                        <ArrowLeft size={16} />
                        <span>Volver a Pacientes</span>
                    </Link>
                    <div className="header-title-row">
                        <h1 className="text-gradient">
                            {paciente.nombres} {paciente.apellido_paterno} {paciente.apellido_materno || ''}
                        </h1>
                    </div>
                </div>
                <button className="btn btn-primary">
                    <Edit size={18} />
                    <span>Editar Expediente</span>
                </button>
            </div>

            <div className="detail-grid">
                {/* Info Column */}
                <div className="info-column">
                    <div className="glass-card mb-24">
                        <h3 className="section-title">Información Personal</h3>
                        <div className="info-list">
                            <div className="info-item">
                                <span className="info-label">CURP</span>
                                <span className="info-value font-mono text-muted">{paciente.curp}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Fecha Nacimiento</span>
                                <span className="info-value">{formatDate(paciente.fecha_nacimiento)}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Sexo</span>
                                <span className="info-value text-capitalize">{paciente.sexo}</span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Fecha Registro</span>
                                <span className="info-value">{formatDate(paciente.fecha_registro)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="glass-card">
                        <h3 className="section-title">Historial Clínico</h3>
                        <div className="info-list">
                            <div className="info-item">
                                <span className="info-label">Fototipo (Fitzpatrick)</span>
                                <span className="info-value badge" style={{ background: 'rgba(255,255,255,0.1)' }}>
                                    {paciente.fototipo_fitzpatrick ? `Tipo ${paciente.fototipo_fitzpatrick}` : '-'}
                                </span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Antecedentes Familiares</span>
                                <span className={`info-value ${paciente.antecedentes_familiares ? 'text-danger' : 'text-success'}`}>
                                    {paciente.antecedentes_familiares ? 'Sí' : 'No'}
                                </span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Cáncer Previo</span>
                                <span className={`info-value ${paciente.historial_cancer_previo ? 'text-danger' : 'text-success'}`}>
                                    {paciente.historial_cancer_previo ? 'Sí' : 'No'}
                                </span>
                            </div>
                            <div className="info-item">
                                <span className="info-label">Inmunosuprimido</span>
                                <span className={`info-value ${paciente.inmunosuprimido ? 'text-danger' : 'text-success'}`}>
                                    {paciente.inmunosuprimido ? 'Sí' : 'No'}
                                </span>
                            </div>
                            {paciente.notas_antecedentes && (
                                <div className="info-item mt-4 w-full">
                                    <span className="info-label block mb-2">Notas / Observaciones</span>
                                    <p className="text-sm p-4 rounded bg-opacity bg-glass" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                        {paciente.notas_antecedentes}
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Evaluaciones Column */}
                <div className="lesiones-column">
                    <div className="flex-between mb-24">
                        <h2>Evaluaciones Registradas ({evaluaciones.length})</h2>
                        <Link to={`/pacientes/${id}/nueva-evaluacion`} className="btn btn-glass btn-sm">Nueva Evaluación</Link>
                    </div>

                    <div className="lesiones-list">
                        {evaluaciones.length === 0 ? (
                            <div className="glass-card text-center py-12 text-muted">
                                No hay evaluaciones registradas aún.
                            </div>
                        ) : (
                            evaluaciones.map(evaluacion => (
                                <div key={evaluacion.id_evaluacion} className="lesion-card glass-card">
                                    <div className="lesion-header flex-between mb-8">
                                        <div className="lesion-title flex items-center">
                                            {evaluacion.ruta_imagen ? (
                                                <img
                                                    src={`https://liaaproyectos.uaz.edu.mx${evaluacion.ruta_imagen}`}
                                                    alt="Evidencia"
                                                    className="w-12 h-12 object-cover rounded mr-12"
                                                    style={{ width: '40px', height: '40px', objectFit: 'cover', borderRadius: '4px', marginRight: '12px' }}
                                                />
                                            ) : (
                                                <Activity size={20} className="text-primary mr-12" style={{ marginRight: '12px' }} />
                                            )}
                                            <h3>{evaluacion.diagnostico || 'Sin diagnóstico'}</h3>
                                        </div>
                                    </div>

                                    <div className="lesion-body">
                                        <div className="lesion-stat mb-8">
                                            <Calendar size={16} className="text-muted mr-8" style={{ marginRight: '8px' }} />
                                            <span className="text-sm">Fecha: {formatDate(evaluacion.fecha)}</span>
                                        </div>
                                        {evaluacion.observaciones && (
                                            <p className="text-sm text-muted line-clamp-2">
                                                {evaluacion.observaciones}
                                            </p>
                                        )}
                                    </div>

                                    <div className="lesion-footer mt-16 pt-16 border-top">
                                        <Link to={`/lesiones/${evaluacion.id_lesion}`} className="btn btn-glass w-full">
                                            Ver Detalles Completos
                                        </Link>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

export default PacienteDetail;
