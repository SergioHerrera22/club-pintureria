import { Request, Response, NextFunction } from 'express';
export declare class AppError extends Error {
    statusCode: number;
    message: string;
    details?: unknown | undefined;
    constructor(statusCode: number, message: string, details?: unknown | undefined);
}
export declare const errorHandler: (err: Error, req: Request, res: Response, next: NextFunction) => void;
export declare const notFoundHandler: (req: Request, res: Response) => void;
//# sourceMappingURL=errorHandler.d.ts.map