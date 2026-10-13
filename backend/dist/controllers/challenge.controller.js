"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.deleteChallenge = exports.updateChallenge = exports.createChallenge = exports.getChallengeById = exports.getChallenges = void 0;
const challenge_service_1 = require("../services/challenge.service");
const errorHandler_1 = require("../middleware/errorHandler");
const client_1 = require("@prisma/client");
const getChallenges = async (req, res, next) => {
    try {
        const { page = 1, limit = 20, isActive, type } = req.query;
        const filters = {};
        if (isActive !== undefined)
            filters.isActive = isActive === 'true';
        if (type)
            filters.type = type;
        if (page)
            filters.page = Number(page);
        if (limit)
            filters.limit = Number(limit);
        const result = await challenge_service_1.ChallengeService.getChallenges(filters);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
};
exports.getChallenges = getChallenges;
const getChallengeById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const challenge = await challenge_service_1.ChallengeService.getChallengeById(id);
        res.json(challenge);
    }
    catch (error) {
        next(error);
    }
};
exports.getChallengeById = getChallengeById;
const createChallenge = async (req, res, next) => {
    try {
        const { name, description, imageUrl, type, target, condition, rewardPoints, rewardCoupon, startDate, endDate, isActive } = req.body;
        if (!Object.values(client_1.ChallengeType).includes(type)) {
            throw new errorHandler_1.AppError(400, 'Tipo de desafío inválido');
        }
        const challenge = await challenge_service_1.ChallengeService.createChallenge({
            name,
            description,
            imageUrl,
            type,
            target,
            condition,
            rewardPoints,
            rewardCoupon,
            startDate: new Date(startDate),
            endDate: new Date(endDate),
            isActive,
        });
        res.status(201).json(challenge);
    }
    catch (error) {
        next(error);
    }
};
exports.createChallenge = createChallenge;
const updateChallenge = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { name, description, imageUrl, type, target, condition, rewardPoints, rewardCoupon, startDate, endDate, isActive } = req.body;
        const challenge = await challenge_service_1.ChallengeService.updateChallenge(id, {
            name,
            description,
            imageUrl,
            type,
            target,
            condition,
            rewardPoints,
            rewardCoupon,
            startDate: startDate ? new Date(startDate) : undefined,
            endDate: endDate ? new Date(endDate) : undefined,
            isActive,
        });
        res.json(challenge);
    }
    catch (error) {
        next(error);
    }
};
exports.updateChallenge = updateChallenge;
const deleteChallenge = async (req, res, next) => {
    try {
        const { id } = req.params;
        await challenge_service_1.ChallengeService.deleteChallenge(id);
        res.json({ message: 'Desafío eliminado' });
    }
    catch (error) {
        next(error);
    }
};
exports.deleteChallenge = deleteChallenge;
//# sourceMappingURL=challenge.controller.js.map