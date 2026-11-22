import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { PaginationMeta } from '@/lib/types';
import { formatNumber } from '@/lib/format';
import type { RouteSearchParams } from '@/lib/navigation';
import { paginationHref } from '@/lib/pagination';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export interface PaginationProps {
  page: PaginationMeta;
  /** Rows carried by this response, used for the "1–50 of N" range. */
  itemsCount: number;
  pathname: string;
  searchParams: RouteSearchParams;
  itemLabel: string;
  /** Param names for lists that share a detail page with other paginated lists. */
  names?: { offset?: string; after?: string; before?: string };
  /** Optional page-size control rendered before the navigation buttons. */
  pageSizeControl?: React.ReactNode;
  /** Set false for a fixed-size list where the page size is not useful context. */
  showPageSize?: boolean;
  className?: string;
}

function pageWindow(current: number, totalPages: number): number[] {
  const start = Math.max(1, Math.min(current - 2, totalPages - 4));
  const end = Math.min(totalPages, Math.max(current + 2, 5));
  return Array.from({ length: Math.max(0, end - start + 1) }, (_, index) => start + index);
}

export function Pagination({
  page,
  itemsCount,
  pathname,
  searchParams,
  itemLabel,
  names,
  pageSizeControl,
  showPageSize = true,
  className,
}: PaginationProps) {
  const offsetName = names?.offset ?? 'offset';

  if (page.mode === 'cursor') {
    return (
      <div
        className={cn(
          'flex flex-wrap items-center justify-between gap-2 text-xs',
          className,
        )}
      >
        <p className="text-muted-foreground">
          {page.total === 0
            ? `No ${itemLabel}`
            : `Showing ${formatNumber(itemsCount)} of ${formatNumber(page.total)} ${itemLabel}${showPageSize ? ` · page size ${formatNumber(page.limit)}` : ''}`}
        </p>
        <div className="flex items-center gap-2">
          {pageSizeControl}
          {page.prevCursor ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={paginationHref({
                  pathname,
                  searchParams,
                  names: { after: names?.after, before: names?.before },
                  changes: {
                    [names?.before ?? 'before']: page.prevCursor,
                    [names?.after ?? 'after']: null,
                    [offsetName]: null,
                  },
                })}
                scroll={false}
              >
                <ChevronLeft className="size-3.5" />
                Newer
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="size-3.5" />
              Newer
            </Button>
          )}
          {page.nextCursor ? (
            <Button asChild variant="outline" size="sm">
              <Link
                href={paginationHref({
                  pathname,
                  searchParams,
                  names: { after: names?.after, before: names?.before },
                  changes: {
                    [names?.after ?? 'after']: page.nextCursor,
                    [names?.before ?? 'before']: null,
                    [offsetName]: null,
                  },
                })}
                scroll={false}
              >
                Older
                <ChevronRight className="size-3.5" />
              </Link>
            </Button>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Older
              <ChevronRight className="size-3.5" />
            </Button>
          )}
        </div>
      </div>
    );
  }

  const offset = page.offset ?? 0;
  const totalPages = Math.max(1, Math.ceil(page.total / page.limit));
  const currentPage = Math.min(totalPages, Math.floor(offset / page.limit) + 1);
  const startRow = page.total === 0 ? 0 : offset + 1;
  const endRow = offset + itemsCount;

  return (
    <div
      className={cn(
        'flex flex-wrap items-center justify-between gap-2 text-xs',
        className,
      )}
    >
      <p className="text-muted-foreground">
        {page.total === 0
          ? `No ${itemLabel}`
          : itemsCount === 0
            ? `No ${itemLabel} on this page · ${formatNumber(page.total)} total`
            : `Showing ${formatNumber(startRow)}–${formatNumber(endRow)} of ${formatNumber(page.total)} ${itemLabel}`}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {pageSizeControl}
        <nav className="flex flex-wrap items-center gap-1" aria-label={`${itemLabel} pages`}>
        {currentPage > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link
              href={paginationHref({
                pathname,
                searchParams,
                names,
                changes: { [offsetName]: Math.max(0, offset - page.limit) },
              })}
              scroll={false}
              aria-label="Previous page"
            >
              <ChevronLeft className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled aria-label="Previous page">
            <ChevronLeft className="size-3.5" />
          </Button>
        )}

        {pageWindow(currentPage, totalPages).map((pageNumber) => (
          <Button
            key={pageNumber}
            asChild={pageNumber !== currentPage}
            variant={pageNumber === currentPage ? 'secondary' : 'ghost'}
            size="sm"
            className="min-w-8 px-2"
          >
            {pageNumber === currentPage ? (
              <span aria-current="page">{pageNumber}</span>
            ) : (
              <Link
                href={paginationHref({
                  pathname,
                  searchParams,
                  names,
                  changes: { [offsetName]: (pageNumber - 1) * page.limit },
                })}
                scroll={false}
                aria-label={`Page ${pageNumber}`}
              >
                {pageNumber}
              </Link>
            )}
          </Button>
        ))}

        {currentPage < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link
              href={paginationHref({
                pathname,
                searchParams,
                names,
                changes: { [offsetName]: offset + page.limit },
              })}
              scroll={false}
              aria-label="Next page"
            >
              <ChevronRight className="size-3.5" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled aria-label="Next page">
            <ChevronRight className="size-3.5" />
          </Button>
        )}
        </nav>
      </div>
    </div>
  );
}
