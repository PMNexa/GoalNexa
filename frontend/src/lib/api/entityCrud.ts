import { apiFetch } from "./client";
import { EntityConfig } from "../../entityConfigs/types";

export interface ListParams {
  orgId: string;
  page?: number;
  pageSize?: number;
  sort?: string;
  q?: string;
  filters?: Record<string, string | undefined>;
}

export interface ListResult<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

function buildQuery(config: EntityConfig, params: ListParams): string {
  const search = new URLSearchParams();
  search.set(config.scopeField, params.orgId);
  if (params.page !== undefined) search.set("page", String(params.page));
  if (params.pageSize !== undefined) search.set("page_size", String(params.pageSize));
  if (params.sort) search.set("sort", params.sort);
  if (params.q) search.set("q", params.q);
  if (params.filters) {
    for (const [key, value] of Object.entries(params.filters)) {
      if (value !== undefined && value !== "") search.set(key, value);
    }
  }
  return search.toString();
}

export function listEntities<T>(config: EntityConfig, params: ListParams): Promise<ListResult<T>> {
  const query = buildQuery(config, params);
  return apiFetch<ListResult<T>>(`${config.path}?${query}`);
}

export function getEntity<T>(config: EntityConfig, id: string): Promise<T> {
  return apiFetch<T>(`${config.path}/${id}`);
}

export function createEntity<T>(config: EntityConfig, payload: Record<string, unknown>): Promise<T> {
  return apiFetch<T>(`${config.path}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function updateEntity<T>(
  config: EntityConfig,
  id: string,
  payload: Record<string, unknown>,
): Promise<T> {
  return apiFetch<T>(`${config.path}/${id}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

export function deleteEntity(config: EntityConfig, id: string): Promise<void> {
  return apiFetch<void>(`${config.path}/${id}`, { method: "DELETE" });
}
