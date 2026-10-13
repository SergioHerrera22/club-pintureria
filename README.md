# Club Pinturería - Sistema de Fidelidad

Sistema web de club de puntos para pinturería de repintado automotriz, similar al Club YPF.

## Características

- **Gestión de Clientes**: Búsqueda por DNI, registro de compras, historial
- **Sistema de Puntos**: Motor de reglas configurable (por monto, producto, categoría, primera compra, cumpleaños, rangos)
- **Catálogo de Premios**: Canje de puntos por descuentos, productos, herramientas, experiencias
- **Dashboard Admin**: Estadísticas en tiempo real, reportes de ventas y puntos
- **Roles**: Admin, Cajera, Cliente
- **Notificaciones**: Email (SMTP) para bienvenida, puntos ganados, canjes, cumpleaños
- **Portal Cliente**: Consulta de puntos solo con DNI (sin login)

## Stack Tecnológico

- **Backend**: Node.js + Express + TypeScript + Prisma ORM
- **Frontend**: React 18 + TypeScript + Vite + TailwindCSS
- **Base de Datos**: PostgreSQL
- **Autenticación**: JWT (Access + Refresh tokens)
- **Despliegue**: Docker + Docker Compose

## Requisitos Previos

- Node.js 20+
- PostgreSQL 15+
- Docker (opcional, para despliegue)

## Instalación Local

### 1. Clonar y configurar backend

```bash
cd backend
cp .env.example .env
# Editar .env con tus credenciales
npm install
npx prisma generate
npx prisma migrate dev --name init
npm run db:seed
npm run dev
```

### 2. Configurar frontend

```bash
cd frontend
npm install
npm run dev
```

### 3. Acceder a la aplicación

- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- API Health: http://localhost:3000/health

## Credenciales de Prueba (después de seed)

| Rol | Email | Contraseña |
|-----|-------|------------|
| Admin | admin@clubpintureria.com | 123456 |
| Cajera | cajera@clubpintureria.com | 123456 |
| Cliente | (DNI: 20123456) | 123456 |

## Despliegue en VPS con Docker

### 1. Preparar servidor

```bash
# Instalar Docker y Docker Compose
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
# Reiniciar sesión
```

### 2. Configurar variables de entorno

```bash
# En el servidor, crear archivo .env.production
cat > .env.production << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:secure_password@postgres:5432/club_pintureria
JWT_SECRET=tu-super-secreto-jwt-minimo-32-caracteres-cambiar-en-produccion
JWT_EXPIRES_IN=24h
JWT_REFRESH_EXPIRES_IN=7d
CORS_ORIGIN=https://tudominio.com
SMTP_HOST=smtp.tuproveedor.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=tu-email@dominio.com
SMTP_PASS=tu-password-smtp
SMTP_FROM=Club Pinturería <noreply@tudominio.com>
FRONTEND_URL=https://tudominio.com
EOF
```

### 3. Desplegar

```bash
# Clonar repo en el servidor
git clone <tu-repo> club-pintureria
cd club-pintureria

# Copiar env de producción
cp .env.production backend/.env
cp .env.production frontend/.env.production

# Construir y levantar
docker-compose -f docker-compose.yml up -d --build

# Ver logs
docker-compose logs -f backend
```

### 4. Configurar Nginx (Reverse Proxy)

```nginx
# /etc/nginx/sites-available/club-pintureria
server {
    listen 80;
    server_name tudominio.com www.tudominio.com;

    location / {
        proxy_pass http://localhost:5173;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/club-pintureria /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

### 5. SSL con Certbot

```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d tudominio.com -d www.tudominio.com
```

## Estructura del Proyecto

```
club-pintureria/
├── backend/
│   ├── src/
│   │   ├── config/         # Configuración (env, prisma)
│   │   ├── controllers/    # Controladores por módulo
│   │   ├── middleware/     # Auth, validación, errores
│   │   ├── routes/         # Rutas API
│   │   ├── services/       # Lógica de negocio (puntos, email)
│   │   ├── lib/            # Utilidades
│   │   └── index.ts        # Entry point
│   ├── prisma/
│   │   ├── schema.prisma   # Esquema DB
│   │   └── seed.ts         # Datos iniciales
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── components/     # Componentes reutilizables
│   │   ├── pages/          # Páginas (Dashboard, Clients, Products, etc.)
│   │   ├── stores/         # Estado global (Zustand)
│   │   ├── lib/            # API client, utils
│   │   └── types/          # Types TypeScript
│   ├── Dockerfile
│   └── nginx.conf
├── docker-compose.yml
└── README.md
```

## API Endpoints Principales

### Autenticación
- `POST /api/auth/login` - Login
- `POST /api/auth/register` - Registro (admin)
- `POST /api/auth/refresh` - Refresh token
- `GET /api/auth/me` - Usuario actual

### Clientes (Cajera)
- `GET /api/clients/dni/:dni` - Buscar cliente por DNI
- `GET /api/clients/dni/:dni/points` - Ver puntos (público)
- `GET /api/clients/dni/:dni/history` - Historial compras
- `POST /api/clients/purchase` - Registrar compra

### Admin
- `GET /api/admin/users` - Listar usuarios
- `POST /api/admin/users` - Crear usuario
- `PUT /api/admin/users/:id` - Actualizar usuario
- `POST /api/admin/adjust-points` - Ajustar puntos manualmente
- `GET /api/dashboard/stats` - Estadísticas dashboard
- `GET /api/dashboard/sales-report` - Reporte ventas
- `GET /api/dashboard/points-report` - Reporte puntos

### Productos
- `GET /api/products` - Listar productos
- `POST /api/products` - Crear producto (admin)
- `PUT /api/products/:id` - Actualizar producto (admin)

### Reglas de Puntos
- `GET /api/point-rules` - Listar reglas
- `POST /api/point-rules` - Crear regla (admin)
- `PUT /api/point-rules/:id` - Actualizar regla (admin)

### Premios
- `GET /api/prizes` - Listar premios
- `POST /api/prizes` - Crear premio (admin)
- `POST /api/prizes/redeem` - Canjear premio (cajera)
- `GET /api/prizes/redemptions/history` - Historial canjes

## Configuración de Reglas de Puntos

El sistema soporta 6 tipos de reglas configurables desde el panel admin:

1. **Por Monto (POR_MONTO)**: 1 punto cada $X gastados, con monto mínimo opcional
2. **Por Producto (POR_PRODUCTO)**: Puntos extra en productos específicos
3. **Por Categoría (POR_CATEGORIA)**: Multiplicador por categoría (ej: 2x en Barnices)
4. **Primera Compra (PRIMERA_COMPRA)**: Bonus de bienvenida
5. **Cumpleaños (CUMPLEANOS)**: Bonus en mes de cumpleaños
6. **Por Rangos (RANGO_MONTO)**: Puntos fijos según rango de monto

Las reglas tienen **prioridad** (mayor prioridad = se aplica primero) y **vigencia** (fechas de inicio/fin).

## Flujo de Trabajo Típico

1. **Cajera** inicia sesión → Dashboard
2. Cliente llega a caja → Cajera ingresa DNI → Sistema muestra cliente y puntos
3. Cajera selecciona productos → Sistema calcula puntos automáticamente según reglas
4. Cajera confirma compra → Puntos se acreditan instantáneamente
5. Cliente puede consultar sus puntos en `/points/<DNI>` desde su celular
6. Cliente canjea premios → Cajera procesa canje → Puntos se descuentan

## Variables de Entorno Importantes

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| DATABASE_URL | Conexión PostgreSQL | Sí |
| JWT_SECRET | Secreto JWT (min 32 chars) | Sí |
| SMTP_* | Configuración email | No (solo notificaciones) |
| CORS_ORIGIN | Origen frontend permitido | Sí |
| FRONTEND_URL | URL pública del frontend | Sí |

## Comandos Útiles

```bash
# Backend
cd backend
npm run dev              # Desarrollo con hot reload
npm run build            # Compilar TypeScript
npm run prisma:studio    # UI visual de base de datos
npm run db:seed          # Poblar datos de prueba

# Frontend
cd frontend
npm run dev              # Desarrollo
npm run build            # Build producción
npm run preview          # Preview build

# Docker
docker-compose up -d     # Levantar todo
docker-compose logs -f   # Ver logs
docker-compose down      # Parar todo
docker-compose exec backend npx prisma migrate deploy  # Migrar en prod
```

## Licencia

MIT