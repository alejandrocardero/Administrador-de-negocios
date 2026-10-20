# Skill: Modern UI & Architecture Standards
> Esta skill se aplica automáticamente a cualquier tarea de desarrollo frontend, componentes, estructura de páginas o diseño de interfaces en este administrador de negocios.

## 1. Directrices de Diseño y Estética (UI/UX)
- **Prohibido el diseño obsoleto:** No utilices interfaces planas de los 2010s, formularios sobrecargados de inputs sin padding, ni tablas HTML tradicionales con bordes grises gruesos.
- **Sistema visual moderno:** Utiliza un estilo limpio tipo *SaaS Pro* / *Dashboard Enterprise*. Emplea tarjetas (`cards`) con sombras suaves (`shadow-sm` o `shadow-md`), bordes sutiles (`border border-slate-200` o equivalentes oscuros), esquinas redondeadas (`rounded-xl`), y transiciones fluidas.
- **Jerarquía y Espaciado:** Usa espacios amplios (sistema de espaciado basado en múltiplos de 4: `p-4`, `gap-6`, etc.), tipografías limpias con pesos diferenciados (títulos en semibold/bold, subtítulos en muted text) y elementos visuales de apoyo (iconos minimalistas en cada sección clave).
- **Paleta de Colores Coherente:** Mantén una paleta profesional (fondos limpios, acentos de color funcionales para estados: éxito, advertencia, error, y un color de marca principal sobrio y elegante).

## 2. Directrices de Estructura de Código (Frontend)
- **Modularidad estricta:** Nunca escribas componentes gigantes de más de 200 líneas. Divide las vistas del administrador en subcomponentes reutilizables (`/components/ui/`, `/components/dashboard/`, etc.).
- **Diseño Responsivo Obligatorio:** Todo diseño de tabla, panel lateral (sidebar) o estadísticas debe adaptarse de forma fluida a pantallas móviles y de escritorio mediante layouts adaptativos (`grid`, `flex`, layouts de cuadrícula modernos).
- **Consistencia de Estados:** Implementa estados visuales vacíos (`empty states`), esqueletos de carga (`skeletons`) y notificaciones sutiles (`toasts`) por defecto en lugar de alertas nativas del navegador (`alert()`).