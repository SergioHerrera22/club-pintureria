import { BenefitType } from '@prisma/client';
export declare class BenefitService {
    static getActiveBenefits(): Promise<{
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.BenefitType;
        startDate: Date | null;
        endDate: Date | null;
        description: string;
        imageUrl: string | null;
        autoApply: boolean;
    }[]>;
    static getAllBenefits(filters: {
        type?: BenefitType;
        isActive?: boolean;
        page?: number;
        limit?: number;
    }): Promise<{
        benefits: {
            name: string;
            value: number;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.BenefitType;
            startDate: Date | null;
            endDate: Date | null;
            description: string;
            imageUrl: string | null;
            autoApply: boolean;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    static getBenefitById(id: string): Promise<{
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.BenefitType;
        startDate: Date | null;
        endDate: Date | null;
        description: string;
        imageUrl: string | null;
        autoApply: boolean;
    } | null>;
    static createBenefit(data: {
        name: string;
        description: string;
        imageUrl?: string;
        type: BenefitType;
        value: number;
        isActive?: boolean;
        startDate?: Date;
        endDate?: Date;
        autoApply?: boolean;
    }): Promise<{
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.BenefitType;
        startDate: Date | null;
        endDate: Date | null;
        description: string;
        imageUrl: string | null;
        autoApply: boolean;
    }>;
    static updateBenefit(id: string, data: Partial<{
        name: string;
        description: string;
        imageUrl?: string;
        type: BenefitType;
        value: number;
        isActive: boolean;
        startDate?: Date;
        endDate?: Date;
        autoApply: boolean;
    }>): Promise<{
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.BenefitType;
        startDate: Date | null;
        endDate: Date | null;
        description: string;
        imageUrl: string | null;
        autoApply: boolean;
    }>;
    static deleteBenefit(id: string): Promise<{
        name: string;
        value: number;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.BenefitType;
        startDate: Date | null;
        endDate: Date | null;
        description: string;
        imageUrl: string | null;
        autoApply: boolean;
    }>;
}
//# sourceMappingURL=benefit.service.d.ts.map