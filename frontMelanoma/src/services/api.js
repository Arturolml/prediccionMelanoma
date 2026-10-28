export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3007';

// Token del usuario en sesión (guardado por AuthContext en localStorage).
export const getToken = () => {
    try {
        return JSON.parse(localStorage.getItem('userInfo') || 'null')?.token || null;
    } catch (e) {
        console.error("Error parsing userInfo from localStorage", e);
        return null;
    }
};

// Función auxiliar para realizar peticiones HTTP
const fetchWithAuth = async (endpoint, options = {}) => {
    const token = getToken();

    const headers = {
        'Content-Type': 'application/json',
        ...options.headers,
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
        ...options,
        headers,
    };

    const response = await fetch(`${API_URL}${endpoint}`, config);
    if (!response.ok) {
        // Podríamos manejar errores globales aquí (ej. token expirado 401)
        throw new Error(`Error en la petición: ${response.status} ${response.statusText}`);
    }
    return response.json();
};

export const api = {
    auth: {
        login: async (email, password) => {
            const response = await fetch(`${API_URL}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password }),
            });
            if (!response.ok) {
                throw new Error('Credenciales inválidas');
            }
            return response.json();
        }
    },
    evaluaciones: {
        getAll: (params = {}) => {
            const query = new URLSearchParams(params).toString();
            return fetchWithAuth(query ? `/evaluaciones?${query}` : '/evaluaciones');
        },
        getStats: async () => {
            // Opcional: El backend podría tener un endpoint específico para stats.
            // Si no lo tiene, simulamos obteniendo todas y calculando.
            try {
                const evaluaciones = await fetchWithAuth('/evaluaciones');
                const total = evaluaciones.length;
                const malignos = evaluaciones.filter(e => e.diagnostico_medico && e.diagnostico_medico.toLowerCase().includes('maligno')).length;
                const sospechosos = evaluaciones.filter(e => e.diagnostico_medico && e.diagnostico_medico.toLowerCase().includes('sospechoso')).length;
                return {
                    totalEvaluaciones: total,
                    casosMalignos: malignos,
                    casosSospechosos: sospechosos,
                    recientes: evaluaciones.slice(-5).reverse() // Tomar las 5 más recientes
                };
            } catch (error) {
                console.error("Error fetching evaluaciones stats:", error);
                throw error;
            }
        },
        create: (formData) => {
            const token = getToken();
            return fetch(`${API_URL}/evaluaciones`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData // No setear Content-Type, fetch lo hace automático con el boundary para multipart/form-data
            }).then(res => {
                if (!res.ok) throw new Error('Error al crear la evaluación');
                return res.json();
            });
        },
        predictLive: (formData) => {
            const token = getToken();
            return fetch(`${API_URL}/evaluaciones/predict-live`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: formData
            }).then(res => {
                if (!res.ok) throw new Error('Error al procesar la imagen con IA');
                return res.json();
            });
        },
        // Foto de la evaluación y mapas de la IA como blob (los endpoints exigen
        // sesión, así que no se puede poner la URL directa en un <img>).
        getArchivo: async (ruta) => {
            const res = await fetch(`${API_URL}${ruta}`, {
                headers: { 'Authorization': `Bearer ${getToken()}` }
            });
            if (!res.ok) throw new Error(`Imagen no disponible (${res.status})`);
            return res.blob();
        }
    },
    pacientes: {
        getAll: () => fetchWithAuth('/pacientes'),
        getStats: async () => {
            try {
                const pacientes = await fetchWithAuth('/pacientes');
                return { totalPacientes: pacientes.length };
            } catch (error) {
                console.error("Error fetching pacientes stats:", error);
                throw error;
            }
        },
        create: (pacienteData) => fetchWithAuth('/pacientes', {
            method: 'POST',
            body: JSON.stringify(pacienteData)
        }),
        getById: (id) => fetchWithAuth(`/pacientes/${id}`)
    },
    usuarios: {
        getAll: () => fetchWithAuth('/usuarios'),
        create: (data) => fetchWithAuth('/usuarios', {
            method: 'POST',
            body: JSON.stringify(data)
        }),
        toggleStatus: (id, activo) => fetchWithAuth(`/usuarios/${id}/status`, {
            method: 'PATCH',
            body: JSON.stringify({ activo })
        }),
        // El backend calcula el hash: se manda la contraseña en `password`
        // (antes se mandaba como password_hash y quedaba guardada en claro).
        updatePassword: (id, password) => fetchWithAuth(`/usuarios/${id}`, {
            method: 'PATCH',
            body: JSON.stringify({ password })
        })
    },
    lesiones: {
        getById: (id) => fetchWithAuth(`/lesiones/${id}`),
        update: (id, data) => fetchWithAuth(`/lesiones/${id}`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        }),
        create: (lesionData) => fetchWithAuth('/lesiones', {
            method: 'POST',
            body: JSON.stringify(lesionData)
        })
    }
};
