export interface CampaignRecipient {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
    phone: string | null;
    currentPoints: number;
    /** Puntos ganados en la última compra del cliente (0 si nunca compró). */
    lastPointsEarned: number;
    branchId: string | null;
    branchName: string | null;
    /** Fecha de alta del cliente. El frontend la usa para mostrar el badge "Nuevo". */
    createdAt: string;
}
export interface SendCampaignInput {
    message: string;
    sendToAll?: boolean;
    recipientIds?: string[];
    testPhone?: string;
    /** Filtra destinatarios por sucursal (vacío/ausente = todas). */
    branchId?: string;
}
export interface CampaignResult {
    total: number;
    sent: number;
    failed: number;
    skippedNoPhone: number;
    isTest: boolean;
    errors: Array<{
        recipient: string;
        error: string;
    }>;
}
export interface PreparedMessage {
    id: string;
    name: string;
    /** Teléfono normalizado para WhatsApp (con código de país, sin +) */
    phone: string;
    /** Mensaje con las variables ya reemplazadas para este destinatario */
    message: string;
}
export interface PrepareCampaignResult {
    isTest: boolean;
    messages: PreparedMessage[];
    skipped: Array<{
        name: string;
        phone: string | null;
        reason: string;
    }>;
}
export declare class CampaignService {
    /**
     * Filtro de sucursal para los destinatarios:
     * - Sin branchId (o vacío): todos los clientes.
     * - Con branchId: solo los clientes de esa sucursal.
     */
    private static branchWhere;
    static getRecipients(branchId?: string): Promise<{
        recipients: CampaignRecipient[];
        total: number;
        withPhone: number;
        withoutPhone: number;
    }>;
    static sendCampaign(input: SendCampaignInput): Promise<CampaignResult>;
    /**
     * Mapea un usuario (cliente) al formato de destinatario de la campaña.
     * Compartido entre el listado y la resolución de destinatarios del envío.
     */
    private static toRecipient;
    private static resolveRecipients;
    /**
     * Completa cada destinatario con los puntos ganados en su última compra
     * (variable {puntos} de la campaña). Una sola query con distinct por cliente.
     */
    private static attachLastPointsEarned;
    /**
     * Prepara la campaña sin enviarla: devuelve el mensaje ya renderizado y el
     * teléfono normalizado de cada destinatario, para que el frontend abra
     * WhatsApp Web con el texto precargado.
     */
    static prepareCampaign(input: SendCampaignInput): Promise<PrepareCampaignResult>;
}
//# sourceMappingURL=campaign.service.d.ts.map