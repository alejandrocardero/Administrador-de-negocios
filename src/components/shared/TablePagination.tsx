import { cn } from "@/lib/utils"
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

interface TablePaginationProps {
  page: number
  pageCount: number
  setPage: (page: number) => void
  className?: string
}

const linkBase =
  "cursor-pointer select-none disabled:pointer-events-none disabled:opacity-50"

/** Barra de paginación canónica para tablas. Se oculta si solo hay una página. */
export function TablePagination({
  page,
  pageCount,
  setPage,
  className,
}: TablePaginationProps) {
  if (pageCount <= 1) return null

  return (
    <div className={cn("flex w-full items-center justify-end py-1", className)}>
      <Pagination className="mx-0 w-auto justify-end">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              aria-disabled={page <= 1}
              tabIndex={page <= 1 ? -1 : undefined}
              className={cn(linkBase, page <= 1 && "pointer-events-none opacity-50")}
              onClick={(event) => {
                event.preventDefault()
                if (page > 1) setPage(page - 1)
              }}
            />
          </PaginationItem>
          <PaginationItem className="px-2 text-sm text-muted-foreground">
            Página {page} de {pageCount}
          </PaginationItem>
          <PaginationItem>
            <PaginationNext
              href="#"
              aria-disabled={page >= pageCount}
              tabIndex={page >= pageCount ? -1 : undefined}
              className={cn(
                linkBase,
                page >= pageCount && "pointer-events-none opacity-50",
              )}
              onClick={(event) => {
                event.preventDefault()
                if (page < pageCount) setPage(page + 1)
              }}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    </div>
  )
}
