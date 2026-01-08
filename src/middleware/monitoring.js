const express = require('express');
const logger = require('../utils/logger');

/**
 * Monitoring and Health Check Middleware
 * =====================================
 */

const startTime = Date.now();

// Métricas básicas
const metrics = {
  requests: 0,
  errors: 0,
  uptime: () => Date.now() - startTime,
  memory: () => process.memoryUsage(),
  cpu: () => process.cpuUsage()
};

// Middleware para contar requests
const requestCounter = (req, res, next) => {
  metrics.requests++;

  // Log request details
  logger.info('HTTP Request', {
    method: req.method,
    url: req.url,
    userAgent: req.get('User-Agent'),
    ip: req.ip
  });

  next();
};

// Middleware para contar errores
const errorCounter = (err, req, res, next) => {
  metrics.errors++;

  logger.error('HTTP Error', {
    error: err.message,
    stack: err.stack,
    method: req.method,
    url: req.url,
    ip: req.ip
  });

  res.status(500).json({ error: 'Internal Server Error' });
};

// Health check endpoint
const healthCheck = (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: metrics.uptime(),
    memory: metrics.memory(),
    metrics: {
      totalRequests: metrics.requests,
      totalErrors: metrics.errors,
      errorRate: metrics.requests > 0 ? (metrics.errors / metrics.requests * 100).toFixed(2) + '%' : '0%'
    },
    version: process.env.npm_package_version || '1.0.0',
    environment: process.env.NODE_ENV || 'development'
  };

  res.json(health);
};

// Metrics endpoint
const metricsEndpoint = (req, res) => {
  const currentMetrics = {
    requests_total: metrics.requests,
    errors_total: metrics.errors,
    uptime_seconds: Math.floor(metrics.uptime() / 1000),
    memory_usage: metrics.memory(),
    cpu_usage: metrics.cpu()
  };

  res.json(currentMetrics);
};

module.exports = {
  requestCounter,
  errorCounter,
  healthCheck,
  metricsEndpoint,
  metrics
};
