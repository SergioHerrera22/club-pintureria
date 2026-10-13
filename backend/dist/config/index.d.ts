export declare const config: {
    port: number;
    nodeEnv: string;
    jwt: {
        secret: string;
        expiresIn: string;
        refreshExpiresIn: string;
    };
    adminConfirmationKey: string;
    database: {
        url: string;
    };
    cors: {
        origin: string;
        credentials: boolean;
    };
    rateLimit: {
        windowMs: number;
        max: number;
    };
    email: {
        host: string;
        port: number;
        secure: boolean;
        user: string;
        pass: string;
        from: string;
    };
    frontendUrl: string;
};
//# sourceMappingURL=index.d.ts.map