-- AlterTable: permisos de menú personalizados por usuario.
-- null = usa los permisos por defecto de su rol.
ALTER TABLE "User" ADD COLUMN "permissions" JSONB;
