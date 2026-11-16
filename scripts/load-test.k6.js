// Prueba de carga con k6 (RNF-25):  k6 run scripts/load-test.k6.js   (BASE_URL opcional)
// Objetivo: 100 usuarios concurrentes, API con p95 < 1 s (RNF-24) y menos de 1 % de errores.
import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  stages: [
    { duration: '30s', target: 100 },
    { duration: '1m', target: 100 },
    { duration: '10s', target: 0 },
  ],
  thresholds: { http_req_duration: ['p(95)<1000'], http_req_failed: ['rate<0.01'] },
};

const BASE = __ENV.BASE_URL || 'http://localhost:3000';
const rutas = ['/api/services?localidad=Salento', '/api/services?lat=4.6372&lng=-75.57&radio_km=30', '/api/categories'];

export default function () {
  const r = http.get(`${BASE}${rutas[Math.floor(Math.random() * rutas.length)]}`);
  check(r, { 'responde 200': (x) => x.status === 200 });
  sleep(1);
}
