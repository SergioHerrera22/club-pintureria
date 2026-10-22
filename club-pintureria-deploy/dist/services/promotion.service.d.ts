import { PromotionType, Prisma } from '@prisma/client';
interface PromotionFilters {
    isActive?: boolean;
    category?: string;
    brand?: string;
    productId?: string;
    startDate?: Date;
    endDate?: Date;
    page?: number;
    limit?: number;
}
export declare class PromotionService {
    static getPromotions(filters?: PromotionFilters): Promise<{
        promotions: {
            name: string;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.PromotionType;
            startDate: Date;
            endDate: Date;
            description: string | null;
            imageUrl: string | null;
            multiplier: number;
            bonusPoints: number;
            discount: number | null;
            categories: string[];
            brands: string[];
            products: string[];
            conditions: Prisma.JsonValue | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    static getPromotionById(id: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.PromotionType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        imageUrl: string | null;
        multiplier: number;
        bonusPoints: number;
        discount: number | null;
        categories: string[];
        brands: string[];
        products: string[];
        conditions: Prisma.JsonValue | null;
    }>;
    static createPromotion(data: {
        name: string;
        description?: string;
        imageUrl?: string;
        type: PromotionType;
        multiplier?: number;
        bonusPoints?: number;
        discount?: number;
        startDate: Date;
        endDate: Date;
        isActive?: boolean;
        categories?: string[];
        brands?: string[];
        products?: string[];
        conditions?: any;
    }): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.PromotionType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        imageUrl: string | null;
        multiplier: number;
        bonusPoints: number;
        discount: number | null;
        categories: string[];
        brands: string[];
        products: string[];
        conditions: Prisma.JsonValue | null;
    }>;
    static updatePromotion(id: string, data: {
        name?: string;
        description?: string;
        imageUrl?: string;
        type?: PromotionType;
        multiplier?: number;
        bonusPoints?: number;
        discount?: number;
        startDate?: Date;
        endDate?: Date;
        isActive?: boolean;
        categories?: string[];
        brands?: string[];
        products?: string[];
        conditions?: any;
    }): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.PromotionType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        imageUrl: string | null;
        multiplier: number;
        bonusPoints: number;
        discount: number | null;
        categories: string[];
        brands: string[];
        products: string[];
        conditions: Prisma.JsonValue | null;
    }>;
    static deletePromotion(id: string): Promise<{
        message: string;
    }>;
    static activatePromotion(id: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.PromotionType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        imageUrl: string | null;
        multiplier: number;
        bonusPoints: number;
        discount: number | null;
        categories: string[];
        brands: string[];
        products: string[];
        conditions: Prisma.JsonValue | null;
    }>;
    static deactivatePromotion(id: string): Promise<{
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.PromotionType;
        startDate: Date;
        endDate: Date;
        description: string | null;
        imageUrl: string | null;
        multiplier: number;
        bonusPoints: number;
        discount: number | null;
        categories: string[];
        brands: string[];
        products: string[];
        conditions: Prisma.JsonValue | null;
    }>;
    static getActivePromotionsForClient(items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
    }>, subtotal: number, categoryIds?: string[], brandIds?: string[], productIds?: string[]): Promise<{
        promotion: any;
        appliedPoints: number;
        appliedDiscount: number;
    }[]>;
    static promotionApplies(promo: any, context: {
        categoryIds: string[];
        brandIds: string[];
        productIds: string[];
        items: Array<{
            productId: string;
            quantity: number;
            lineTotal: number;
        }>;
        subtotal: number;
    }): boolean;
    static calculatePromotionImpact(promo: any, subtotal: number, _basePoints: number): {
        points: number;
        discount: number;
    };
}
export {};
//# sourceMappingURL=promotion.service.d.ts.map