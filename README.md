# Diveca Radio - Backend API
Backend para back.divecaradio.com

## Requisitos
- Node.js 18+
- MySQL 8+

## Instalación
`ash
npm install --production
cp .env.example .env.production
# Editar .env.production con tus datos
mysql -u usuario -p divecaradio_db < database/schema.sql
`

## Variables de entorno
Ver .env.example

## Endpoints
- GET / - Health check
- POST /register - Registro
- POST /login - Login
- POST /logout - Logout
- GET /me - Usuario actual
- WS /ws - WebSocket chat

## Plesk/Passenger
Archivo de inicio: app.js
