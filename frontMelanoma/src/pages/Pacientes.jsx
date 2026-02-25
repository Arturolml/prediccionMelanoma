import { useState, useEffect } from 'react';
import { Search, Plus, FileText, User, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import './Pacientes.css';

const Pacientes = () => {
    const { currentUser, isAdmin, isMedico, isEnfermero } = useAuth();
    const [pacientes, setPacientes] = useState([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        // Solo cargar datos si no es admin, ya que el admin tiene otra vista
        if (!isAdmin) {
            fetchPacientes();
        }
    }, [isAdmin]);

    const fetchPacientes = async () => {
        try {
            setIsLoading(true);
            const data = await api.pacientes.getAll();
            setPacientes(data || []);
        } catch (err) {
            console.error("Error fetching pacientes:", err);
            setError('No se pudieron cargar los pacientes.');
        } finally {
            setIsLoading(false);
        }
    };

    if (isAdmin) {
        return (
            <div className="pacientes-page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
                <User size={48} className="text-danger" style={{ marginBottom: '16px' }} />
                <h2 className="text-gradient">Acceso Restringido</h2>
                <p className="text-muted">Por privacidad médica, los administradores no tienen acceso al listado ni expedientes de pacientes.</p>
            </div>
        );
    }

    // Lógica de Filtro basada en el rol (RBAC)
    const filteredPacientes = pacientes.filter(p => {
        if (isMedico) {
            // El médico solo ve a los pacientes que él registró
            return p.id_usuario_registro === currentUser?.id_usuario;
        }
        if (isEnfermero) {
            // Un enfermero ve pacientes (idealmente filtrados por asignación,
            // pero por ahora ve todos para poder apoyarlos)
            return true;
        }
        return false;
    });

    const calculateAge = (dob) => {
        if (!dob) return '-';
        const diffMs = Date.now() - new Date(dob).getTime();
        const ageDt = new Date(diffMs);
        return Math.abs(ageDt.getUTCFullYear() - 1970);
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '-';
        return new Date(dateStr).toLocaleDateString('es-MX', { year: 'numeric', month: '2-digit', day: '2-digit' });
    };

    return (
        <div className="pacientes-page">
            <div className="page-header">
                <div>
                    <h1 className="text-gradient">Pacientes Registrados</h1>
                    <p className="text-muted">Gestiona el historial clínico de los pacientes {isMedico ? 'a tu cargo' : isEnfermero ? 'asignados a ti' : ''}.</p>
                </div>
                {/* Solo los Médicos pueden registrar nuevos pacientes */}
                {isMedico && (
                    <Link to="/crear-paciente" className="btn btn-primary">
                        <Plus size={18} />
                        <span>Nuevo Paciente</span>
                    </Link>
                )}
            </div>

            <div className="glass-card page-content-card">
                <div className="toolbar">
                    <div className="search-box">
                        <Search size={18} className="text-muted" />
                        <input type="text" placeholder="Buscar por Nombre o CURP..." className="search-input-field" />
                    </div>
                    <div className="filters">
                        <select className="form-input" style={{ width: '200px' }}>
                            <option value="">Todos los sexos</option>
                            <option value="M">Masculino</option>
                            <option value="F">Femenino</option>
                        </select>
                    </div>
                </div>

                <div className="table-responsive">
                    {error && <div className="error-banner mb-4 p-4 text-center rounded text-danger bg-danger/10">{error}</div>}
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Paciente</th>
                                <th>CURP</th>
                                <th>Edad / Sexo</th>
                                <th>Fecha Registro</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-12">
                                        <Activity className="spin text-primary mx-auto mb-2" size={32} />
                                        <p className="text-muted">Cargando pacientes...</p>
                                    </td>
                                </tr>
                            ) : filteredPacientes.length === 0 ? (
                                <tr>
                                    <td colSpan="5" className="text-center py-24 text-muted">
                                        No se encontraron pacientes registrados en el sistema.
                                    </td>
                                </tr>
                            ) : (
                                filteredPacientes.map(p => (
                                    <tr key={p.id_paciente}>
                                        <td>
                                            <div className="patient-name-cell">
                                                <div className="avatar-sm"><User size={16} /></div>
                                                <span className="font-medium">{p.nombres} {p.apellido_paterno} {p.apellido_materno || ''}</span>
                                            </div>
                                        </td>
                                        <td className="text-muted font-mono">{p.curp}</td>
                                        <td>{calculateAge(p.fecha_nacimiento)} años • {p.sexo}</td>
                                        <td>{formatDate(p.fecha_registro)}</td>
                                        <td>
                                            <div className="action-buttons">
                                                <Link to={`/pacientes/${p.id_paciente}`} className="btn btn-glass btn-icon" title="Ver Expediente">
                                                    <FileText size={18} />
                                                </Link>
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

export default Pacientes;
