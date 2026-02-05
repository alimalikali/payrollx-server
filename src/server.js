const app = require('./app');
const config = require('./config');
const { testConnection } = require('./config/database');

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION! Shutting down...');
  console.error(err.name, err.message);
  console.error(err.stack);
  process.exit(1);
});

// Start server
const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.error('Failed to connect to database. Exiting...');
      process.exit(1);
    }

    // Start listening
    const server = app.listen(config.port, () => {
      console.log('');
      console.log('='.repeat(60));
      console.log('  PayrollX Server');
      console.log('='.repeat(60));
      console.log(`  Environment: ${config.nodeEnv}`);
      console.log(`  Port:        ${config.port}`);
      console.log(`  Client URL:  ${config.clientUrl}`);
      console.log('='.repeat(60));
      console.log('');
      console.log('  API Endpoints:');
      console.log(`  Health:      http://localhost:${config.port}/health`);
      console.log(`  API Root:    http://localhost:${config.port}/api/v1`);
      console.log('');
      console.log('='.repeat(60));
      console.log('  Server is ready to accept connections');
      console.log('='.repeat(60));
      console.log('');
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (err) => {
      console.error('UNHANDLED REJECTION! Shutting down...');
      console.error(err.name, err.message);
      console.error(err.stack);
      server.close(() => {
        process.exit(1);
      });
    });

    // Graceful shutdown
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
      });

      // Force close after 30 seconds
      setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start the server
startServer();
