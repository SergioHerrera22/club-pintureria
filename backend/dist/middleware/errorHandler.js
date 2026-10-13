"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notFoundHandler = exports.errorHandler = exports.AppError = void 0;
const zod_1 = require("zod");
const client_1 = require("@prisma/client");
const config_1 = require("../config");
class AppError extends Error {
    statusCode;
    message;
    details;
    constructor(statusCode, message, details) {
        super(message);
        this.statusCode = statusCode;
        this.message = message;
        this.details = details;
        Object.setPrototypeOf(this, AppError.prototype);
    }
}
exports.AppError = AppError;
const errorHandler = (err, req, res, next) => {
    console.error('Error:', err);
    if (err instanceof zod_1.ZodError) {
        res.status(400).json({
            error: 'Validación fallida',
            details: err.errors.map(e => ({
                field: e.path.join('.'),
                message: e.message,
            })),
        });
        return;
    }
    if (err instanceof client_1.Prisma.PrismaClientKnownRequestError) {
        if (err.code === 'P2002') {
            const field = err.meta?.target?.join(', ') || 'campo';
            res.status(409).json({ error: `El ${field} ya existe` });
            return;
        }
        if (err.code === 'P2025') {
            res.status(404).json({ error: 'Recurso no encontrado' });
            return;
        }
    }
    if (err instanceof AppError) {
        res.status(err.statusCode).json({
            error: err.message,
            details: err.details,
        });
        return;
    }
    if (err instanceof SyntaxError && 'status' in err) {
        res.status(400).json({ error: 'JSON inválido' });
        return;
    }
    res.status(500).json({
        error: config_1.config.nodeEnv === 'production'
            ? 'Error interno del servidor'
            : err.message,
    });
};
exports.errorHandler = errorHandler;
const notFoundHandler = (req, res) => {
    res.status(404).json({ error: `Ruta no encontrada: ${req.method} ${req.path}` });
};
exports.notFoundHandler = notFoundHandler;
//# sourceMappingURL=errorHandler.js.map