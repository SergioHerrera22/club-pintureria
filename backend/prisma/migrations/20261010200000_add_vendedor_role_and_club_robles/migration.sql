-- Add VENDEDOR role
ALTER TYPE "UserRole" ADD VALUE IF NOT EXISTS 'VENDEDOR';

-- Club Robles branding
UPDATE "SystemConfig"
SET "value" = '{"name": "Club Robles"}'::jsonb, "updatedAt" = NOW()
WHERE "key" = 'company_name';

UPDATE "SystemConfig"
SET "value" = '{"email": "soporte@clubrobles.com"}'::jsonb, "updatedAt" = NOW()
WHERE "key" = 'support_email';

-- Puntos: 0.04 puntos por cada $1
UPDATE "SystemConfig"
SET "value" = '{"rate": 0.04, "currency": "ARS"}'::jsonb,
    "description" = 'Puntos por unidad de moneda (0.04 = 4 puntos por cada $100 ARS). Las reglas POR_MONTO pueden sobrescribirla con puntosPorMonto',
    "updatedAt" = NOW()
WHERE "key" = 'points_per_currency';

UPDATE "PointRule"
SET "config" = jsonb_set("config", '{puntosPorMonto}', '0.04'::jsonb),
    "name" = 'Regla Base: 0.04 puntos por $1'
WHERE "id" = 'rule-base';

-- Enviar WhatsApp de puntos por defecto
UPDATE "SystemConfig"
SET "value" = '{"enabled": true}'::jsonb, "updatedAt" = NOW()
WHERE "key" = 'whatsapp_notifications_enabled';

-- Plantillas de WhatsApp configurables
INSERT INTO "SystemConfig" ("key", "value", "description", "updatedAt")
VALUES (
  'whatsapp_templates',
  '{
    "points_earned": "Hola {nombre}!\n\nGanaste *{puntos} puntos* en tu compra.\nTu nuevo saldo es: *{total} puntos*.\n\nSegui comprando para canjear por premios increibles.\n\n{empresa}",
    "welcome": "Hola {nombre}!\n\nBienvenido a *{empresa}*.\n\nTu cuenta esta lista para empezar a ganar puntos en cada compra. Presenta tu DNI en la sucursal y empeza a sumar.\n\nTe esperamos.\n\n{empresa}",
    "redemption": "Hola {nombre}!\n\nCanjeaste *{premio}* por *{puntos} puntos*.\nTu saldo actual: *{total} puntos*.\n\nPasa por la sucursal para retirar tu premio.\n\n{empresa}",
    "points_expiring": "Aviso {empresa}\n\nTus *{puntos} puntos* venceran en *{dias} dias* por inactividad.\n\nRealiza una compra para mantenerlos activos.\n\n{empresa}",
    "campaign_default": "Hola {nombre}!\n\n{empresa} tiene novedades para vos.\n\nTe esperamos."
  }'::jsonb,
  'Plantillas editables de los mensajes de WhatsApp. Variables: {nombre}, {apellido}, {dni}, {puntos}, {total}, {premio}, {dias}, {empresa}',
  NOW()
)
ON CONFLICT ("key") DO NOTHING;
