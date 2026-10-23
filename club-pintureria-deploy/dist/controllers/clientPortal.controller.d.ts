import { Request, Response, NextFunction } from 'express';
export declare const cleanDni: (raw: string) => string;
export declare const checkDni: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const claimAccount: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const recoverClientPassword: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const loginClient: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare const registerClient: (req: Request, res: Response, next: NextFunction) => Promise<void>;
//# sourceMappingURL=clientPortal.controller.d.ts.map