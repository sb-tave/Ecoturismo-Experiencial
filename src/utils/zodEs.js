import { z } from 'zod';

const tipos = { string: 'texto', number: 'número', int: 'número entero', boolean: 'verdadero/falso', object: 'objeto', array: 'lista' };

// Mensajes de validación en español (se aplican a todos los esquemas).
z.config({
  customError: (iss) => {
    switch (iss.code) {
      case 'invalid_type':
        if (iss.input === undefined) return 'Este campo es obligatorio';
        return `Tipo de dato inválido (se esperaba ${tipos[iss.expected] || iss.expected})`;
      case 'too_small':
        if (iss.origin === 'string') return `Debe tener al menos ${iss.minimum} caracteres`;
        if (iss.origin === 'array') return `Debe incluir al menos ${iss.minimum} elemento(s)`;
        return `Debe ser mayor ${iss.inclusive ? 'o igual ' : ''}a ${iss.minimum}`;
      case 'too_big':
        if (iss.origin === 'string') return `Debe tener máximo ${iss.maximum} caracteres`;
        if (iss.origin === 'array') return `Debe incluir máximo ${iss.maximum} elemento(s)`;
        return `Debe ser menor ${iss.inclusive ? 'o igual ' : ''}a ${iss.maximum}`;
      case 'invalid_format':
        return iss.format === 'email' ? 'Correo electrónico inválido' : 'Formato de texto inválido';
      case 'invalid_value':
        return iss.values.length === 1 ? `Valor inválido (se esperaba ${JSON.stringify(iss.values[0])})` : `Valor inválido. Opciones: ${iss.values.join(', ')}`;
      default:
        return undefined;
    }
  },
});

export { z };
