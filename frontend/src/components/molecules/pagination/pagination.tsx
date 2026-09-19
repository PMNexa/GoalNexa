export interface PaginationProps {
  page: number;
  pageSize: number;
  total: number;
  onPageChange: (page: number) => void;
}

export function Pagination({ page, pageSize, total, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) return null;

  return (
    <nav aria-label="Pagination">
      <ul className="pagination">
        <li className={["page-item", page <= 1 ? "disabled" : ""].filter(Boolean).join(" ")}>
          <button className="page-link" onClick={() => onPageChange(page - 1)} disabled={page <= 1}>
            Previous
          </button>
        </li>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <li key={p} className={["page-item", p === page ? "active" : ""].filter(Boolean).join(" ")}>
            <button className="page-link" onClick={() => onPageChange(p)}>
              {p}
            </button>
          </li>
        ))}
        <li className={["page-item", page >= totalPages ? "disabled" : ""].filter(Boolean).join(" ")}>
          <button className="page-link" onClick={() => onPageChange(page + 1)} disabled={page >= totalPages}>
            Next
          </button>
        </li>
      </ul>
    </nav>
  );
}
