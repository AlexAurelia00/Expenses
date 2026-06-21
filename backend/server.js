import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Import Middleware
import { requireAuth } from './middleware/authMiddleware.js';

// Import Controllers
import * as userController from './controllers/userController.js';
import * as groupController from './controllers/groupController.js';
import * as expenseController from './controllers/expenseController.js';
import * as settlementController from './controllers/settlementController.js';
import * as reportController from './controllers/reportController.js';
import * as notificationController from './controllers/notificationController.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Security Middlewares
app.use(helmet());
app.use(cors({
  origin: '*', // Customize this for production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(express.json());

// Global Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per windowMs
  message: { error: 'Too many requests from this IP, please try again after 15 minutes.' }
});
app.use('/api', limiter);

// Root test route
app.get('/', (req, res) => {
  res.json({ message: 'Splitwise Clone API is operational.' });
});

/* ==========================================================================
   ROUTES (All routes under /api require Authorization header)
   ========================================================================== */

// 1. User & Profile Routes
app.put('/api/users/me', requireAuth, userController.updateProfile);
app.delete('/api/users/me', requireAuth, userController.deleteAccount);

// 2. Group Routes
app.post('/api/groups', requireAuth, groupController.createGroup);
app.get('/api/groups', requireAuth, groupController.getGroups);
app.get('/api/groups/:id', requireAuth, groupController.getGroupById);
app.post('/api/groups/:id/members', requireAuth, groupController.addMember);
app.delete('/api/groups/:id/members/:userId', requireAuth, groupController.removeMember);
app.post('/api/groups/:id/leave', requireAuth, groupController.leaveGroup);
app.put('/api/groups/:id/members/:userId/role', requireAuth, groupController.updateMemberRole);
app.delete('/api/groups/:id', requireAuth, groupController.deleteGroup);

// 3. Expense Routes
app.post('/api/expenses', requireAuth, expenseController.addExpense);
app.put('/api/expenses/:id', requireAuth, expenseController.updateExpense);
app.delete('/api/expenses/:id', requireAuth, expenseController.deleteExpense);

// 4. Settlement Routes
app.post('/api/settlements', requireAuth, settlementController.createSettlement);
app.patch('/api/settlements/:id/status', requireAuth, settlementController.updateSettlementStatus);

// 5. Reports & Analytics Routes
app.get('/api/reports/summary', requireAuth, reportController.getSummary);
app.get('/api/reports/export/:format', requireAuth, reportController.exportReport);

// 6. Notification Routes
app.get('/api/notifications', requireAuth, notificationController.getNotifications);
app.patch('/api/notifications/:id/read', requireAuth, notificationController.markAsRead);

// Serve frontend static files if present (bundled into backend/public)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.join(__dirname, 'public');

if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));

  // Serve index.html for client-side routes, but let /api routes fall through to API handlers
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(path.join(publicDir, 'index.html'));
  });
}

// 404 Route handler (if no frontend served or route not found)
app.use((req, res, next) => {
  if (req.path.startsWith('/api')) {
    return res.status(404).json({ error: 'Route not found' });
  }
  // For non-API routes, fall back to a simple message when frontend not bundled
  res.status(404).send('Not Found');
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong on the server: ' + err.message });
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
