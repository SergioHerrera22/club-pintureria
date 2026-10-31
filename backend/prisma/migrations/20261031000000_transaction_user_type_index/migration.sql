-- Índice compuesto para los groupBy por usuario+tipo (vencimiento de puntos,
-- listados con estado de vencimiento) y consultas de historial filtradas por tipo.
CREATE INDEX "Transaction_userId_type_idx" ON "Transaction"("userId", "type");
