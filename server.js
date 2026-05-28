const express = require('express');
const cors = require('cors');
const path = require('path');
const { initDatabase } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function startServer() {
  await initDatabase();

  app.use('/api/auth', require('./routes/auth'));
  app.use('/api', require('./routes/products'));
  app.use('/api/cart', require('./routes/cart'));
  app.use('/api/orders', require('./routes/orders'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/student', require('./routes/student'));

  app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`\n  ✅ রুসুখ অনলাইন একাডেমি server running at:`);
    console.log(`  ➜  http://localhost:${PORT}`);
    console.log(`  ➜  Admin: http://localhost:${PORT}/admin/login.html\n`);
  });
}

startServer().catch(err => { console.error('Failed to start server:', err); process.exit(1); });
