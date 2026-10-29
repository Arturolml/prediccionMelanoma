import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Save, UploadCloud, BrainCircuit, Stethoscope, Microscope, Activity, Smartphone } from 'lucide-react';
import { io } from 'socket.io-client';
import { api, getToken } from '../services/api';
import { useAuth } from '../context/AuthContext';
import ResultadoIA from '../components/ResultadoIA';
import { SITIOS_ANATOMICOS, etiquetaSitio } from '../constants/sitios';
import './CrearEvaluacion.css';

const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || 'https://liaaproyectos.uaz.edu.mx';
const SOCKET_PATH = import.meta.env.VITE_SOCKET_PATH || '/apiprediccion/socket.io';

const CrearEvaluacion = () => {
    const { id } = useParams(); // ID del paciente o de la lesión dependiendo del contexto
    const navigate = useNavigate();
    const location = useLocation();
    const isFromPaciente = location.pathname.includes('/pacientes/');

    const [formData, setFormData] = useState({
        // Datos de Lesión. sitio_anatomico es uno de los 16 valores del modelo de
        // Fusión; zona_cuerpo (texto en la base) se llena con su etiqueta.
        sitio_anatomico: '',
        fecha_deteccion: new Date().toISOString().split('T')[0], // YYYY-MM-DD
        notas_ubicacion: '',

        // Datos de Evaluación
        ruta_imagen: '',
        asimetria: false,
        bordes_irregulares: false,
        color_variable: false,
        diametro_mm: '',
        evolucion_cambios: false,
        sintoma_sangrado: false,
        sintoma_picazon: false,
        sintoma_dolor: false,
        sintoma_ulceracion: false,
        diagnostico_medico: '',
        notas_medico: '',
        requiere_biopsia: false
    });

    const { currentUser } = useAuth();
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [selectedFile, setSelectedFile] = useState(null);
    const [isWaitingMobilePhoto, setIsWaitingMobilePhoto] = useState(false);
    const [isLoadingIA, setIsLoadingIA] = useState(false);
    const [resultadoIA, setResultadoIA] = useState(null);
    const [lesion, setLesion] = useState(null);
    const socketRef = useRef(null);

    // Nueva evaluación de una lesión existente: se usa su sitio anatómico (las
    // lesiones anteriores a la Fase 14 quedaron en 'unknown' y aquí se puede corregir).
    useEffect(() => {
        if (isFromPaciente) return;
        api.lesiones.getById(id)
            .then(l => {
                setLesion(l);
                setFormData(prev => ({ ...prev, sitio_anatomico: l.sitio_anatomico || 'unknown' }));
            })
            .catch(() => setError('No se pudo cargar la lesión.'));
    }, [id, isFromPaciente]);

    useEffect(() => {
        if (!currentUser?.id_usuario) return;

        // El socket se autentica con el token de sesión; el backend lo une a la
        // sala de este usuario (ya no se elige la sala con un userId).
        socketRef.current = io(SOCKET_URL, { path: SOCKET_PATH, transports: ['websocket', 'polling'], auth: { token: getToken() } });

        socketRef.current.on('foto_recibida', (data) => {
            if (data && data.imageBase64) {
                try {
                    const base64String = data.imageBase64.includes('base64,')
                        ? data.imageBase64.split('base64,')[1]
                        : data.imageBase64;

                    const byteCharacters = atob(base64String);
                    const byteNumbers = new Array(byteCharacters.length);
                    for (let i = 0; i < byteCharacters.length; i++) {
                        byteNumbers[i] = byteCharacters.charCodeAt(i);
                    }
                    const byteArray = new Uint8Array(byteNumbers);
                    const blob = new Blob([byteArray], { type: 'image/jpeg' });

                    const file = new File([blob], `foto_movil_${Date.now()}.jpg`, { type: 'image/jpeg' });
                    setSelectedFile(file);
                    setResultadoIA(null);
                    setIsWaitingMobilePhoto(false);
                    setError('');
                } catch (err) {
                    console.error('Error procesando imagen base64:', err);
                    setError('Error al decodificar la foto recibida.');
                    setIsWaitingMobilePhoto(false);
                }
            }
        });

        return () => {
            if (socketRef.current) socketRef.current.disconnect();
        };
    }, [currentUser]);

    const requestMobileCamera = () => {
        if (socketRef.current) {
            setIsWaitingMobilePhoto(true);
            socketRef.current.emit('solicitar_camara_movil', {});
        } else {
            setError('Desconectado del servidor de tiempo real. Recarga la página.');
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'sitio_anatomico') setResultadoIA(null); // el análisis usó el sitio anterior
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
            setResultadoIA(null);
        }
    };

    const handlePredictLive = async () => {
        if (!selectedFile) {
            setError('Primero selecciona o toma una foto para analizarla con IA.');
            return;
        }

        setIsLoadingIA(true);
        setError('');

        try {
            // La IA usa edad y sexo del paciente (los busca el backend) y el sitio anatómico.
            const data = new FormData();
            data.append('imagen', selectedFile);
            data.append(isFromPaciente ? 'id_paciente' : 'id_lesion', id);
            if (formData.sitio_anatomico) data.append('sitio_anatomico', formData.sitio_anatomico);

            const result = await api.evaluaciones.predictLive(data);

            if (result && result.success) {
                // Los criterios ABCDE se prellenan con la sugerencia de la IA; el
                // médico los confirma o corrige antes de guardar.
                const aiData = result.data;
                setFormData(prev => ({
                    ...prev,
                    diametro_mm: aiData.diametro_mm ?? prev.diametro_mm,
                    asimetria: aiData.asimetria ?? prev.asimetria,
                    bordes_irregulares: aiData.bordes_irregulares ?? prev.bordes_irregulares,
                    color_variable: aiData.color_variable ?? prev.color_variable,
                }));
                setResultadoIA(result.ia);
            } else {
                setError('La IA no devolvió un formato válido.');
            }
        } catch (err) {
            console.error('Error al analizar con IA:', err);
            setError(err.message || 'Error al conectar con la Inteligencia Artificial.');
        } finally {
            setIsLoadingIA(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (!selectedFile) {
            setError('Por favor, selecciona una imagen fotográfica.');
            return;
        }

        setIsSaving(true);
        try {
            // Check if we are creating an evaluation directly on a lesion
            // For now, assume `id` coming from URL is the `id_lesion` if we are in `/lesiones/:id`
            // If we are in `/pacientes/:id`, we technically need to create a Lesion first...
            // the DTO expects `id_lesion`. Let's assume for this flow it's an existing lesion ID for simplicity or mock it if from patient.
            let lesionIdToUse = id;

            // Si el backend es estricto con id_lesion, y no lo tenemos (venimos de paciente directo),
            // primero creamos la lesión y obtenemos su ID para asociarle luego la evaluación.
            if (isFromPaciente) {
                const nuevaLesion = await api.lesiones.create({
                    id_paciente: Number(id),
                    zona_cuerpo: etiquetaSitio(formData.sitio_anatomico),
                    sitio_anatomico: formData.sitio_anatomico,
                    fecha_deteccion: new Date(formData.fecha_deteccion).toISOString(),
                    notas_ubicacion: formData.notas_ubicacion
                });
                lesionIdToUse = nuevaLesion.id_lesion;
            } else if (lesion && formData.sitio_anatomico && formData.sitio_anatomico !== lesion.sitio_anatomico) {
                await api.lesiones.update(id, { sitio_anatomico: formData.sitio_anatomico });
            }

            // Quién registra y el resultado de la IA los pone el backend.
            const data = new FormData();
            data.append('id_lesion', lesionIdToUse);
            data.append('imagen', selectedFile);

            const CAMPOS_LESION = ['sitio_anatomico', 'fecha_deteccion', 'notas_ubicacion', 'ruta_imagen'];
            Object.keys(formData).forEach(key => {
                if (!CAMPOS_LESION.includes(key)) {
                    data.append(key, formData[key]);
                }
            });

            await api.evaluaciones.create(data);

            alert('Evaluación médica registrada correctamente.');
            navigate(`/lesiones/${lesionIdToUse}`);

        } catch (err) {
            console.error("Error creating evaluacion:", err);
            setError(err.message || 'Error al guardar la evaluación. Verifica la consola.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="crear-eval-page">
            <div className="page-header">
                <div className="flex-col">
                    {isFromPaciente ? (
                        <Link to={`/pacientes/${id}`} className="back-link text-muted">
                            <ArrowLeft size={16} />
                            <span>Volver al Expediente del Paciente</span>
                        </Link>
                    ) : (
                        <Link to={`/lesiones/${id}`} className="back-link text-muted">
                            <ArrowLeft size={16} />
                            <span>Volver a la Lesión</span>
                        </Link>
                    )}
                    <div className="header-title-row">
                        <h1 className="text-gradient">Registrar Nueva Evaluación</h1>
                    </div>
                </div>
            </div>

            <div className="glass-card form-container">
                {error && <div className="error-banner mb-4 p-4 text-center rounded text-danger bg-danger/10">{error}</div>}
                <form onSubmit={handleSubmit} className="eval-form">
                    <div className="eval-grid-layout">

                        {/* Columna Izquierda: Datos de la Lesión, Imagen y IA */}
                        <div className="eval-col-left">

                            <div className="form-section">
                                <h3 className="section-title"><MapPin size={18} /> Datos de la Lesión Evaluada</h3>

                                {lesion && (
                                    <p className="text-sm text-muted mb-16">Lesión registrada como: {lesion.zona_cuerpo}</p>
                                )}
                                <div className="form-group">
                                    <label className="form-label">Sitio anatómico *</label>
                                    <select
                                        name="sitio_anatomico"
                                        value={formData.sitio_anatomico}
                                        onChange={handleChange}
                                        className="form-input"
                                        required
                                    >
                                        <option value="" disabled>Seleccionar...</option>
                                        {SITIOS_ANATOMICOS.map(s => (
                                            <option key={s.valor} value={s.valor}>{s.etiqueta}</option>
                                        ))}
                                    </select>
                                    <span className="text-xs text-muted">La IA lo usa junto con la edad y el sexo del paciente.</span>
                                </div>

                                {isFromPaciente && (<>
                                <div className="form-group mt-16">
                                    <label className="form-label">Fecha de Detección Original *</label>
                                    <div className="input-with-icon" style={{ position: 'relative' }}>
                                        <Calendar size={18} className="text-muted" style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }} />
                                        <input
                                            type="date"
                                            name="fecha_deteccion"
                                            value={formData.fecha_deteccion}
                                            onChange={handleChange}
                                            className="form-input"
                                            style={{ paddingLeft: '40px' }}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="form-group mt-16">
                                    <label className="form-label">Notas de Ubicación</label>
                                    <textarea
                                        name="notas_ubicacion"
                                        value={formData.notas_ubicacion}
                                        onChange={handleChange}
                                        className="form-input"
                                        rows="2"
                                        placeholder="Detalles sobre su localización..."
                                    ></textarea>
                                </div>
                                </>)}
                            </div>

                            <div className="form-section">
                                <h3 className="section-title"><UploadCloud size={18} /> Evidencia Fotográfica *</h3>

                                <button
                                    type="button"
                                    onClick={requestMobileCamera}
                                    className="btn btn-outline mb-16 w-full flex-center"
                                    disabled={isWaitingMobilePhoto}
                                >
                                    <Smartphone size={18} className="mr-8" />
                                    {isWaitingMobilePhoto ? 'Esperando foto desde el celular...' : 'Tomar Foto con Celular (App)'}
                                </button>

                                <div className={`image-upload-area relative ${isWaitingMobilePhoto ? 'opacity-50 pointer-events-none' : ''}`} style={{ position: 'relative' }}>
                                    <UploadCloud size={48} className="text-muted mb-16" />
                                    <p className="font-medium">O arrastra una imagen desde tu PC</p>

                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        style={{ position: 'absolute', inset: 0, opacity: 0, width: '100%', height: '100%', cursor: 'pointer' }}
                                    />
                                    {selectedFile ? (
                                        <div className="flex-col items-center">
                                            <p className="text-success mt-8 text-sm font-medium">✅ {selectedFile.name}</p>
                                        </div>
                                    ) : (
                                        <button type="button" className="btn btn-glass btn-sm mt-16 mt-4">Seleccionar Archivo</button>
                                    )}
                                </div>

                                {selectedFile && (
                                    <button
                                        type="button"
                                        onClick={handlePredictLive}
                                        className="btn mt-16 w-full flex-center"
                                        style={{ backgroundColor: '#4f46e5', color: 'white' }}
                                        disabled={isLoadingIA}
                                    >
                                        <BrainCircuit size={18} className="mr-8" />
                                        {isLoadingIA ? 'Analizando imagen...' : 'Analizar Imagen con IA'}
                                    </button>
                                )}
                            </div>

                            <div className="form-section">
                                <h3 className="section-title"><BrainCircuit size={18} /> Análisis IA</h3>
                                {resultadoIA ? (
                                    <ResultadoIA resultado={resultadoIA} />
                                ) : (
                                    <div className="ai-notice-box glass">
                                        <BrainCircuit size={24} className="text-primary mb-8" />
                                        <p className="text-sm text-center">
                                            Analice la imagen para ver la opinión de los dos modelos y prellenar los criterios ABCDE.
                                            Al guardar, la IA se vuelve a calcular y queda registrada con la evaluación.
                                        </p>
                                    </div>
                                )}
                            </div>

                        </div>

                        {/* Columna Derecha: Clínica */}
                        <div className="eval-col-right">

                            <div className="form-section">
                                <h3 className="section-title"><Stethoscope size={18} /> Criterios ABCDE (ABCD Rule)</h3>

                                <div className="toggles-grid-2">
                                    <div className="form-group toggle-group-vertical p-12">
                                        <div className="flex-between">
                                            <span className="font-medium text-sm">A - Asimetría</span>
                                            <label className="toggle-switch-sm">
                                                <input type="checkbox" name="asimetria" checked={formData.asimetria} onChange={handleChange} />
                                                <span className="slider-sm round danger-slider-sm"></span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="form-group toggle-group-vertical p-12">
                                        <div className="flex-between">
                                            <span className="font-medium text-sm">B - Bordes Irregulares</span>
                                            <label className="toggle-switch-sm">
                                                <input type="checkbox" name="bordes_irregulares" checked={formData.bordes_irregulares} onChange={handleChange} />
                                                <span className="slider-sm round danger-slider-sm"></span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="form-group toggle-group-vertical p-12">
                                        <div className="flex-between">
                                            <span className="font-medium text-sm">C - Color Variable</span>
                                            <label className="toggle-switch-sm">
                                                <input type="checkbox" name="color_variable" checked={formData.color_variable} onChange={handleChange} />
                                                <span className="slider-sm round danger-slider-sm"></span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="form-group toggle-group-vertical p-12">
                                        <div className="flex-between">
                                            <span className="font-medium text-sm">E - Evolución (Cambios)</span>
                                            <label className="toggle-switch-sm">
                                                <input type="checkbox" name="evolucion_cambios" checked={formData.evolucion_cambios} onChange={handleChange} />
                                                <span className="slider-sm round danger-slider-sm"></span>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="form-group mt-16">
                                    <label className="form-label">Predicción IA (Fusión)</label>
                                    {/* Solo lectura: la calcula el backend al guardar. */}
                                    <div className="form-input" style={{ opacity: 0.8 }}>
                                        {resultadoIA ? `${(100 * resultadoIA.fusion.prob_maligno).toFixed(1)}% · umbral ${(100 * resultadoIA.fusion.umbral).toFixed(1)}%` : 'Se calcula al analizar la imagen'}
                                    </div>
                                </div>

                                <div className="form-group mt-16">
                                    <label className="form-label">D - Diámetro (mm)</label>
                                    <input
                                        type="number"
                                        step="0.1"
                                        name="diametro_mm"
                                        value={formData.diametro_mm}
                                        onChange={handleChange}
                                        className="form-input"
                                        placeholder="Ej. 6.5"
                                    />
                                </div>
                            </div>

                            <div className="form-section">
                                <h3 className="section-title"><Microscope size={18} /> Síntomas del Paciente</h3>

                                <div className="sintomas-selector">
                                    <label className={`sintoma-chip ${formData.sintoma_sangrado ? 'active' : ''}`}>
                                        <input type="checkbox" name="sintoma_sangrado" checked={formData.sintoma_sangrado} onChange={handleChange} className="hidden-checkbox" />
                                        Sangrado
                                    </label>
                                    <label className={`sintoma-chip ${formData.sintoma_picazon ? 'active' : ''}`}>
                                        <input type="checkbox" name="sintoma_picazon" checked={formData.sintoma_picazon} onChange={handleChange} className="hidden-checkbox" />
                                        Picazón
                                    </label>
                                    <label className={`sintoma-chip ${formData.sintoma_dolor ? 'active' : ''}`}>
                                        <input type="checkbox" name="sintoma_dolor" checked={formData.sintoma_dolor} onChange={handleChange} className="hidden-checkbox" />
                                        Dolor
                                    </label>
                                    <label className={`sintoma-chip ${formData.sintoma_ulceracion ? 'active' : ''}`}>
                                        <input type="checkbox" name="sintoma_ulceracion" checked={formData.sintoma_ulceracion} onChange={handleChange} className="hidden-checkbox" />
                                        Ulceración
                                    </label>
                                </div>
                            </div>

                            <div className="form-section">
                                <h3 className="section-title">Diagnóstico y Conclusión</h3>

                                <div className="form-group">
                                    <label className="form-label">Diagnóstico Preliminar</label>
                                    <select
                                        name="diagnostico_medico"
                                        value={formData.diagnostico_medico}
                                        onChange={handleChange}
                                        className="form-input"
                                    >
                                        <option value="">Seleccionar...</option>
                                        <option value="Benigno">Benigno</option>
                                        <option value="Sospechoso">Sospechoso</option>
                                        <option value="Maligno_Melanoma">Maligno / Melanoma</option>
                                        <option value="Indeterminado">Indeterminado</option>
                                    </select>
                                </div>

                                <div className="form-group mt-16">
                                    <label className="form-label">Notas Médicas del Análisis</label>
                                    <textarea
                                        name="notas_medico"
                                        value={formData.notas_medico}
                                        onChange={handleChange}
                                        className="form-input"
                                        rows="3"
                                        placeholder="Observaciones dermatoscópicas..."
                                    ></textarea>
                                </div>

                                <div className="form-group toggle-group-vertical mt-16">
                                    <div className="flex-between">
                                        <div>
                                            <span className="font-medium text-danger">Requiere Biopsia</span>
                                            <span className="text-xs text-muted block">Marcar si requiere extracción.</span>
                                        </div>
                                        <label className="toggle-switch">
                                            <input type="checkbox" name="requiere_biopsia" checked={formData.requiere_biopsia} onChange={handleChange} />
                                            <span className="slider danger-slider"></span>
                                        </label>
                                    </div>
                                </div>
                            </div>

                        </div>
                    </div>

                    <div className="form-actions mt-32 border-top pt-24">
                        <button type="submit" className="btn btn-primary lg-btn" style={{ margin: '0 auto', display: 'flex' }} disabled={isSaving}>
                            <Save size={20} />
                            <span>{isSaving ? 'Guardando (la IA analiza la imagen)...' : 'Guardar Evaluación Completa'}</span>
                        </button>
                    </div>
                </form>
            </div>

        </div>
    );
};

export default CrearEvaluacion;
