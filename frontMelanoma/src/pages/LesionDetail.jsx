import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Calendar, FileImage, CheckCircle, AlertTriangle, ShieldAlert, Activity, ClipboardList } from 'lucide-react';
import { api } from '../services/api';
import ImagenProtegida from '../components/ImagenProtegida';
import './LesionDetail.css';

const DiagnosticBadge = ({ type }) => {
    if (!type) {
        return <span className="badge badge-indeterminado"><Activity size={14} /> Indeterminado</span>;
    }

    const types = {
        'Benigno': { icon: CheckCircle, class: 'badge-benigno' },
        'Sospechoso': { icon: AlertTriangle, class: 'badge-sospechoso' },
        'Maligno_Melanoma': { icon: ShieldAlert, class: 'badge-maligno' },
        'Indeterminado': { icon: Activity, class: 'badge-indeterminado' }
    };

    // Default to indeterminado if not standard
    let config = types['Indeterminado'];
    let displayType = type;

    if (type.toLowerCase().includes('benigno')) config = types['Benigno'];
    else if (type.toLowerCase().includes('sospechoso')) config = types['Sospechoso'];
    else if (type.toLowerCase().includes('maligno') || type.toLowerCase().includes('melanoma')) config = types['Maligno_Melanoma'];

    const Icon = config.icon;

    return (
        <span className={`badge ${config.class}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Icon size={14} />
            {displayType.replace('_', ' / ')}
        </span>
    );
};

const FeatureList = ({ items, type }) => (
    <div className="feature-grid">
        {Object.entries(items).map(([key, val]) => (
            <div key={key} className={`feature-item ${val ? 'active' : ''}`}>
                <span className="feature-dot"></span>
                <span className="feature-name">{key.replace(/_/g, ' ')}</span>
                {type === 'number' ? (
                    <span className="feature-value">{val} mm</span>
                ) : (
                    <span className="feature-value">{val ? 'Sí' : 'No'}</span>
                )}
            </div>
        ))}
    </div>
);

const LesionDetail = () => {
    const { id } = useParams();
    const [lesion, setLesion] = useState(null);
    const [evaluaciones, setEvaluaciones] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchLesionData = async () => {
            try {
                setIsLoading(true);
                const fetchedLesion = await api.lesiones.getById(id);
                setLesion(fetchedLesion);

                // Fetch evaluaciones for this lesion
                const fetchedEvals = await api.evaluaciones.getAll({ id_lesion: id });
                // We assume fetchedEvals is array. Sort latest first.
                if (Array.isArray(fetchedEvals)) {
                    fetchedEvals.sort((a, b) => new Date(b.fecha_evaluacion) - new Date(a.fecha_evaluacion));
                }
                setEvaluaciones(fetchedEvals || []);
            } catch (err) {
                console.error("Error fetching lesion details:", err);
                setError('No se pudo cargar la información de la lesión.');
            } finally {
                setIsLoading(false);
            }
        };

        fetchLesionData();
    }, [id]);

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleString('es-MX', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    if (isLoading) {
        return (
            <div className="lesion-detail-page flex-center min-h-screen">
                <Activity className="spin text-primary" size={32} />
                <p className="ml-4 text-muted">Cargando detalles de la lesión...</p>
            </div>
        );
    }

    if (error || !lesion) {
        return (
            <div className="lesion-detail-page flex-col flex-center min-h-screen">
                <div className="error-banner mb-4 p-4 text-center rounded text-danger bg-danger/10">{error || 'Lesión no encontrada.'}</div>
                <Link to="/pacientes" className="btn btn-outline text-muted">
                    <ArrowLeft size={16} /> Volver a Pacientes
                </Link>
            </div>
        );
    }

    return (
        <div className="lesion-detail-page">
            <div className="page-header">
                <div className="flex-col">
                    <Link to={`/pacientes/${lesion.id_paciente}`} className="back-link text-muted">
                        <ArrowLeft size={16} />
                        <span>Volver al Expediente del Paciente</span>
                    </Link>
                    <div className="header-title-row">
                        <h1 className="text-gradient">Lesión: {lesion.zona_cuerpo}</h1>
                        <DiagnosticBadge type={lesion.diagnostico_actual} />
                    </div>
                </div>
                <Link to={`/lesiones/${id}/nueva-evaluacion`} className="btn btn-primary">
                    <ClipboardList size={18} />
                    <span>Nueva Evaluación</span>
                </Link>
            </div>

            <div className="glass-card mb-24">
                <div className="lesion-meta">
                    <div className="meta-item">
                        <Calendar size={18} className="text-muted" />
                        <div>
                            <div className="meta-label">Fecha Detección</div>
                            <div className="font-medium">{formatDate(lesion.fecha_deteccion)}</div>
                        </div>
                    </div>
                    <div className="meta-item">
                        <Activity size={18} className="text-muted" />
                        <div>
                            <div className="meta-label">Total Evaluaciones</div>
                            <div className="font-medium">{evaluaciones.length}</div>
                        </div>
                    </div>
                    {lesion.notas_ubicacion && (
                        <div className="meta-item notes-item">
                            <div className="meta-label">Notas de Ubicación:</div>
                            <div className="text-muted text-sm mt-1">{lesion.notas_ubicacion}</div>
                        </div>
                    )}
                </div>
            </div>

            <h2 className="section-title">Historial de Evaluaciones</h2>

            <div className="evaluaciones-timeline">
                {evaluaciones.length === 0 ? (
                    <div className="glass-card text-center py-12 text-muted">
                        No hay evaluaciones registradas para esta lesión.
                    </div>
                ) : (
                    evaluaciones.map((ev) => (
                        <div key={ev.id_evaluacion} className="timeline-item">
                            <div className="timeline-marker"></div>
                            <div className="timeline-content glass-card">
                                <div className="eval-header">
                                    <div>
                                        <h3 className="eval-date">{formatDate(ev.fecha_evaluacion)}</h3>
                                        {/* Backend might not return the doctor's name directly without join, so we omit or handle if possible */}
                                        <p className="text-muted text-sm">Validado por ID Médico: {ev.id_medico_validador || 'Pendiente'}</p>
                                    </div>
                                    <DiagnosticBadge type={ev.diagnostico} />
                                </div>

                                <div className="eval-grid">
                                    <div className="eval-ai-box">
                                        <div className="ai-label">Predicción IA (Melanoma)</div>
                                        <div className="ai-score">
                                            {ev.prediccion_ia != null ? (
                                                <>
                                                    <span className={`text-gradient ${ev.prediccion_ia > 80 ? 'text-danger' : ev.prediccion_ia > 50 ? 'text-warning' : 'text-success'}`} style={{ fontSize: '2rem', fontWeight: 'bold' }}>
                                                        {Math.round(ev.prediccion_ia)}%
                                                    </span>
                                                    <div className="progress-bar-container" style={{ width: '100%', marginTop: '8px' }}>
                                                        <div
                                                            className={`progress-bar ${ev.prediccion_ia > 80 ? 'bg-danger' : ev.prediccion_ia > 50 ? 'bg-warning' : 'bg-success'}`}
                                                            style={{ width: `${ev.prediccion_ia}%` }}
                                                        ></div>
                                                    </div>
                                                </>
                                            ) : (
                                                <span className="text-muted" style={{ fontSize: '1rem' }}>No disponible</span>
                                            )}
                                        </div>
                                    </div>

                                    <div className="eval-features">
                                        <h4>Criterios ABCDE</h4>
                                        <FeatureList
                                            items={{
                                                'Asimetría': ev.asimetria,
                                                'Bordes Irreg.': ev.bordes_irregulares,
                                                'Color Variable': ev.color_variable,
                                                'Evolución': ev.evolucion_cambios
                                            }}
                                        />
                                        <div className="mt-2 text-sm">
                                            Diámetro: <span className="font-medium">{ev.diametro_mm ? `${ev.diametro_mm} mm` : 'N/A'}</span>
                                        </div>
                                    </div>

                                    <div className="eval-symptoms">
                                        <h4>Síntomas</h4>
                                        <FeatureList items={{
                                            'Sangrado': ev.sintoma_sangrado,
                                            'Picazón': ev.sintoma_picazon,
                                            'Dolor': ev.sintoma_dolor,
                                            'Ulceración': ev.sintoma_ulceracion
                                        }} />
                                    </div>

                                    <div className="eval-image">
                                        {ev.ruta_imagen ? (
                                            <ImagenProtegida comoFondo idEvaluacion={ev.id_evaluacion} className="image-placeholder glass" style={{ opacity: 0.8 }} />
                                        ) : (
                                            <div className="image-placeholder glass" style={{ background: 'rgba(0,0,0,0.3)' }}>
                                                <span className="text-xs text-muted flex-center h-full w-full">Sin Imagen</span>
                                            </div>
                                        )}
                                        <div className="text-center mt-2">
                                            <span className="text-xs text-muted">Imagen Clínica - {formatDate(ev.fecha_evaluacion).split(',')[0]}</span>
                                        </div>
                                    </div>
                                </div>

                                {(ev.notas_clinicas || ev.requiere_biopsia) && (
                                    <div className="eval-notes mt-16 pt-16 border-top">
                                        {ev.notas_clinicas && (
                                            <>
                                                <h4 className="text-sm mb-1 text-muted">Notas Clínicas:</h4>
                                                <p className="text-sm">{ev.notas_clinicas}</p>
                                            </>
                                        )}
                                        {ev.requiere_biopsia && <div className="mt-2 badge badge-maligno" style={{ display: 'inline-block' }}>Requiere Biopsia</div>}
                                    </div>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

export default LesionDetail;
