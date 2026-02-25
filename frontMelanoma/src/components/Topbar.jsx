import { Search, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Topbar.css';

const Topbar = () => {
    const { logout } = useAuth();

    return (
        <header className="topbar glass" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div className="search-container">
                <Search className="search-icon text-muted" size={20} />
                <input type="text" placeholder="Buscar pacientes, CURP, lesiones..." className="search-input" />
            </div>

            <div className="topbar-actions" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <button onClick={logout} className="btn badge-error btn-sm flex gap-8 items-center" style={{ backgroundColor: 'transparent', border: '1px solid var(--danger-color)', color: 'var(--danger-color)', cursor: 'pointer' }}>
                    <LogOut size={16} />
                    <span>Cerrar Sesión</span>
                </button>
            </div>
        </header>
    );
};

export default Topbar;
