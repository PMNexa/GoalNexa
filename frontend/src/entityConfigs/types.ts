export type FieldType = "string" | "text" | "enum" | "date" | "boolean";

export interface FieldConfig {
  name: string;
  label: string;
  type: FieldType;
  required?: boolean;
  /** enum only */
  values?: string[];
  /** enum only - maps value -> bootstrap color suffix e.g. "success" */
  badgeColors?: Record<string, string>;
  showInTable?: boolean;
  sortable?: boolean;
  filterable?: boolean;
  readOnly?: boolean;
}

export interface EntityConfig {
  /** e.g. "goal" -> path "/goals" */
  resource: string;
  /** "/goals" */
  path: string;
  /** "org_id" */
  scopeField: string;
  methods: ("list" | "get" | "create" | "update" | "delete")[];
  fields: FieldConfig[];
  filterFields?: string[];
  searchFields?: string[];
}
