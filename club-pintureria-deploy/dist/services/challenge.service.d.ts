import { ChallengeType, Prisma } from '@prisma/client';
interface ChallengeFilters {
    isActive?: boolean;
    type?: ChallengeType;
    page?: number;
    limit?: number;
}
export declare class ChallengeService {
    static getChallenges(filters?: ChallengeFilters): Promise<{
        challenges: {
            target: number;
            name: string;
            id: string;
            isActive: boolean;
            createdAt: Date;
            updatedAt: Date;
            type: import(".prisma/client").$Enums.ChallengeType;
            startDate: Date;
            endDate: Date;
            description: string;
            imageUrl: string | null;
            condition: Prisma.JsonValue;
            rewardPoints: number;
            rewardCoupon: string | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    static getClientChallenges(clientId: string): Promise<{
        progress: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            clientId: string;
            challengeId: string;
            currentValue: number;
            completed: boolean;
            completedAt: Date | null;
        } | {
            currentValue: number;
            completed: false;
        };
        target: number;
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ChallengeType;
        startDate: Date;
        endDate: Date;
        description: string;
        imageUrl: string | null;
        condition: Prisma.JsonValue;
        rewardPoints: number;
        rewardCoupon: string | null;
    }[]>;
    static getChallengeById(id: string): Promise<{
        progress: {
            id: string;
            createdAt: Date;
            updatedAt: Date;
            clientId: string;
            challengeId: string;
            currentValue: number;
            completed: boolean;
            completedAt: Date | null;
        }[];
    } & {
        target: number;
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ChallengeType;
        startDate: Date;
        endDate: Date;
        description: string;
        imageUrl: string | null;
        condition: Prisma.JsonValue;
        rewardPoints: number;
        rewardCoupon: string | null;
    }>;
    static createChallenge(data: {
        name: string;
        description: string;
        imageUrl?: string;
        type: ChallengeType;
        target: number;
        condition: any;
        rewardPoints: number;
        rewardCoupon?: string;
        startDate: Date;
        endDate: Date;
        isActive?: boolean;
    }): Promise<{
        target: number;
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ChallengeType;
        startDate: Date;
        endDate: Date;
        description: string;
        imageUrl: string | null;
        condition: Prisma.JsonValue;
        rewardPoints: number;
        rewardCoupon: string | null;
    }>;
    static updateChallenge(id: string, data: {
        name?: string;
        description?: string;
        imageUrl?: string;
        type?: ChallengeType;
        target?: number;
        condition?: any;
        rewardPoints?: number;
        rewardCoupon?: string;
        startDate?: Date;
        endDate?: Date;
        isActive?: boolean;
    }): Promise<{
        target: number;
        name: string;
        id: string;
        isActive: boolean;
        createdAt: Date;
        updatedAt: Date;
        type: import(".prisma/client").$Enums.ChallengeType;
        startDate: Date;
        endDate: Date;
        description: string;
        imageUrl: string | null;
        condition: Prisma.JsonValue;
        rewardPoints: number;
        rewardCoupon: string | null;
    }>;
    static deleteChallenge(id: string): Promise<{
        message: string;
    }>;
    static updateProgressOnPurchase(clientId: string, items: Array<{
        productId: string;
        quantity: number;
        unitPrice: number;
        lineTotal: number;
        product: any;
    }>, total: number): Promise<void>;
    private static challengeAppliesToClient;
    private static calculateProgress;
    static completeChallenge(clientId: string, challenge: any): Promise<void>;
}
export {};
//# sourceMappingURL=challenge.service.d.ts.map