import { useState } from 'react';
import { User, Calendar, Activity, Save, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import './CrearPaciente.css';

const CrearPaciente = () => {
    const [formData, setFormData] = useState({
        nombres: '',
        apellido_paterno: '',
        apellido_materno: '',
        curp: '',
        fecha_nacimiento: '',
        sexo: 'M',
        fototipo_fitzpatrick: 3,
        antecedentes_familiares: false,
        historial_cancer_previo: false,
        inmunosuprimido: false,
        notas_antecedentes: ''
    });
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleFitzpatrickChange = (level) => {
        setFormData(prev => ({ ...prev, fototipo_fitzpatrick: level }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');
        setIsSaving(true);

        try {
            await api.pacientes.create({
                ...formData,
                fecha_nacimiento: new Date(formData.fecha_nacimiento).toISOString(), // Format for backend
                fototipo_fitzpatrick: parseInt(formData.fototipo_fitzpatrick, 10)
            });

            setSuccessMessage('Paciente registrado correctamente en el sistema.');

            // Reset form
            setFormData({
                nombres: '',
                apellido_paterno: '',
                apellido_materno: '',
                curp: '',
                fecha_nacimiento: '',
                sexo: 'M',
                fototipo_fitzpatrick: 3,
                antecedentes_familiares: false,
                historial_cancer_previo: false,
                inmunosuprimido: false,
                notas_antecedentes: ''
            });

            // Clear success message after 3 seconds
            setTimeout(() => setSuccessMessage(''), 3000);
        } catch (err) {
            console.error("Error creating patient:", err);
            setError(err.message || 'Error al guardar el paciente. Verifique los datos.');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="crear-paciente-page">
            <div className="page-header">
                <div>
                    <h1 className="text-gradient">Registrar Nuevo Paciente</h1>
                    <p className="text-muted">Ingresa la información personal y antecedentes médicos del paciente.</p>
                </div>
            </div>

            <div className="glass-card form-container">
                {error && <div className="error-banner mb-4 p-4 text-center rounded">{error}</div>}
                {successMessage && <div className="success-banner mb-4 p-4 text-center rounded bg-success text-white font-medium">{successMessage}</div>}
                <form onSubmit={handleSubmit} className="paciente-form">

                    <div className="form-section">
                        <h3 className="section-title"><User size={18} /> Información Personal</h3>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Nombres *</label>
                                <input
                                    type="text"
                                    name="nombres"
                                    value={formData.nombres}
                                    onChange={handleChange}
                                    className="form-input"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Apellido Paterno *</label>
                                <input
                                    type="text"
                                    name="apellido_paterno"
                                    value={formData.apellido_paterno}
                                    onChange={handleChange}
                                    className="form-input"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Apellido Materno</label>
                                <input
                                    type="text"
                                    name="apellido_materno"
                                    value={formData.apellido_materno}
                                    onChange={handleChange}
                                    className="form-input"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">CURP *</label>
                                <input
                                    type="text"
                                    name="curp"
                                    value={formData.curp}
                                    onChange={handleChange}
                                    className="form-input uppercase"
                                    maxLength={18}
                                    placeholder="18 caracteres"
                                    required
                                />
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Fecha de Nacimiento *</label>
                                <div className="input-with-icon">
                                    <Calendar size={18} className="input-icon" />
                                    <input
                                        type="date"
                                        name="fecha_nacimiento"
                                        value={formData.fecha_nacimiento}
                                        onChange={handleChange}
                                        className="form-input pl-10"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Sexo *</label>
                                <select
                                    name="sexo"
                                    value={formData.sexo}
                                    onChange={handleChange}
                                    className="form-input"
                                    required
                                >
                                    <option value="M">Masculino (M)</option>
                                    <option value="F">Femenino (F)</option>
                                    <option value="Otro">Otro</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title"><Activity size={18} /> Historial Clínico Dermatológico</h3>

                        <div className="form-group full-width">
                            <label className="form-label">Fototipo de Piel (Escala Fitzpatrick) *</label>
                            <div className="fitzpatrick-selector">
                                {[1, 2, 3, 4, 5, 6].map(level => (
                                    <button
                                        key={level}
                                        type="button"
                                        className={`fitz-btn fitz-type-${level} ${formData.fototipo_fitzpatrick === level ? 'active' : ''}`}
                                        onClick={() => handleFitzpatrickChange(level)}
                                    >
                                        Tipo {level}
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-muted mt-2">Seleccione el tipo de piel según la reacción a la exposición solar.</p>
                        </div>

                        <div className="toggles-grid">
                            <div className="form-group toggle-group-vertical">
                                <div className="flex-between">
                                    <div>
                                        <span className="font-medium flex align-center gap-2"><ShieldAlert size={16} className="text-warning" /> Antecedentes Familiares</span>
                                        <span className="text-xs text-muted block mt-1">¿Historia de melanoma en familia?</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            name="antecedentes_familiares"
                                            checked={formData.antecedentes_familiares}
                                            onChange={handleChange}
                                        />
                                        <span className="slider danger-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div className="form-group toggle-group-vertical">
                                <div className="flex-between">
                                    <div>
                                        <span className="font-medium flex align-center gap-2"><ShieldAlert size={16} className="text-warning" /> Cáncer Previo</span>
                                        <span className="text-xs text-muted block mt-1">¿Historial personal de cáncer?</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            name="historial_cancer_previo"
                                            checked={formData.historial_cancer_previo}
                                            onChange={handleChange}
                                        />
                                        <span className="slider danger-slider"></span>
                                    </label>
                                </div>
                            </div>

                            <div className="form-group toggle-group-vertical">
                                <div className="flex-between">
                                    <div>
                                        <span className="font-medium flex align-center gap-2"><ShieldAlert size={16} className="text-warning" /> Inmunosuprimido</span>
                                        <span className="text-xs text-muted block mt-1">¿Toma o enfermedad inmunosupresora?</span>
                                    </div>
                                    <label className="toggle-switch">
                                        <input
                                            type="checkbox"
                                            name="inmunosuprimido"
                                            checked={formData.inmunosuprimido}
                                            onChange={handleChange}
                                        />
                                        <span className="slider danger-slider"></span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        <div className="form-group full-width mt-4">
                            <label className="form-label">Notas Adicionales de Antecedentes</label>
                            <textarea
                                name="notas_antecedentes"
                                value={formData.notas_antecedentes}
                                onChange={handleChange}
                                className="form-input"
                                rows="3"
                                placeholder="Especifique detalles médicos relevantes..."
                            ></textarea>
                        </div>
                    </div>

                    <div className="form-actions border-top">
                        <button type="submit" className="btn btn-primary lg-btn" disabled={isSaving}>
                            {isSaving ? <Activity className="spin" size={20} /> : <Save size={20} />}
                            <span>{isSaving ? 'Guardando...' : 'Guardar Paciente'}</span>
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CrearPaciente;
