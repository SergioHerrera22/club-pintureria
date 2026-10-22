import { PurchaseStatus } from '@prisma/client';
interface CreatePurchaseDTO {
    clientId: string;
    branchId: string;
    cashierId: string;
    vendorId?: string;
    items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        discount?: number;
    }>;
    couponCode?: string;
    notes?: string;
}
interface PurchaseWithDetails {
    id: string;
    receiptNumber: string;
    subtotal: number;
    discount: number;
    tax: number;
    total: number;
    pointsEarned: number;
    pointsBalance: number;
    promotionIds: string[];
    couponId: string | null;
    status: PurchaseStatus;
    notes: string | null;
    createdAt: Date;
    client: {
        id: string;
        firstName: string;
        lastName: string;
        dni: string;
        email: string;
        phone: string | null;
    };
    branch: {
        id: string;
        name: string;
        code: string;
    };
    cashier: {
        id: string;
        firstName: string;
        lastName: string;
    };
    items: Array<{
        id: string;
        productId: string;
        productName: string;
        productCode: string;
        quantity: number;
        unitPrice: number;
        discount: number;
        lineTotal: number;
        pointsEarned: number;
        promotionIds: string[];
    }>;
    appliedPromotions: Array<{
        promotion: any;
        points: number;
        discount: number;
    }>;
    appliedCoupon: any | null;
    pointsBreakdown: any[];
}
export declare class PurchaseService {
    static createPurchase(data: CreatePurchaseDTO): Promise<PurchaseWithDetails>;
    private static formatPurchaseResponse;
    static getPurchaseById(id: string): Promise<PurchaseWithDetails | null>;
    static getPurchases(filters: {
        page?: number;
        limit?: number;
        clientId?: string;
        branchId?: string;
        startDate?: Date;
        endDate?: Date;
        status?: PurchaseStatus;
    }): Promise<{
        purchases: {
            id: string;
            receiptNumber: string;
            total: number;
            pointsEarned: number;
            status: import(".prisma/client").$Enums.PurchaseStatus;
            createdAt: Date;
            client: {
                id: string;
                firstName: string;
                lastName: string;
                dni: string;
            };
            branch: {
                id: string;
                name: string;
                code: string;
            };
            itemCount: number;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    static cancelPurchase(id: string): Promise<{
        message: string;
    }>;
}
export {};
//# sourceMappingURL=purchase.service.d.ts.map