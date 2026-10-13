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
export declare class CampaignService {
    static getRecipients(): Promise<{
        recipients: CampaignRecipient[];
        total: number;
        withPhone: number;
        withoutPhone: number;
    }>;
    static sendCampaign(input: SendCampaignInput): Promise<CampaignResult>;
}
//# sourceMappingURL=campaign.service.d.ts.map