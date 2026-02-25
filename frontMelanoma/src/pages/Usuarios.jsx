import { useState, useEffect } from 'react';
import { Search, UserPlus, ShieldPlus, Stethoscope, Key, Power, Activity } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import './Usuarios.css';

const Usuarios = () => {
    const { isAdmin } = useAuth();
    const [usuarios, setUsuarios] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        if (isAdmin) {
            fetchUsuarios();
        }
    }, [isAdmin]);

    const fetchUsuarios = async () => {
        try {
            setIsLoading(true);
            const data = await api.usuarios.getAll();
            setUsuarios(data || []);
        } catch (err) {
            console.error("Error fetching usuarios:", err);
            setError('No se pudieron cargar los usuarios.');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isAdmin) {
        return (
            <div className="usuarios-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <ShieldPlus size={48} className="text-danger" style={{ marginBottom: '16px' }} />
                <h2 className="text-gradient">Acceso Restringido</h2>
                <p className="text-muted">Esta sección es exclusiva para el personal Administrador.</p>
            </div>
        );
    }

    const getRoleIcon = (rol) => {
        switch (rol) {
            case 'admin': return <ShieldPlus size={16} />;
            case 'medico': return <Stethoscope size={16} />;
            default: return <UserPlus size={16} />;
        }
    };

    const toggleUsuario = async (id, estadoActual) => {
        try {
            const nuevoEstado = !estadoActual;
            await api.usuarios.toggleStatus(id, nuevoEstado);
            setUsuarios(prev => prev.map(u => {
                if (u.id_usuario === id) {
                    return { ...u, activo: nuevoEstado };
                }
                return u;
            }));
        } catch (err) {
            console.error("Error toggling status", err);
            alert("Hubo un error al cambiar el estado del usuario.");
        }
    };

    const cambiarPassword = async (id, nombre) => {
        const newPass = prompt(`Ingrese la nueva contraseña para ${nombre}:`);
        if (newPass) {
            try {
                await api.usuarios.updatePassword(id, newPass);
                alert(`Contraseña actualizada exitosamente para ${nombre}`);
            } catch (err) {
                console.error("Error changing password", err);
                alert("Hubo un error al actualizar la contraseña.");
            }
        }
    };

    return (
        <div className="usuarios-page">
            <div className="page-header">
                <div>
                    <h1 className="text-gradient">Personal Médico</h1>
                    <p className="text-muted">Administración de usuarios, contraseñas y accesos.</p>
                </div>
            </div>

            <div className="glass-card page-content-card">
                <div className="toolbar">
                    <div className="search-box">
                        <Search size={18} className="text-muted" />
                        <input type="text" placeholder="Buscar por Nombre o Email..." className="search-input-field" />
                    </div>
                    <div className="filters">
                        <select className="form-input" style={{ width: '200px' }}>
                            <option value="">Todos los roles</option>
                            <option value="admin">Administrador</option>
                            <option value="medico">Médico</option>
                            <option value="enfermero">Enfermero</option>
                        </select>
                    </div>
                </div>

                <div className="table-responsive">
                    {error && <div className="error-banner mb-4 p-4 text-center rounded text-danger bg-danger/10">{error}</div>}
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Usuario</th>
                                <th>Contacto</th>
                                <th>Rol / Cédula</th>
                                <th>Estado</th>
                                <th>Acciones Rápidas</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-12">
                                        <Activity className="spin text-primary mx-auto mb-2" size={32} />
                                        <p className="text-muted">Cargando usuarios...</p>
                                    </td>
                                </tr>
                            ) : usuarios.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-24 text-muted">
                                        No se encontraron usuarios registrados en el sistema.
                                    </td>
                                </tr>
                            ) : (
                                usuarios.map(u => (
                                    <tr key={u.id_usuario} className={!u.activo ? 'inactive-row' : ''}>
                                        <td>
                                            <div className="font-medium">{u.nombre_completo}</div>
                                        </td>
                                        <td className="text-muted">{u.email}</td>
                                        <td>
                                            <div className={`role-badge role-${u.rol}`}>
                                                {getRoleIcon(u.rol)}
                                                <span style={{ textTransform: 'capitalize' }}>{u.rol}</span>
                                            </div>
                                            {u.cedula_profesional && <div className="font-mono text-muted text-xs mt-1">{u.cedula_profesional}</div>}
                                        </td>
                                        <td>
                                            <div className="status-container">
                                                <label className="toggle-switch-sm">
                                                    <input
                                                        type="checkbox"
                                                        checked={u.activo}
                                                        onChange={() => toggleUsuario(u.id_usuario, u.activo)}
                                                    />
                                                    <span className="slider-sm round"></span>
                                                </label>
                                                <span className={`text-sm ${u.activo ? 'text-success' : 'text-muted'}`}>
                                                    {u.activo ? 'Activo' : 'Inactivo'}
                                                </span>
                                            </div>
                                        </td>
                                        <td>
                                            <div className="action-buttons">
                                                <button
                                                    className="btn btn-glass btn-icon"
                                                    title="Cambiar Contraseña"
                                                    onClick={() => cambiarPassword(u.id_usuario, u.nombre_completo)}
                                                >
                                                    <Key size={16} />
                                                </button>
                                                <button
                                                    className="btn btn-glass btn-icon"
                                                    title={u.activo ? "Desactivar Usuario" : "Activar Usuario"}
                                                    onClick={() => toggleUsuario(u.id_usuario, u.activo)}
                                                >
                                                    <Power size={16} className={u.activo ? "text-danger" : "text-success"} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

export default Usuarios;
