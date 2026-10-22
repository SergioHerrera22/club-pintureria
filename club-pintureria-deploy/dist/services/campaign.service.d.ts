export interface CampaignRecipient {
    id: string;
    firstName: string;
    lastName: string;
    dni: string;
    phone: string | null;
    currentPoints: number;
}
export interface SendCampaignInput {
    message: string;
    sendToAll?: boolean;
    recipientIds?: string[];
    testPhone?: string;
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
    static getRecipients(): Promise<{
        recipients: CampaignRecipient[];
        total: number;
        withPhone: number;
        withoutPhone: number;
    }>;
    static sendCampaign(input: SendCampaignInput): Promise<CampaignResult>;
    private static resolveRecipients;
    /**
     * Prepara la campaña sin enviarla: devuelve el mensaje ya renderizado y el
     * teléfono normalizado de cada destinatario, para que el frontend abra
     * WhatsApp Web con el texto precargado.
     */
    static prepareCampaign(input: SendCampaignInput): Promise<PrepareCampaignResult>;
}
//# sourceMappingURL=campaign.service.d.ts.map