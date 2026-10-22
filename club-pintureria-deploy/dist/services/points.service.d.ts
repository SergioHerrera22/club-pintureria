export declare class PointsService {
    static calculatePoints(userId: string, items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
    }>, subtotal: number): Promise<{
        totalPoints: number;
        breakdown: Array<{
            rule: string;
            type?: string;
            points: number;
            description?: string;
        }>;
    }>;
    static calculatePointsWithPromotions(userId: string, items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
    }>, subtotal: number, categoryIds?: string[], brandIds?: string[], productIds?: string[]): Promise<{
        totalPoints: number;
        breakdown: any[];
        appliedPromotions: Array<{
            promotion: any;
            points: number;
            discount: number;
        }>;
    }>;
    private static getRuleDescription;
    private static calculatePorMonto;
    private static calculatePorProducto;
    private static calculatePorCategoria;
    private static calculatePorRango;
    private static isBirthday;
    static addPoints(userId: string, points: number, transactionId: string, description?: string): Promise<void>;
    static redeemPoints(userId: string, points: number, redemptionId: string): Promise<void>;
    static adjustPoints(userId: string, points: number, reason: string, adminId: string): Promise<void>;
}
//# sourceMappingURL=points.service.d.ts.map