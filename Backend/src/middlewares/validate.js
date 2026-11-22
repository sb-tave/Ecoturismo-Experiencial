import { badRequest } from '../utils/errors.js';

// validate({ params, query, body }) -> deja los datos validados en req.valid
export const validate = (schemas) => (req, _res, next) => {
  const details = [];
  req.valid = {};
  for (const part of ['params', 'query', 'body']) {
    if (!schemas[part]) continue;
    const result = schemas[part].safeParse(req[part] ?? {});
    if (result.success) req.valid[part] = result.data;
    else for (const issue of result.error.issues) details.push({ campo: issue.path.join('.') || part, en: part, mensaje: issue.message });
  }
  if (details.length) return next(badRequest('Hay datos inválidos en la solicitud', 'VALIDACION', details));
  return next();
};
