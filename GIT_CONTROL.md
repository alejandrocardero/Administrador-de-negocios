# Control de Versiones - IMPORTANTE

**LEER ANTES DE CADA SESIÓN DE TRABAJO**

## Reglas obligatorias

1. **SIEMPRE** hacer `git status` y `git pull` al inicio de cada conversación
2. **NUNCA** trabajar sin saber el estado actual del repositorio
3. Antes de cualquier cambio importante: `git add .` + `git commit -m "..."`
4. Antes de terminar la sesión: hacer commit de todos los cambios
5. Si el usuario pregunta por git/GitHub: verificar siempre el estado actual

## Comandos esenciales

```bash
# Iniciar sesión
git status
git pull origin master

# Guardar cambios
git add .
git commit -m "descripción del cambio"
git push origin master

# Ver historial
git log --oneline -10
```

## Notas del proyecto

- Repo: https://github.com/alejandrocardero/Administrador-de-negocios
- Rama principal: master
- Framework: Electron + React + TypeScript
- Base de datos: localStorage (futuro: CockroachDB)