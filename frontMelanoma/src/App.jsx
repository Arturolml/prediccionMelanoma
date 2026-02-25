import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Topbar from './components/Topbar';
import CrearUsuario from './pages/CrearUsuario';
import CrearPaciente from './pages/CrearPaciente';
import Pacientes from './pages/Pacientes';
import PacienteDetail from './pages/PacienteDetail';
import LesionDetail from './pages/LesionDetail';
import CrearEvaluacion from './pages/CrearEvaluacion';
import Usuarios from './pages/Usuarios';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './context/AuthContext';
import './App.css';

const AppContent = () => {
  const { currentUser } = useAuth();

  if (!currentUser) {
    return <Login />;
  }

  return (
    <Router>
      <div className="app-layout">
        <Sidebar />
        <div className="main-content">
          <Topbar />
          <div className="page-content" style={{ marginTop: '24px' }}>
            <Routes>
              <Route path="/" element={<CrearUsuario />} />
              <Route path="/crear-paciente" element={<CrearPaciente />} />
              <Route path="/pacientes" element={<Pacientes />} />
              <Route path="/pacientes/:id" element={<PacienteDetail />} />
              <Route path="/pacientes/:id/nueva-evaluacion" element={<CrearEvaluacion />} />
              <Route path="/lesiones/:id" element={<LesionDetail />} />
              <Route path="/lesiones/:id/nueva-evaluacion" element={<CrearEvaluacion />} />
              <Route path="/usuarios" element={<Usuarios />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
