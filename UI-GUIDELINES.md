# Guía de UI — AdminNegocio Pro (SaaS)

Sistema canónico para todas las secciones de la app. Si un patrón existe aquí, **úsalo**; no reinventes estilos por sección.

## 1. Tokens de color — solo variables semánticas

En secciones está **prohibido** usar colores crudos (`slate-*`, `gray-*`, `blue-*`, hex). Usa exclusivamente:

| Uso | Clase | Nota |
|---|---|---|
| Fondo de página | `bg-background` | slate-50 (light) / slate-950 (dark) |
| Fondo de tarjeta | `bg-card` | blanco puro en light |
| Texto principal | `text-foreground` | |
| Texto secundario | `text-muted-foreground` | descripciones, placeholders |
| Bordes / inputs | `border-border`, `border-input` | |
| Marca / acciones | `bg-primary`, `text-primary`, `ring-ring` | Indigo-600 `#4f46e5` |
| Éxito | `bg-success/10 text-success` | verde-600 |
| Advertencia | `bg-warning/15 text-warning-foreground` | texto ámbar oscuro para contraste |
| Peligro | `bg-destructive`, `text-destructive` | rojo suave |
| Superficies hover | `bg-accent`, `hover:bg-muted/50` | |

Deriva transparencias de tokens: `bg-primary/10`, `bg-destructive/10`, etc.

## 2. Densidad

- Contenedores de página: `p-4` (móvil) → `p-6` (desktop), separaciones `gap-4`.
- Cards internas: `p-4`, `rounded-xl` (lo da `--radius: 0.75rem`).
- Tablas: celdas `py-3`, texto `text-sm`.

## 3. Patrón canónico de página

Estructura obligatoria: `PageHeader` → toolbar (SearchInput / filtros / acciones) → Card con `SkeletonTable` (cargando) → `Table` (datos) → `EmptyState` (vacío) → `TablePagination`.

```tsx
const [query, setQuery] = useState("")
const filtered = productos.filter((p) => p.nombre.toLowerCase().includes(query.toLowerCase()))
const { pageItems, page, pageCount, setPage, reset } = usePagination(filtered)

<PageHeader title="Productos" description="Gestiona tu catálogo" icon={Package} actions={<Button onClick={openCreate}><Plus />Nuevo</Button>} />
<Card>
  <CardContent className="space-y-4">
    <div className="flex flex-wrap items-center gap-3">
      <SearchInput value={query} onChange={(v) => { setQuery(v); reset() }} placeholder="Buscar productos…" />
    </div>
    {loading ? <SkeletonTable cols={4} />
      : filtered.length === 0 ? <EmptyState icon={Package} title="Sin productos" description="Agrega tu primer producto" action={<Button>Nuevo producto</Button>} />
      : <>
          <Table>…</Table>
          <TablePagination page={page} pageCount={pageCount} setPage={setPage} />
        </>}
  </CardContent>
</Card>
```

Importa el toolkit desde el barrel: `import { PageHeader, SearchInput, … } from "@/components/shared"`.

## 4. Patrón de formulario

`LabeledInput` para campos, botón submit con spinner, feedback con `toast` (nunca `alert()`).

```tsx
const [saving, setSaving] = useState(false)

async function onSubmit(event: React.FormEvent) {
  event.preventDefault()
  setSaving(true)
  try {
    await guardar(datos)
    toast.success("Producto guardado")
    setOpen(false)
  } catch (error) {
    toast.error("No se pudo guardar el producto")
  } finally {
    setSaving(false)
  }
}

<form onSubmit={onSubmit} className="space-y-4">
  <LabeledInput label="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} error={errores.nombre} hint="Visible para tus clientes" required />
  <Button type="submit" disabled={saving}>
    {saving && <Loader2 className="animate-spin" aria-hidden />}
    Guardar
  </Button>
</form>
```

## 5. Badge de estado

Usa `StatusBadge` con tonos suaves, nunca colores crudos:

```tsx
<StatusBadge tone={stock > 0 ? "success" : "danger"}>{stock > 0 ? "Disponible" : "Agotado"}</StatusBadge>
// tone: "success" | "warning" | "danger" | "info" | "neutral"
```

## 6. Responsive dual: tabla + cards

En móvil muestra cards; desde `md`, tabla. Nunca tablas con scroll horizontal en móvil salvo datos densos.

```tsx
{/* Tabla: solo desktop */}
<div className="hidden md:block">
  <Table>…</Table>
</div>
{/* Cards: solo móvil */}
<div className="grid gap-4 md:hidden">
  {pageItems.map((item) => <Card key={item.id} className="p-4">…</Card>)}
</div>
```

Mientras cargan las cards, usa `<SkeletonCards count={4} />`.

## 7. Notificaciones

Siempre `sonner`: `toast.success(...)`, `toast.error(...)` (ya montado globalmente, estilo `richColors`, esquina superior derecha).
