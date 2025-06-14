import { Request, Response, NextFunction } from 'express';
export declare function startErrorTracker(): Promise<void>;
export declare function errorTrackerExpress(route?: string, opts?: any): (import("express-serve-static-core").Router | ((err: any, req: Request, _res: Response, next: NextFunction) => Promise<void>))[];
export declare const errorTrackerFastify: (fastify: import("fastify").FastifyInstance<import("fastify").RawServerDefault, import("http").IncomingMessage, import("http").ServerResponse<import("http").IncomingMessage>, import("fastify").FastifyBaseLogger, import("fastify").FastifyTypeProviderDefault>, opts: any) => Promise<void>;
