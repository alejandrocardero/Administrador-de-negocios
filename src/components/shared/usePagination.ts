import { useCallback, useEffect, useMemo, useState } from "react"

const clampPage = (page: number, pageCount: number) =>
  Math.min(Math.max(1, page), pageCount)

/**
 * Hook de paginación genérico. Recorta automáticamente la página
 * cuando la lista de items cambia (p. ej. por filtrado o búsqueda).
 */
export function usePagination<T>(items: T[], pageSize = 10) {
  const [page, setPageState] = useState(1)

  const pageCount = Math.max(1, Math.ceil(items.length / pageSize))

  // Clamp cuando los items cambian y pageCount se reduce.
  useEffect(() => {
    setPageState((current) => clampPage(current, pageCount))
  }, [pageCount])

  const setPage = useCallback(
    (next: number) => {
      setPageState(clampPage(next, pageCount))
    },
    [pageCount],
  )

  const reset = useCallback(() => {
    setPageState(1)
  }, [])

  const pageItems = useMemo(
    () => items.slice((page - 1) * pageSize, page * pageSize),
    [items, page, pageSize],
  )

  return { pageItems, page, pageCount, setPage, reset } as const
}
