import multer from 'multer';
import { config } from '../config/env.js';
import { badRequest } from '../utils/errors.js';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

// RF-09: solo JPG, PNG o WebP de tamaño limitado. El archivo se mantiene en memoria y se valida/convierte en storage.js
export const uploadFoto = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxMb * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) =>
    TIPOS.includes(file.mimetype) ? cb(null, true) : cb(badRequest('Solo se permiten imágenes JPG, PNG o WebP', 'TIPO_DE_ARCHIVO_INVALIDO')),
}).single('foto');
