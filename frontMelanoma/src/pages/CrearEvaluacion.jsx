import { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate, useLocation } from 'react-router-dom';
import { ArrowLeft, MapPin, Calendar, Save, UploadCloud, BrainCircuit, Stethoscope, Microscope, Activity, Smartphone } from 'lucide-react';
import { io } from 'socket.io-client';
import { api } from '../services/api';
import { useAuth } from '../context/AuthContext';
import './CrearEvaluacion.css';

const CrearEvaluacion = () => {
    const { id } = useParams(); // ID del paciente o de la lesión dependiendo del contexto
    const navigate = useNavigate();
    const location = useLocation();
    const isFromPaciente = location.pathname.includes('/pacientes/');

    const [formData, setFormData] = useState({
        // Datos de Lesión
        zona_cuerpo: '',
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
    const socketRef = useRef(null);

    useEffect(() => {
        if (!currentUser?.id_usuario) return;

        socketRef.current = io('http://localhost:3007');

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join_room', { userId: currentUser.id_usuario });
        });

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
            socketRef.current.emit('solicitar_camara_movil', { userId: currentUser.id_usuario });
        } else {
            setError('Desconectado del servidor de tiempo real. Recarga la página.');
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            setSelectedFile(e.target.files[0]);
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
                    zona_cuerpo: formData.zona_cuerpo,
                    fecha_deteccion: new Date(formData.fecha_deteccion).toISOString(),
                    notas_ubicacion: formData.notas_ubicacion
                });
                lesionIdToUse = nuevaLesion.id_lesion;
            }

            const data = new FormData();
            data.append('id_lesion', lesionIdToUse);
            data.append('id_usuario_registro', currentUser?.id_usuario || 1);
            data.append('id_medico_validador', currentUser?.id_usuario || 1); // Mock mismo validador por ahora

            data.append('imagen', selectedFile);

            // Appending all booleans and strings
            Object.keys(formData).forEach(key => {
                if (key !== 'zona_cuerpo' && key !== 'fecha_deteccion' && key !== 'notas_ubicacion' && key !== 'ruta_imagen') {
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

                                <div className="form-group">
                                    <label className="form-label">Zona del Cuerpo *</label>
                                    <input
                                        type="text"
                                        name="zona_cuerpo"
                                        value={formData.zona_cuerpo}
                                        onChange={handleChange}
                                        className="form-input"
                                        placeholder="Ej. Espalda Alta..."
                                        maxLength={100}
                                        required
                                    />
                                </div>

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
                                        <p className="text-success mt-8 text-sm font-medium">✅ {selectedFile.name}</p>
                                    ) : (
                                        <button type="button" className="btn btn-glass btn-sm mt-16 mt-4">Seleccionar Archivo</button>
                                    )}
                                </div>
                            </div>

                            <div className="form-section">
                                <h3 className="section-title"><BrainCircuit size={18} /> Análisis IA (Automático)</h3>
                                <div className="ai-notice-box glass">
                                    <BrainCircuit size={24} className="text-primary mb-8" />
                                    <p className="text-sm text-center">La predicción del modelo experto (Melanoma &gt;80%) se generará automáticamente después de guardar.</p>
                                </div>
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
                        <button type="submit" className="btn btn-primary lg-btn" style={{ margin: '0 auto', display: 'flex' }}>
                            <Save size={20} />
                            <span>Guardar Evaluación Completa</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default CrearEvaluacion;
