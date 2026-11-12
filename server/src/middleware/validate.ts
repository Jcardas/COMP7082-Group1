// server/src/middleware/validate.ts
// Created by Jacob F on 2026-11-08
//
// Express request validation middleware powered by Zod.
//
// Intercepts incoming HTTP requests to validate and sanitize
// req.body and req.query payloads against typed Zod schemas
// before route handlers execute.
//
// Returns standardized HTTP 400 Bad Request responses with
// field-level diagnostics on schema mismatches.

import { Request, Response, NextFunction, RequestHandler } from 'express';
import { ZodType, ZodError } from 'zod';

/**
 * Standardized error detail structure for a single invalid field
 */
export interface ValidationIssue {
  field: string;
  message: string;
}

/**
 * Standardized HTTP 400 error payload returned when validation fails
 */
export interface ValidationErrorResponse {
  error: string;
  details: ValidationIssue[];
}

/**
 * Formats a raw ZodError into an array of human-readable field issues
 *
 * @param error The ZodError instance produced by failed schema parsing
 * @returns Array of ValidationIssue objects with field path and message
 */
function formatZodError(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    // Join nested property paths with dots (e.g. 'mod.externalModId')
    field: issue.path.length > 0 ? issue.path.map(String).join('.') : 'root',
    message: issue.message,
  }));
}

/**
 * Middleware factory that validates `req.body` against a provided Zod schema.
 *
 * - On success: replaces `req.body` with the parsed (and defaulted/trimmed) data
 *   and passes control to the next middleware.
 * - On failure: short-circuits the request with HTTP 400 and detailed errors.
 *
 * @param schema The Zod schema to validate req.body against
 * @returns Express RequestHandler middleware function
 */
export function validateBody<T>(schema: ZodType<T>): RequestHandler<any, any, any, any> {
  return (req: Request, res: Response<ValidationErrorResponse>, next: NextFunction): void => {
    // Use safeParse to validate without throwing exceptions
    const result = schema.safeParse(req.body);

    if (!result.success) {
      // Return standardized 400 Bad Request on schema mismatch
      res.status(400).json({
        error: 'Validation failed for request body',
        details: formatZodError(result.error),
      });
      return;
    }

    // Overwrite req.body with the sanitized and type-coerced output
    req.body = result.data;
    next();
  };
}

/**
 * Middleware factory that validates `req.query` against a provided Zod schema.
 *
 * - On success: updates `req.query` with the parsed and coerced query values
 *   and passes control to the next middleware.
 * - On failure: short-circuits the request with HTTP 400 and detailed errors.
 *
 * @param schema The Zod schema to validate req.query against
 * @returns Express RequestHandler middleware function
 */
export function validateQuery<T>(schema: ZodType<T>): RequestHandler<any, any, any, any> {
  return (req: Request, res: Response<ValidationErrorResponse>, next: NextFunction): void => {
    // Validate query string parameters against the schema
    const result = schema.safeParse(req.query);

    if (!result.success) {
      // Return standardized 400 Bad Request on query parameter mismatch
      res.status(400).json({
        error: 'Validation failed for query parameters',
        details: formatZodError(result.error),
      });
      return;
    }

    // Assign coerced/defaulted properties back onto req.query safely
    Object.assign(req.query, result.data);
    next();
  };
}