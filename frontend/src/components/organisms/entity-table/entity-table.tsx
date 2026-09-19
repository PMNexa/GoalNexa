import { EntityConfig } from "../../../entityConfigs/types";

export interface EntityRow {
  id: string;
  [key: string]: unknown;
}

export interface EntityTableProps<T extends EntityRow> {
  config: EntityConfig;
  items: T[];
  sort?: string;
  onSortChange?: (fieldName: string) => void;
  onRowClick?: (item: T) => void;
}

function formatCell(value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

export function EntityTable<T extends EntityRow>({
  config,
  items,
  sort,
  onSortChange,
  onRowClick,
}: EntityTableProps<T>) {
  const columns = config.fields.filter((field) => field.showInTable !== false);
  const sortField = sort?.replace(/^-/, "");
  const sortDesc = sort?.startsWith("-") ?? false;

  return (
    <table className="table table-hover">
      <thead>
        <tr>
          {columns.map((field) => (
            <th
              key={field.name}
              onClick={field.sortable && onSortChange ? () => onSortChange(field.name) : undefined}
              style={field.sortable ? { cursor: "pointer" } : undefined}
            >
              {field.label}
              {field.sortable && sortField === field.name && (sortDesc ? " ↓" : " ↑")}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {items.length === 0 && (
          <tr>
            <td colSpan={columns.length} className="text-center text-muted">
              No records found.
            </td>
          </tr>
        )}
        {items.map((item) => (
          <tr
            key={item.id}
            onClick={onRowClick ? () => onRowClick(item) : undefined}
            style={onRowClick ? { cursor: "pointer" } : undefined}
          >
            {columns.map((field) => {
              const value = item[field.name];
              if (field.type === "enum" && typeof value === "string") {
                const colorSuffix = field.badgeColors?.[value] ?? "secondary";
                return (
                  <td key={field.name}>
                    <span className={`badge text-bg-${colorSuffix}`}>{value}</span>
                  </td>
                );
              }
              return <td key={field.name}>{formatCell(value)}</td>;
            })}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
