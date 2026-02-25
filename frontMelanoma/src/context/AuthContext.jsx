import { createContext, useState, useContext } from 'react';

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    // Simulated users for testing the roles
    const demoUsers = [
        { id: 1, nombres: 'Super', apellidos: 'Admin', tipo_rol: 'admin', email: 'carlos@hospital.com', password: '123' },
        { id: 2, nombres: 'Ana', apellidos: 'Médico', tipo_rol: 'medico', email: 'ana@hospital.com', password: '123' },
        { id: 3, nombres: 'Juan', apellidos: 'Enfermero', tipo_rol: 'enfermero', email: 'juan@hospital.com', password: '123' },
    ];

    const [currentUser, setCurrentUser] = useState(() => {
        const savedUser = localStorage.getItem('userInfo');
        return savedUser ? JSON.parse(savedUser) : null;
    });

    const login = async (email, password) => {
        try {
            const { api } = await import('../services/api');
            const data = await api.auth.login(email, password);
            // El backend devuelve típicamente access_token o token, y datos de usuario.
            // Asumiendo que devuelve token y el payload decodificado o datos.
            const userStore = {
                ...data.user,
                token: data.access_token || data.token,
                tipo_rol: data.user?.rol || data.user?.tipo_rol || data.tipo_rol,
                nombres: data.user?.nombre_completo?.split(' ')[0] || data.user?.nombres || 'Usuario',
                apellidos: data.user?.nombre_completo?.split(' ').slice(1).join(' ') || data.user?.apellidos || ''
            };
            setCurrentUser(userStore);
            localStorage.setItem('userInfo', JSON.stringify(userStore));
            return true;
        } catch (error) {
            console.error("Login failed", error);
            return false;
        }
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('userInfo');
    };

    const isAdmin = currentUser?.tipo_rol === 'admin';
    const isMedico = currentUser?.tipo_rol === 'medico';
    const isEnfermero = currentUser?.tipo_rol === 'enfermero';

    return (
        <AuthContext.Provider value={{
            currentUser,
            login,
            logout,
            isAdmin,
            isMedico,
            isEnfermero
        }}>
            {children}
        </AuthContext.Provider>
    );
};
