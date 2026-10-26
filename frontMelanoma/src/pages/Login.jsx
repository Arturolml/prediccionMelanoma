import { useState } from 'react';
import { Activity, Mail, Lock, LogIn } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import './Login.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const { login } = useAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const success = await login(email, password);

            if (!success) {
                setError('Credenciales incorrectas. Intenta nuevamente.');
            }
        } catch (err) {
            setError('Ocurrió un error al intentar iniciar sesión.');
        } finally {
            setIsLoading(false);
        }
    };



    return (
        <div className="login-page">
            <div className="login-container glass-card">
                <div className="login-header" style={{ display: 'flex', justifyContent: 'center', marginBottom: '1.5rem' }}>
                    <img src={`${import.meta.env.BASE_URL}logo.jpeg`} alt="OncoScan Logo" style={{ maxWidth: '200px', maxHeight: '100px', objectFit: 'contain', borderRadius: '12px' }} />
                </div>

                {error && <div className="error-banner">{error}</div>}

                <form onSubmit={handleSubmit} className="login-form">
                    <div className="form-group">
                        <label className="form-label">Correo Electrónico Institucional</label>
                        <div className="input-with-icon">
                            <Mail size={18} className="input-icon text-muted" />
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="form-input pl-10"
                                placeholder="usuario@hospital.com"
                                required
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <div className="flex-between">
                            <label className="form-label m-0">Contraseña</label>
                            <a href="#" className="forgot-link">¿Olvidaste tu contraseña?</a>
                        </div>
                        <div className="input-with-icon mt-8">
                            <Lock size={18} className="input-icon text-muted" />
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="form-input pl-10"
                                placeholder="••••••••"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary w-full justify-center login-btn"
                        disabled={isLoading}
                    >
                        {isLoading ? <Activity className="spin" size={20} /> : <LogIn size={20} />}
                        <span>{isLoading ? 'Autenticando...' : 'Iniciar Sesión'}</span>
                    </button>
                </form>


            </div>

            <div className="login-bg-shapes">
                <div className="shape shape-1"></div>
                <div className="shape shape-2"></div>
            </div>
        </div>
    );
};

export default Login;
