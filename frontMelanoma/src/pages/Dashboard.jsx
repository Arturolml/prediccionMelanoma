import { useState, useEffect } from 'react';
import { Activity, Users, AlertTriangle, ShieldAlert } from 'lucide-react';
import { api } from '../services/api';
import './Dashboard.css';

const StatCard = ({ title, value, icon: Icon, colorClass }) => (
    <div className={`glass-card stat-card ${colorClass}`}>
        <div className="stat-icon-wrapper glass">
            <Icon size={24} />
        </div>
        <div className="stat-info">
            <h3>{value}</h3>
            <p className="text-muted">{title}</p>
        </div>
    </div>
);

const Dashboard = () => {
    const [stats, setStats] = useState({
        totalPacientes: 0,
        totalEvaluaciones: 0,
        casosSospechosos: 0,
        casosMalignos: 0,
        recientes: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // En un caso real, el dashboard llamaría a varios endpoints o a uno que agregue todo
                const evaluacionesData = await api.evaluaciones.getStats();
                const pacientesData = await api.pacientes.getStats();

                setStats({
                    totalPacientes: pacientesData.totalPacientes,
                    totalEvaluaciones: evaluacionesData.totalEvaluaciones,
                    casosSospechosos: evaluacionesData.casosSospechosos,
                    casosMalignos: evaluacionesData.casosMalignos,
                    recientes: evaluacionesData.recientes
                });
            } catch (error) {
                console.error("Error al cargar datos del dashboard:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchDashboardData();
    }, []);

    if (loading) return <div className="dashboard"><div className="text-center p-8 mt-10"><Activity className="spin mx-auto text-primary" size={48} /><p className="mt-4 text-muted">Cargando datos del panel...</p></div></div>;

    return (
        <div className="dashboard">
            <div className="dashboard-header">
                <h1 className="text-gradient">Panel de Control</h1>
                <p className="text-muted">Resumen general de pacientes y evaluaciones del modelo IA.</p>
            </div>

            <div className="stats-grid">
                <StatCard title="Total Pacientes" value={stats.totalPacientes} icon={Users} colorClass="primary-stat" />
                <StatCard title="Evaluaciones (IA)" value={stats.totalEvaluaciones} icon={Activity} colorClass="info-stat" />
                <StatCard title="Casos Sospechosos" value={stats.casosSospechosos} icon={AlertTriangle} colorClass="warning-stat" />
                <StatCard title="Melanoma Detectado" value={stats.casosMalignos} icon={ShieldAlert} colorClass="danger-stat" />
            </div>

            <div className="dashboard-content">
                <div className="glass-card recent-evaluations">
                    <h2>Evaluaciones Recientes</h2>
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Paciente</th>
                                    <th>Fecha</th>
                                    <th>Predicción IA</th>
                                    <th>Diagnóstico Médico</th>
                                    <th>Acción</th>
                                </tr>
                            </thead>
                            <tbody>
                                {stats.recientes.map((evaluacion) => (
                                    <tr key={evaluacion.id_evaluacion}>
                                        <td className="font-medium">{evaluacion.paciente?.nombres || evaluacion.paciente || 'Desconocido'}</td>
                                        <td>{evaluacion.fecha_evaluacion ? new Date(evaluacion.fecha_evaluacion).toLocaleDateString() : evaluacion.fecha || '-'}</td>
                                        <td>
                                            <div className="progress-bar-container">
                                                <div
                                                    className={`progress-bar ${(evaluacion.prediccion_ia || evaluacion.ia || 0) >= 80 ? 'bg-danger' : (evaluacion.prediccion_ia || evaluacion.ia || 0) >= 50 ? 'bg-warning' : (evaluacion.prediccion_ia || evaluacion.ia || 0) >= 30 ? 'bg-indeterminado' : 'bg-success'}`}
                                                    style={{ width: `${evaluacion.prediccion_ia || evaluacion.ia || 0}%` }}
                                                ></div>
                                            </div>
                                            <span className="text-xs text-muted">{evaluacion.prediccion_ia || evaluacion.ia || 0}% Probabilidad</span>
                                        </td>
                                        <td>
                                            <span className={`badge badge-${(evaluacion.diagnostico_medico || 'Indeterminado').toLowerCase().split('_')[0]}`}>
                                                {(evaluacion.diagnostico_medico || 'Indeterminado').replace('_', '/')}
                                            </span>
                                        </td>
                                        <td>
                                            <button className="btn btn-glass btn-sm">Revisar</button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
