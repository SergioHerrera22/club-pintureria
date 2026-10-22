import { SaleRevisionStatus, Prisma } from '@prisma/client';
/**
 * Comienzo del día "hoy" en hora Argentina (UTC-3).
 * Las ventas sólo pueden revisarse el mismo día calendario local.
 */
export declare const startOfTodayArgentina: () => Date;
interface RevisionItemInput {
    productId: string;
    quantity: number;
    discount?: number;
}
interface RequestRevisionDTO {
    items?: RevisionItemInput[];
    newClientDni?: string;
    notes?: string;
    observation: string;
}
export declare class SaleRevisionService {
    /**
     * Ventas realizadas por el usuario autenticado (cajera/vendedor/admin),
     * con el estado de su última solicitud de revisión.
     */
    static getMySales(filters: {
        userId: string;
        dni?: string;
        page?: number;
        limit?: number;
        startDate?: Date;
        endDate?: Date;
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
            vendorName: string | null;
            itemCount: number;
            items: {
                productId: string;
                productName: string;
                productCode: string;
                quantity: number;
                unitPrice: number;
                discount: number;
                lineTotal: number;
            }[];
            canRequestRevision: boolean;
            revision: {
                id: string;
                status: import(".prisma/client").$Enums.SaleRevisionStatus;
                observation: string;
                adminResponse: string | null;
                reviewedByName: string | null;
                reviewedAt: Date | null;
                createdAt: Date;
            } | null;
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    /**
     * El vendedor/cajera solicita una revisión de una venta propia del día.
     * Calcula un preview del impacto (totales y puntos) para que el admin
     * sepa qué va a cambiar antes de aprobar.
     */
    static requestRevision(purchaseId: string, user: NonNullable<import('../middleware/auth').AuthRequest['user']>, payload: RequestRevisionDTO): Promise<{
        revision: {
            status: import(".prisma/client").$Enums.SaleRevisionStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            purchaseId: string;
            requestedById: string;
            changes: Prisma.JsonValue;
            originalData: Prisma.JsonValue;
            observation: string;
            preview: Prisma.JsonValue | null;
            adminResponse: string | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
        };
        preview: {
            subtotal: number;
            discount: number;
            tax: number;
            total: number;
            pointsEarned: number;
            pointsDelta: number;
        };
        originalData: {
            clientId: string;
            clientDni: string;
            clientName: string;
            notes: string | null;
            items: {
                productId: string;
                productName: string;
                productCode: string;
                quantity: number;
                unitPrice: number;
                discount: number;
                lineTotal: number;
            }[];
            subtotal: number;
            discount: number;
            tax: number;
            total: number;
            pointsEarned: number;
        };
    }>;
    /** Listado de solicitudes para el administrador */
    static listRevisions(filters: {
        status?: SaleRevisionStatus;
        page?: number;
        limit?: number;
    }): Promise<{
        revisions: {
            id: string;
            status: import(".prisma/client").$Enums.SaleRevisionStatus;
            observation: string;
            changes: Prisma.JsonValue;
            originalData: Prisma.JsonValue;
            preview: Prisma.JsonValue;
            adminResponse: string | null;
            createdAt: Date;
            reviewedAt: Date | null;
            reviewedByName: string | null;
            requestedBy: {
                name: string;
                dni: string;
            };
            purchase: {
                id: string;
                receiptNumber: string;
                total: number;
                pointsEarned: number;
                createdAt: Date;
                status: import(".prisma/client").$Enums.PurchaseStatus;
                client: {
                    name: string;
                    dni: string;
                };
                branch: {
                    name: string;
                    code: string;
                };
            };
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
        pendingCount: number;
    }>;
    /** Vendedores activos para el selector al registrar una venta */
    static getVendorsForSale(user: NonNullable<import('../middleware/auth').AuthRequest['user']>): Promise<{
        id: string;
        name: string;
        dni: string;
    }[]>;
    /** Solicitudes del propio usuario (con respuesta del admin si fue revisada) */
    static getMyRevisions(userId: string, filters: {
        page?: number;
        limit?: number;
    }): Promise<{
        revisions: {
            id: string;
            status: import(".prisma/client").$Enums.SaleRevisionStatus;
            observation: string;
            adminResponse: string | null;
            createdAt: Date;
            reviewedAt: Date | null;
            reviewedByName: string | null;
            purchase: {
                receiptNumber: string;
                total: number;
                createdAt: Date;
            };
        }[];
        pagination: {
            page: number;
            limit: number;
            total: number;
            pages: number;
        };
    }>;
    /**
     * Aprobación por el administrador: aplica los cambios propuestos,
     * recalcula totales/puntos y ajusta los perfiles de los clientes.
     */
    static approveRevision(revisionId: string, adminId: string, note?: string): Promise<{
        message: string;
        applied: {
            total: number;
            pointsEarned: number;
            pointsDelta: number;
            clientChanged: boolean;
            newClientBalance: number;
        };
    }>;
    /** Rechazo por el administrador: queda constancia del motivo */
    static rejectRevision(revisionId: string, adminId: string, reason: string): Promise<{
        message: string;
        revision: {
            status: import(".prisma/client").$Enums.SaleRevisionStatus;
            id: string;
            createdAt: Date;
            updatedAt: Date;
            purchaseId: string;
            requestedById: string;
            changes: Prisma.JsonValue;
            originalData: Prisma.JsonValue;
            observation: string;
            preview: Prisma.JsonValue | null;
            adminResponse: string | null;
            reviewedById: string | null;
            reviewedAt: Date | null;
        };
    }>;
}
export {};
//# sourceMappingURL=saleRevision.service.d.ts.map