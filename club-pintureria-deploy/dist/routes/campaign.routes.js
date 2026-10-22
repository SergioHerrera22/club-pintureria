"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../middleware/validation");
const campaignController = __importStar(require("../controllers/campaign.controller"));
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate, (0, auth_1.authorizeWithPermission)(['ADMIN', 'CAJERA'], 'campanas'));
router.get('/recipients', campaignController.getRecipients);
router.get('/templates', campaignController.getTemplates);
const sendCampaignSchema = zod_1.z.object({
    body: zod_1.z.object({
        message: zod_1.z.string().min(1, 'El mensaje es requerido'),
        sendToAll: zod_1.z.boolean().optional(),
        recipientIds: zod_1.z.array(zod_1.z.string()).optional(),
        testPhone: zod_1.z.string().optional(),
    }),
});
router.post('/send', (0, auth_1.requireMenuPermission)('campanas'), (0, validation_1.validate)(sendCampaignSchema), campaignController.sendCampaign);
router.post('/prepare', (0, auth_1.requireMenuPermission)('campanas'), (0, validation_1.validate)(sendCampaignSchema), campaignController.prepareCampaign);
exports.default = router;
//# sourceMappingURL=campaign.routes.js.map