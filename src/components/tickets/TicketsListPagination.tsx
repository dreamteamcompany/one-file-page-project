import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface TicketsListPaginationProps {
  page: number;
  totalPages: number;
  totalTickets: number;
  onPageChange?: (page: number) => void;
  pageSize?: number;
  pageSizeOptions?: readonly number[];
  onPageSizeChange?: (size: number) => void;
}

const TicketsListPagination = ({
  page,
  totalPages,
  totalTickets,
  onPageChange,
  pageSize,
  pageSizeOptions,
  onPageSizeChange,
}: TicketsListPaginationProps) => {
  const showSizeSelector =
    !!pageSize && !!onPageSizeChange && !!pageSizeOptions && pageSizeOptions.length > 0;

  if (totalPages <= 1 && !showSizeSelector) return null;

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 py-6">
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          Заявок: {totalTickets}, страница {page} из {totalPages}
        </span>
        {showSizeSelector && (
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground">На странице:</span>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => onPageSizeChange?.(Number(v))}
            >
              <SelectTrigger className="h-8 w-[72px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {pageSizeOptions!.map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center gap-1">
          <button
            onClick={() => onPageChange?.(1)}
            disabled={page === 1}
            className="px-2 py-1 rounded text-sm disabled:opacity-40 hover:bg-muted transition-colors"
          >
            «
          </button>
          <button
            onClick={() => onPageChange?.(page - 1)}
            disabled={page === 1}
            className="px-3 py-1 rounded text-sm disabled:opacity-40 hover:bg-muted transition-colors"
          >
            ‹
          </button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let p: number;
            if (totalPages <= 5) {
              p = i + 1;
            } else if (page <= 3) {
              p = i + 1;
            } else if (page >= totalPages - 2) {
              p = totalPages - 4 + i;
            } else {
              p = page - 2 + i;
            }
            return (
              <button
                key={p}
                onClick={() => onPageChange?.(p)}
                className={`px-3 py-1 rounded text-sm transition-colors ${
                  p === page
                    ? 'bg-primary text-primary-foreground'
                    : 'hover:bg-muted'
                }`}
              >
                {p}
              </button>
            );
          })}
          <button
            onClick={() => onPageChange?.(page + 1)}
            disabled={page === totalPages}
            className="px-3 py-1 rounded text-sm disabled:opacity-40 hover:bg-muted transition-colors"
          >
            ›
          </button>
          <button
            onClick={() => onPageChange?.(totalPages)}
            disabled={page === totalPages}
            className="px-2 py-1 rounded text-sm disabled:opacity-40 hover:bg-muted transition-colors"
          >
            »
          </button>
        </div>
      )}
    </div>
  );
};

export default TicketsListPagination;
