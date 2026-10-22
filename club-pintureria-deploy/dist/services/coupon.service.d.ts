import { CouponType } from '@prisma/client';
interface CouponFilters {
    isActive?: boolean;
    clientId?: string;
    type?: CouponType;
    page?: number;
    limit?: number;
}
export declare class CouponService {
    static getCoupons(filters?: CouponFilters): Promise<{
        coupons: ({
            client: {
                id: string;
                dni: string;
                firstName: string;
                lastName: string;
            } | null;
            promotion: {
                name: string;
                id: string;
            } | null;
        } & {
            name: string;
            value: number;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import(".prisma/client").$Enums.CouponType;
            startDate: Date;
            endDate: Date;
            description: string | null;
            clientId: string | null;
            maxUses: number | null;
            usedCount: number;
            promotionId: string | null;
        })[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    static getCouponById(id: string): Promise<{
        client: {
            id: string;
            email: string;
            dni: string;
            firstName: string;
            lastName: string;
        } | null;
        promotion: {
            name: string;
            id: string;
        } | null;
    } & {
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import(".prisma/client").$Enums.CouponType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        clientId: string | null;
        maxUses: number | null;
        usedCount: number;
        promotionId: string | null;
    }>;
    static getCouponByCode(code: string): Promise<{
        client: {
            id: string;
            email: string;
            dni: string;
            firstName: string;
            lastName: string;
        } | null;
        promotion: {
            name: string;
            id: string;
            type: import(".prisma/client").$Enums.PromotionType;
            multiplier: number;
            bonusPoints: number;
            discount: number | null;
        } | null;
    } & {
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import(".prisma/client").$Enums.CouponType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        clientId: string | null;
        maxUses: number | null;
        usedCount: number;
        promotionId: string | null;
    }>;
    static createCoupon(data: {
        code?: string;
        name: string;
        description?: string;
        type: CouponType;
        value: number;
        maxUses?: number;
        startDate: Date;
        endDate: Date;
        isActive?: boolean;
        clientId?: string;
        promotionId?: string;
    }): Promise<{
        client: {
            id: string;
            dni: string;
            firstName: string;
            lastName: string;
        } | null;
        promotion: {
            name: string;
            id: string;
        } | null;
    } & {
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import(".prisma/client").$Enums.CouponType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        clientId: string | null;
        maxUses: number | null;
        usedCount: number;
        promotionId: string | null;
    }>;
    static createBulkCoupons(data: {
        prefix: string;
        count: number;
        name: string;
        description?: string;
        type: CouponType;
        value: number;
        maxUses?: number;
        startDate: Date;
        endDate: Date;
        isActive?: boolean;
    }): Promise<{
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import(".prisma/client").$Enums.CouponType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        clientId: string | null;
        maxUses: number | null;
        usedCount: number;
        promotionId: string | null;
    }[]>;
    static updateCoupon(id: string, data: {
        name?: string;
        description?: string;
        type?: CouponType;
        value?: number;
        maxUses?: number;
        startDate?: Date;
        endDate?: Date;
        isActive?: boolean;
        clientId?: string;
        promotionId?: string;
    }): Promise<{
        client: {
            id: string;
            dni: string;
            firstName: string;
            lastName: string;
        } | null;
        promotion: {
            name: string;
            id: string;
        } | null;
    } & {
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import(".prisma/client").$Enums.CouponType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        clientId: string | null;
        maxUses: number | null;
        usedCount: number;
        promotionId: string | null;
    }>;
    static deleteCoupon(id: string): Promise<{
        message: string;
    }>;
    static validateCoupon(code: string, clientId?: string): Promise<{
        coupon: {
            id: string;
            code: string;
            name: string;
            type: import(".prisma/client").$Enums.CouponType;
            value: number;
            promotion: {
                name: string;
                id: string;
                type: import(".prisma/client").$Enums.PromotionType;
                multiplier: number;
                bonusPoints: number;
                discount: number | null;
            } | null;
        };
    }>;
    static useCoupon(code: string, clientId: string): Promise<{
        message: string;
    }>;
    static assignCouponToClient(couponId: string, clientId: string): Promise<{
        client: {
            id: string;
            dni: string;
            firstName: string;
            lastName: string;
        } | null;
    } & {
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        code: string;
        type: import(".prisma/client").$Enums.CouponType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        clientId: string | null;
        maxUses: number | null;
        usedCount: number;
        promotionId: string | null;
    }>;
    static assignBulkCoupons(couponIds: string[], clientId: string): Promise<({
        success: boolean;
        coupon: {
            client: {
                id: string;
                dni: string;
                firstName: string;
                lastName: string;
            } | null;
        } & {
            name: string;
            value: number;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            code: string;
            type: import(".prisma/client").$Enums.CouponType;
            startDate: Date;
            endDate: Date;
            description: string | null;
            clientId: string | null;
            maxUses: number | null;
            usedCount: number;
            promotionId: string | null;
        };
        couponId?: undefined;
        error?: undefined;
    } | {
        success: boolean;
        couponId: string;
        error: string;
        coupon?: undefined;
    })[]>;
    private static generateCode;
}
export {};
//# sourceMappingURL=coupon.service.d.ts.map