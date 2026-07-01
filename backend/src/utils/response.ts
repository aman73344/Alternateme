import { Response } from 'express';
import httpStatus from 'http-status';

interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    page?: number;
    limit?: number;
    total?: number;
    totalPages?: number;
    hasNext?: boolean;
    hasPrevious?: boolean;
  };
}

function sendSuccess<T>(res: Response, data: T, statusCode = httpStatus.OK, meta?: ApiResponse['meta']): void {
  const response: ApiResponse<T> = { success: true, data, meta };
  res.status(statusCode).json(response);
}

function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const response: ApiResponse = {
    success: false,
    error: { code, message, details },
  };
  res.status(statusCode).json(response);
}

function sendPaginated<T>(
  res: Response,
  data: T[],
  total: number,
  page: number,
  limit: number,
): void {
  const totalPages = Math.ceil(total / limit);
  sendSuccess(res, data, httpStatus.OK, {
    page,
    limit,
    total,
    totalPages,
    hasNext: page < totalPages,
    hasPrevious: page > 1,
  });
}

function sendCreated<T>(res: Response, data: T): void {
  sendSuccess(res, data, httpStatus.CREATED);
}

function sendNoContent(res: Response): void {
  res.status(httpStatus.NO_CONTENT).send();
}

function sendAccepted<T>(res: Response, data?: T): void {
  sendSuccess(res, data, httpStatus.ACCEPTED);
}

export const apiResponse = {
  success: sendSuccess,
  error: sendError,
  paginated: sendPaginated,
  created: sendCreated,
  noContent: sendNoContent,
  accepted: sendAccepted,
};

export type { ApiResponse };
