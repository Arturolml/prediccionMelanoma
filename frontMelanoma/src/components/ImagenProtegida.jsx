import { useEffect, useState } from 'react';
import { api } from '../services/api';

/**
 * Foto de una evaluación (o un mapa de la IA con `ruta`). El backend ya no sirve
 * /uploads en público: la imagen se pide con el token de sesión y se muestra
 * como blob.
 */
const ImagenProtegida = ({ idEvaluacion, ruta, alt = 'Imagen clínica', className, style, comoFondo = false, children }) => {
    const origen = ruta || `/evaluaciones/${idEvaluacion}/imagen`;
    // Resultado de la última carga, con la ruta a la que corresponde: si cambia,
    // se muestra "Cargando..." hasta que llegue la imagen nueva.
    const [carga, setCarga] = useState({ id: null, url: null, error: false });

    useEffect(() => {
        let objectUrl = null;
        let activo = true;
        api.evaluaciones.getArchivo(origen)
            .then(blob => {
                if (!activo) return;
                objectUrl = URL.createObjectURL(blob);
                setCarga({ id: origen, url: objectUrl, error: false });
            })
            .catch(() => activo && setCarga({ id: origen, url: null, error: true }));
        return () => {
            activo = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [origen]);

    const vigente = carga.id === origen;
    const url = vigente ? carga.url : null;
    const error = vigente && carga.error;

    if (comoFondo) {
        return (
            <div className={className} style={{ ...style, background: url ? `url('${url}')` : 'rgba(0,0,0,0.3)', backgroundSize: 'cover', backgroundPosition: 'center' }}>
                {!url && <span className="text-xs text-muted flex-center h-full w-full">{error ? 'Sin imagen' : 'Cargando...'}</span>}
                {children}
            </div>
        );
    }
    if (!url) return <div className={className} style={style}><span className="text-xs text-muted">{error ? 'Sin imagen' : 'Cargando...'}</span></div>;
    return <img src={url} alt={alt} className={className} style={style} />;
};

export default ImagenProtegida;
