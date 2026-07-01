export interface PaginationParams {
  page: number;
  limit: number;
  skip: number;
}

export interface SortParams {
  field: string;
  order: 'asc' | 'desc';
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface SearchParams {
  query: string;
  fields: string[];
}

export interface ServiceResponse<T = unknown> {
  data: T;
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
  };
}

export interface IBaseRepository<T> {
  findById(id: string): Promise<T | null>;
  findMany(params?: { skip?: number; take?: number; where?: unknown; orderBy?: unknown }): Promise<T[]>;
  create(data: unknown): Promise<T>;
  update(id: string, data: unknown): Promise<T>;
  delete(id: string): Promise<T>;
  count(where?: unknown): Promise<number>;
}

export interface IBaseService<T> {
  getById(id: string): Promise<T>;
  list(params?: PaginationParams & { where?: unknown }): Promise<ServiceResponse<T[]>>;
  create(data: unknown): Promise<T>;
  update(id: string, data: unknown): Promise<T>;
  delete(id: string): Promise<void>;
}
