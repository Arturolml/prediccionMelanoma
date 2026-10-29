import { AlertTriangle } from 'lucide-react';
import ImagenProtegida from './ImagenProtegida';
import { etiquetaSitio } from '../constants/sitios';
import { estiloDecision } from '../constants/decision';
import './ResultadoIA.css';

const pct = (p) => `${(100 * p).toFixed(1)}%`;
const NOMBRE_COLOR = {
    negro: 'negro', marron_oscuro: 'marrón oscuro', marron_claro: 'marrón claro',
    rojo: 'rojo', azul_gris: 'azul-gris', blanco: 'blanco',
};

const Opinion = ({ titulo, subtitulo, datos }) => (
    <div className={`ria-opinion ${datos.sospecha ? 'ria-sospecha' : 'ria-sin-sospecha'}`}>
        <div className="ria-opinion-titulo">{titulo}</div>
        <div className="text-xs text-muted">{subtitulo}</div>
        <div className="ria-prob">{pct(datos.prob_maligno)}</div>
        <div className="ria-barra">
            <div className="ria-barra-valor" style={{ width: pct(datos.prob_maligno) }} />
            <div className="ria-barra-umbral" style={{ left: pct(datos.umbral) }} title={`Umbral ${pct(datos.umbral)}`} />
        </div>
        <div className="text-xs text-muted">umbral {pct(datos.umbral)} · {datos.sospecha ? 'marca sospecha' : 'no marca sospecha'}</div>
    </div>
);

const Mapa = ({ titulo, base64, ruta }) => (
    <figure className="ria-mapa">
        {base64
            ? <img src={`data:image/png;base64,${base64}`} alt={titulo} />
            : <ImagenProtegida ruta={ruta} alt={titulo} />}
        <figcaption className="text-xs text-muted">{titulo}</figcaption>
    </figure>
);

const AporteMetadatos = ({ fusion, metadatos }) => {
    const aportes = fusion.aporte_metadatos || {};
    const filas = [
        ['edad', `Edad: ${metadatos?.edad ?? 'sin dato'}`],
        ['sexo', `Sexo: ${{ male: 'masculino', female: 'femenino' }[metadatos?.sexo] || 'sin dato'}`],
        ['sitio', `Sitio: ${etiquetaSitio(metadatos?.sitio)}`],
    ];
    const maximo = Math.max(0.05, ...Object.values(aportes).map(v => Math.abs(v)));
    return (
        <div className="ria-bloque">
            <h4>Qué aportan los datos del paciente (Fusión)</h4>
            <p className="text-xs text-muted">
                Con la imagen y un paciente cualquiera: {pct(fusion.prob_sin_metadatos)} → con este paciente: {pct(fusion.prob_maligno)}
            </p>
            {filas.map(([clave, etiqueta]) => {
                const v = aportes[clave] ?? 0;
                return (
                    <div key={clave} className="ria-aporte">
                        <span className="ria-aporte-etiqueta">{etiqueta}</span>
                        <div className="ria-aporte-eje">
                            <div className={`ria-aporte-barra ${v >= 0 ? 'positivo' : 'negativo'}`}
                                style={{ width: `${(50 * Math.abs(v)) / maximo}%`, [v >= 0 ? 'left' : 'right']: '50%' }} />
                        </div>
                        <span className="ria-aporte-valor">{v >= 0 ? '+' : '−'}{Math.abs(100 * v).toFixed(1)} pts</span>
                    </div>
                );
            })}
        </div>
    );
};

const Abcde = ({ abcde }) => {
    if (!abcde) return null;
    if (abcde.error) {
        return <div className="ria-bloque"><h4>Criterios ABCDE (automático)</h4><p className="text-sm text-muted">{abcde.error}</p></div>;
    }
    const si = (b) => (b ? 'Sí' : 'No');
    const e = abcde.evolucion;
    const filas = [
        ['A · Asimetría', si(abcde.asimetria)],
        ['B · Borde irregular', si(abcde.bordes_irregulares)],
        ['C · Color', `${abcde.n_colores} de 6${abcde.colores?.length ? ` (${abcde.colores.map(c => NOMBRE_COLOR[c] || c).join(', ')})` : ''}${abcde.color_variable ? ' · multicolor' : ''}`],
        ['D · Diámetro', abcde.diametro_mm != null ? `${abcde.diametro_mm.toFixed(1)} mm${abcde.diametro_mayor_6_mm ? ' (> 6 mm)' : ''}` : 'sin escala en la foto'],
        ['E · Evolución', !e ? 'sin evaluación anterior de esta lesión'
            : e.error ? e.error
                : `diámetro ${e.cambio_diametro_pct >= 0 ? '+' : ''}${e.cambio_diametro_pct}%${e.colores_nuevos?.length ? `, colores nuevos: ${e.colores_nuevos.map(c => NOMBRE_COLOR[c] || c).join(', ')}` : ''}`],
    ];
    return (
        <div className="ria-bloque">
            <h4>Criterios ABCDE (medición automática)</h4>
            <table className="ria-tabla"><tbody>
                {filas.map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}
            </tbody></table>
            {abcde.advertencias?.filter(a => !a.startsWith('sin escala')).map(a => (
                <p key={a} className="text-xs ria-advertencia"><AlertTriangle size={12} /> {a}</p>
            ))}
        </div>
    );
};

/**
 * Resultado de la IA (API v2): las dos opiniones, la decisión, los mapas, el
 * aporte de los datos del paciente y el ABCDE automático.
 *
 * - Análisis en vivo: `resultado` trae `imagenes` (PNG en base64).
 * - Evaluación guardada: `resultado` es `resultado_ia` (sin imágenes) y los
 *   mapas se piden al backend con `idEvaluacion`.
 */
const ResultadoIA = ({ resultado, idEvaluacion }) => {
    if (!resultado?.fusion) return null;
    const decision = estiloDecision(resultado.decision);
    const imgs = resultado.imagenes || {};
    const rutaMapa = (tipo) => `/evaluaciones/${idEvaluacion}/mapa/${tipo}`;
    const conMapas = resultado.imagenes || idEvaluacion;
    return (
        <div className="ria">
            {decision && (
                <div className={`ria-decision ria-${decision.clase}`}>
                    <decision.Icono size={20} />
                    <span>{resultado.mensaje}</span>
                </div>
            )}
            {resultado.revisar_caso && (
                <div className="ria-revisar">
                    <AlertTriangle size={16} />
                    Los dos modelos no coinciden. En estos casos la IA acierta mucho menos: revise el caso con especial cuidado.
                </div>
            )}

            <div className="ria-opiniones">
                <Opinion titulo="Fusión" subtitulo="opinión principal · imagen + datos del paciente" datos={resultado.fusion} />
                <Opinion titulo="QResNet" subtitulo="segunda opinión · solo imagen" datos={resultado.qresnet} />
            </div>

            {conMapas && (
                <div className="ria-bloque">
                    <h4>Dónde miró cada modelo</h4>
                    <div className="ria-mapas">
                        <Mapa titulo="Fusión" base64={imgs.mapa_fusion_png} ruta={rutaMapa('fusion')} />
                        <Mapa titulo="QResNet" base64={imgs.mapa_qresnet_png} ruta={rutaMapa('qresnet')} />
                        <Mapa titulo="Lesión detectada" base64={imgs.contorno_lesion_png} ruta={rutaMapa('contorno')} />
                    </div>
                </div>
            )}

            <AporteMetadatos fusion={resultado.fusion} metadatos={resultado.metadatos_usados} />
            <Abcde abcde={resultado.abcde} />

            <p className="text-xs text-muted ria-pie">
                {resultado.advertencia_uso_clinico || 'Herramienta de apoyo a la decisión; no sustituye la evaluación dermatológica.'}
                {resultado.version_modelos ? ` Modelos: ${resultado.version_modelos}.` : ''}
            </p>
        </div>
    );
};

export default ResultadoIA;
