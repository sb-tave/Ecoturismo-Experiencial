// Prueba de carga ligera (RNF-22/RNF-24):  npm run load-test   (con el servidor en marcha y datos de demostración)
import autocannon from 'autocannon';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const rutas = ['/api/services?localidad=Salento', '/api/services?q=caba%C3%B1a&orden=precio_asc', '/api/services?lat=4.6372&lng=-75.57&radio_km=30', '/api/categories'];

const resultado = await autocannon({
  url: BASE,
  connections: Number(process.env.CONNECTIONS || 50),
  duration: Number(process.env.DURATION || 15),
  requests: rutas.map((path) => ({ method: 'GET', path })),
});
const p95 = resultado.latency.p97_5; // autocannon entrega p97.5, que es más estricto que el p95 de la RNF-24
console.log(`\nSolicitudes/s: ${resultado.requests.average} | latencia media: ${resultado.latency.average} ms | p97.5: ${p95} ms | máx: ${resultado.latency.max} ms | errores: ${resultado.errors} | no-2xx: ${resultado.non2xx}`);
console.log(p95 < 1000 ? '✔ Cumple RNF-24 (API < 1 s, medido con un percentil más estricto que el p95)' : '✘ No cumple RNF-24 en este entorno');
process.exit(resultado.errors || resultado.non2xx ? 1 : 0);
