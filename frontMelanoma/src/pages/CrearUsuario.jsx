import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCheck, Stethoscope, ShieldPlus, UserPlus, Save, Activity } from 'lucide-react';
import { api } from '../services/api';
import './CrearUsuario.css';

const CrearUsuario = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        nombre_completo: '',
        email: '',
        password: '',
        confirmPassword: '',
        rol: 'medico',
        cedula_profesional: '',
        telefono_contacto: '',
        activo: true
    });
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (formData.password !== formData.confirmPassword) {
            setError("Las contraseñas no coinciden");
            return;
        }

        setIsLoading(true);
        try {
            await api.usuarios.create({
                nombre_completo: formData.nombre_completo,
                email: formData.email,
                password: formData.password,
                rol: formData.rol,
                cedula_profesional: formData.cedula_profesional,
                telefono_contacto: formData.telefono_contacto,
                activo: formData.activo
            });
            
            setSuccess('Usuario creado correctamente');

            // Reset form
            setFormData({
                nombre_completo: '',
                email: '',
                password: '',
                confirmPassword: '',
                rol: 'medico',
                cedula_profesional: '',
                telefono_contacto: '',
                activo: true
            });
            
            setTimeout(() => {
                setSuccess('');
                navigate('/usuarios');
            }, 1500);
        } catch (err) {
            console.error("Error creating user:", err);
            setError(err.message || 'Error al intentar crear el usuario');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="crear-usuario-page">
            <div className="page-header">
                <div>
                    <h1 className="text-gradient">Registrar Nuevo Usuario</h1>
                    <p className="text-muted">Crea cuentas para médicos, enfermeros o administradores del sistema.</p>
                </div>
            </div>

            <div className="glass-card form-container">
                {error && <div className="error-banner mb-4 p-4 text-center rounded text-danger bg-danger/10">{error}</div>}
                {success && <div className="success-banner mb-4 p-4 text-center rounded text-success bg-success/10" style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '1rem', borderRadius: '0.5rem', marginBottom: '1rem' }}>{success}</div>}

                <form onSubmit={handleSubmit} className="usuario-form">

                    <div className="form-section">
                        <h3 className="section-title"><UserPlus size={18} /> Información Personal</h3>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Nombre Completo *</label>
                                <input
                                    type="text"
                                    name="nombre_completo"
                                    value={formData.nombre_completo}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Ej. Dra. Ana García"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Correo Electrónico *</label>
                                <input
                                    type="email"
                                    name="email"
                                    value={formData.email}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="usuario@hospital.com"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Teléfono de Contacto</label>
                                <input
                                    type="tel"
                                    name="telefono_contacto"
                                    value={formData.telefono_contacto}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="+52 55..."
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h3 className="section-title"><ShieldPlus size={18} /> Roles y Autenticación</h3>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Rol en el Sistema *</label>
                                <div className="role-selector">
                                    <label className={`role-card ${formData.rol === 'admin' ? 'active' : ''}`}>
                                        <input type="radio" name="rol" value="admin" checked={formData.rol === 'admin'} onChange={handleChange} className="hidden-radio" />
                                        <ShieldPlus size={24} className="role-icon" />
                                        <span className="role-name">Admin</span>
                                    </label>

                                    <label className={`role-card ${formData.rol === 'medico' ? 'active' : ''}`}>
                                        <input type="radio" name="rol" value="medico" checked={formData.rol === 'medico'} onChange={handleChange} className="hidden-radio" />
                                        <Stethoscope size={24} className="role-icon" />
                                        <span className="role-name">Médico</span>
                                    </label>

                                    <label className={`role-card ${formData.rol === 'enfermero' ? 'active' : ''}`}>
                                        <input type="radio" name="rol" value="enfermero" checked={formData.rol === 'enfermero'} onChange={handleChange} className="hidden-radio" />
                                        <UserCheck size={24} className="role-icon" />
                                        <span className="role-name">Enfermero</span>
                                    </label>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">Cédula Profesional</label>
                                <input
                                    type="text"
                                    name="cedula_profesional"
                                    value={formData.cedula_profesional}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="Sólo requerido para médicos o especialistas"
                                />
                                <span className="text-xs text-muted" style={{ display: 'block', marginTop: '6px' }}>*Si el rol no es médico, se puede dejar en blanco.</span>
                            </div>
                        </div>

                        <div className="form-grid">
                            <div className="form-group">
                                <label className="form-label">Contraseña *</label>
                                <input
                                    type="password"
                                    name="password"
                                    value={formData.password}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Confirmar Contraseña *</label>
                                <input
                                    type="password"
                                    name="confirmPassword"
                                    value={formData.confirmPassword}
                                    onChange={handleChange}
                                    className="form-input"
                                    placeholder="••••••••"
                                    required
                                />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <div className="form-group toggle-group">
                            <label className="toggle-switch">
                                <input
                                    type="checkbox"
                                    name="activo"
                                    checked={formData.activo}
                                    onChange={handleChange}
                                />
                                <span className="slider"></span>
                            </label>
                            <div>
                                <span className="font-medium" style={{ display: 'block' }}>Usuario Activo</span>
                                <span className="text-xs text-muted">Si está desactivado, el usuario no podrá inciar sesión en el sistema.</span>
                            </div>
                        </div>
                    </div>

                    <div className="form-actions border-top">
                        <button type="submit" className="btn btn-primary lg-btn" disabled={isLoading}>
                            {isLoading ? <Activity className="spin" size={20} /> : <Save size={20} />}
                            <span>{isLoading ? 'Guardando...' : 'Guardar Usuario'}</span>
                        </button>
                    </div>

                </form>
            </div>
        </div>
    );
};

export default CrearUsuario;
