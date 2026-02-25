import { NavLink } from 'react-router-dom';
import { Users, UserCircle, Activity, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Sidebar.css';

const Sidebar = () => {
    const { isAdmin, isMedico, currentUser } = useAuth();

    return (
        <aside className="sidebar glass">
            <div className="sidebar-header" style={{ padding: '20px 0', display: 'flex', justifyContent: 'center' }}>
                <img src="/logo.jpeg" alt="OncoScan Logo" style={{ maxWidth: '80%', maxHeight: '100px', objectFit: 'contain', borderRadius: '8px' }} />
            </div>

            <nav className="sidebar-nav">
                {isAdmin && (
                    <>
                        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
                            <UserPlus size={20} />
                            <span>Nuevo Usuario</span>
                        </NavLink>
                        <NavLink to="/usuarios" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                            <UserCircle size={20} />
                            <span>Lista Usuarios</span>
                        </NavLink>
                    </>
                )}

                {isMedico && (
                    <NavLink to="/crear-paciente" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <UserPlus size={20} />
                        <span>Nuevo Paciente</span>
                    </NavLink>
                )}

                {!isAdmin && (
                    <NavLink to="/pacientes" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
                        <Users size={20} />
                        <span>Lista Pacientes</span>
                    </NavLink>
                )}
            </nav>

            <div className="sidebar-footer">
                <div className="user-info glass-card">
                    <div className="avatar">
                        {(currentUser?.nombres?.[0] || 'U').toUpperCase()}
                        {(currentUser?.apellidos?.[0] || '').toUpperCase()}
                    </div>
                    <div className="details">
                        <span className="name">{currentUser?.nombres || 'Usuario'} {currentUser?.apellidos || ''}</span>
                        <span className="role badge badge-benigno" style={{ padding: '2px 8px', fontSize: '10px', marginTop: '4px' }}>
                            {currentUser?.tipo_rol || 'Invitado'}
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
};

export default Sidebar;
