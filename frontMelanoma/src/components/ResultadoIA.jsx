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

/** Las semillas del ensamble quedan a ambos lados del umbral: en los hospitales
 * externos, esos casos fallan de 3 a 5 veces más que los demás. */
const semillasDiscrepan = ({ prob_por_semilla: p, umbral }) => (
    Array.isArray(p) && p.length > 1 && Math.min(...p) < umbral && Math.max(...p) >= umbral
);

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
        {Array.isArray(datos.prob_por_semilla) && (
            <div className="text-xs text-muted">
                semillas: {pct(Math.min(...datos.prob_por_semilla))} a {pct(Math.max(...datos.prob_por_semilla))}
            </div>
        )}
        {semillasDiscrepan(datos) && (
            <div className="text-xs ria-advertencia"><AlertTriangle size={12} /> Resultado inestable: las semillas no coinciden</div>
        )}
    </div>
);

const Mapa = ({ titulo, base64, ruta }) => {
    if (!base64 && !ruta) return null; // análisis en vivo sin ese mapa (no se encontró la lesión)
    return (
        <figure className="ria-mapa">
            {base64
                ? <img src={`data:image/png;base64,${base64}`} alt={titulo} />
                : <ImagenProtegida ruta={ruta} alt={titulo} />}
            <figcaption className="text-xs text-muted">{titulo}</figcaption>
        </figure>
    );
};

/** La misma lesión en la evaluación anterior y en esta, lado a lado. */
const Comparacion = ({ idEvaluacionPrevia, idEvaluacion, fotoActualUrl }) => (
    <div className="ria-bloque">
        <h4>Comparación con la evaluación anterior</h4>
        <div className="ria-mapas">
            <figure className="ria-mapa">
                <ImagenProtegida idEvaluacion={idEvaluacionPrevia} alt="Evaluación anterior" />
                <figcaption className="text-xs text-muted">Anterior</figcaption>
            </figure>
            <figure className="ria-mapa">
                {fotoActualUrl
                    ? <img src={fotoActualUrl} alt="Foto actual" />
                    : <ImagenProtegida idEvaluacion={idEvaluacion} alt="Esta evaluación" />}
                <figcaption className="text-xs text-muted">Esta evaluación</figcaption>
            </figure>
        </div>
    </div>
);

/** Texto del criterio E con la unidad en que se pudo medir el cambio. */
const textoEvolucion = (e) => {
    if (!e) return 'sin evaluación anterior de esta lesión';
    if (e.error) return e.error;
    const signo = e.cambio_diametro_pct >= 0 ? '+' : '';
    const colores = e.colores_nuevos?.length ? `, colores nuevos: ${e.colores_nuevos.map(c => NOMBRE_COLOR[c] || c).join(', ')}` : '';
    const nota = e.unidad === 'mm' ? ` (${e.diametro_previo.toFixed(1)} → ${e.diametro_actual.toFixed(1)} mm)` : ' (sin escala en las dos fotos: comparable solo con el mismo encuadre)';
    return `diámetro ${signo}${e.cambio_diametro_pct}%${nota}${colores}`;
};

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
        ['D · Diámetro', abcde.diametro_mm != null ? `${abcde.diametro_mm.toFixed(1)} mm${abcde.diametro_mayor_6_mm ? ' (> 6 mm)' : ''}` : 'sin escala: indique el ancho de la foto'],
        ['E · Evolución', textoEvolucion(e)],
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
const ResultadoIA = ({ resultado, idEvaluacion, idEvaluacionPrevia, fotoActualUrl }) => {
    if (!resultado?.fusion) return null;
    const decision = estiloDecision(resultado.decision);
    const imgs = resultado.imagenes || {};
    const rutaMapa = (tipo) => (idEvaluacion ? `/evaluaciones/${idEvaluacion}/mapa/${tipo}` : null);
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
            {idEvaluacionPrevia && resultado.abcde?.evolucion && (
                <Comparacion idEvaluacionPrevia={idEvaluacionPrevia} idEvaluacion={idEvaluacion} fotoActualUrl={fotoActualUrl} />
            )}

            <p className="text-xs text-muted ria-pie">
                {resultado.advertencia_uso_clinico || 'Herramienta de apoyo a la decisión; no sustituye la evaluación dermatológica.'}
                {resultado.version_modelos ? ` Modelos: ${resultado.version_modelos}.` : ''}
                {resultado.politica ? ` Política: ${resultado.politica}.` : ''}
            </p>
        </div>
    );
};

export default ResultadoIA;
