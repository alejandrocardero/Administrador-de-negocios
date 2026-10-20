// Setup global de Vitest (entorno jsdom).
// No se usa jest-dom: los tests emplean las aserciones estándar de Vitest
// (toBeTruthy / toBeNull / queryByText, etc.).
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

afterEach(() => {
  cleanup();
});
