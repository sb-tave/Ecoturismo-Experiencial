// Ejecuta todas las pruebas *.test.js en serie (comparten una misma base de datos de prueba).
import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const dir = new URL('.', import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith('.test.js')).sort().map((f) => `test/${f}`);
const result = spawnSync(process.execPath, ['--test', '--test-concurrency=1', ...files, ...process.argv.slice(2)], {
  stdio: 'inherit',
  env: { ...process.env, NODE_ENV: 'test' },
});
process.exit(result.status ?? 1);
