interface ExpirationResult {
    expiredCount: number;
    notifiedCount: number;
    errors: string[];
}
export declare class PointsExpirationService {
    static expirePoints(): Promise<ExpirationResult>;
    private static expireClientPoints;
    private static notifyExpiryWarning;
    static expirePointsForClient(dni: string): Promise<{
        success: boolean;
        message: string;
    }>;
}
export {};
//# sourceMappingURL=pointsExpiration.service.d.ts.map