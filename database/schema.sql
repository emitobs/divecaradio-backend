-- Diveca Radio - Schema de Base de Datos
-- Ejecutar: mysql -u usuario -p nombre_db < schema.sql

-- Crear base de datos si no existe
CREATE DATABASE IF NOT EXISTS divecaradio_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE divecaradio_db;

-- Tabla de roles
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de permisos
CREATE TABLE IF NOT EXISTS permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de relacion roles-permisos
CREATE TABLE IF NOT EXISTS role_permissions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  permission_id INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE,
  UNIQUE KEY unique_role_permission (role_id, permission_id)
);

-- Tabla de usuarios
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  username VARCHAR(50) NOT NULL,
  role_id INT NOT NULL DEFAULT 1,
  is_active BOOLEAN DEFAULT TRUE,
  is_blocked BOOLEAN DEFAULT FALSE,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id),
  INDEX idx_email (email),
  INDEX idx_username (username)
);

-- Tabla de sesiones bloqueadas
CREATE TABLE IF NOT EXISTS blocked_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  client_id VARCHAR(255) NOT NULL,
  user_id INT NULL,
  blocked_by INT NOT NULL,
  reason VARCHAR(500),
  blocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  unblocked_at TIMESTAMP NULL,
  is_active BOOLEAN DEFAULT TRUE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (blocked_by) REFERENCES users(id),
  INDEX idx_client_id (client_id),
  INDEX idx_active (is_active)
);

-- Insertar roles (ignorar si existen)
INSERT IGNORE INTO roles (name, description) VALUES 
('user', 'Usuario regular del chat'),
('moderator', 'Moderador con permisos de bloqueo'),
('admin', 'Administrador con todos los permisos');

-- Insertar permisos (ignorar si existen)
INSERT IGNORE INTO permissions (name, description) VALUES 
('chat.send', 'Enviar mensajes en el chat'),
('chat.moderate', 'Moderar chat (bloquear/desbloquear usuarios)'),
('admin.panel', 'Acceso al panel de administracion'),
('admin.users', 'Gestionar usuarios'),
('admin.roles', 'Gestionar roles y permisos');

-- Asignar permisos a roles (ignorar si existen)
INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'user' AND p.name = 'chat.send';

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'moderator' AND p.name IN ('chat.send', 'chat.moderate');

INSERT IGNORE INTO role_permissions (role_id, permission_id) 
SELECT r.id, p.id FROM roles r, permissions p 
WHERE r.name = 'admin';

-- Verificar que todo se creo correctamente
SELECT 'Roles creados:' as info;
SELECT * FROM roles;

SELECT 'Permisos creados:' as info;
SELECT * FROM permissions;

SELECT 'Asignaciones de permisos:' as info;
SELECT r.name as rol, p.name as permiso 
FROM role_permissions rp 
JOIN roles r ON rp.role_id = r.id 
JOIN permissions p ON rp.permission_id = p.id;
