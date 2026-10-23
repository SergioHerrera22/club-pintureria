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
/** Audiencias automáticas: grupos de destinatarios calculados en el servidor. */
export type AudienceKind = 'near_prize' | 'weekly_summary';
export interface StartCampaignInput extends SendCampaignInput {
    /** Si se indica, los destinatarios salen de esta audiencia */
    audience?: AudienceKind;
    /** near_prize: máximo de puntos faltantes para entrar en la audiencia */
    maxFaltan?: number;
    /** weekly_summary: ventana de días a considerar (por defecto 7) */
    days?: number;
}
export interface AudienceRecipient extends CampaignRecipient {
    /** Variables extra que sólo esta audiencia aporta al mensaje ({premio}, {faltan}…) */
    extra: Record<string, string | number>;
}
export interface AudienceResult {
    kind: AudienceKind;
    recipients: AudienceRecipient[];
    total: number;
    withPhone: number;
    withoutPhone: number;
}
export interface StartCampaignResult {
    /** null cuando es un envío de prueba (no se persiste nada) */
    campaignId: string | null;
    isTest: boolean;
    messages: PreparedMessage[];
    skipped: Array<{
        name: string;
        phone: string | null;
        reason: string;
    }>;
}
export interface CampaignProgress {
    id: string;
    name: string;
    audience: string | null;
    status: string;
    createdAt: Date;
    total: number;
    sent: number;
    skipped: number;
    pending: number;
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
    /** Filtra una lista de destinatarios por ids (vacío/ausente = sin filtrar). */
    private static filterIds;
    /**
     * Audiencias automáticas de campaña:
     * - near_prize: clientes que están a pocos puntos de un premio.
     * - weekly_summary: clientes que compraron en los últimos N días.
     * Devuelve los destinatarios con las variables extra de cada uno para que el
     * mensaje se renderice con datos propios ({premio}, {faltan}, {puntos_semana}…).
     */
    static getAudience(kind: AudienceKind, opts?: {
        branchId?: string;
        recipientIds?: string[];
        maxFaltan?: number;
        days?: number;
    }): Promise<AudienceResult>;
    /**
     * Inicia una campaña persistiéndola: un registro Campaign y un CampaignDelivery
     * por destinatario (PENDIENTE u OMITIDO). El frontend va marcando cada entrega
     * con ackDelivery; un destinatario sólo puede pasar de PENDIENTE una vez, así
     * que recargar la página o repetir el click no vuelve a enviar.
     * Los envíos de prueba no crean registro.
     */
    static startCampaign(input: StartCampaignInput, createdById?: string): Promise<StartCampaignResult>;
    /** Campañas sin terminar (para ofrecer "Retomar envío" al volver a entrar). */
    static getActiveCampaigns(limit?: number): Promise<CampaignProgress[]>;
    /** Progreso de una campaña + los destinatarios todavía pendientes. */
    static getCampaign(id: string): Promise<{
        progress: CampaignProgress;
        messages: PreparedMessage[];
    }>;
    /**
     * Marca un destinatario como procesado. La actualización es condicional
     * (sólo si sigue PENDIENTE): si ya estaba marcado, no se pisa el estado
     * y se devuelve alreadyProcessed=true. Al no quedar pendientes, la campaña
     * pasa a COMPLETADA.
     */
    static ackDelivery(campaignId: string, clientId: string, status: 'ENVIADO' | 'OMITIDO' | 'ERROR', reason?: string): Promise<{
        status: string;
        alreadyProcessed: boolean;
        pending: number;
    }>;
    /** Descarta una campaña: los pendientes quedan OMITIDos y el registro, CANCELADA. */
    static cancelCampaign(id: string): Promise<void>;
}
//# sourceMappingURL=campaign.service.d.ts.map