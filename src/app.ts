import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';
import { generalLimiter } from './middleware/rateLimiter.middleware';
import { internalAuth } from './middleware/internalAuth.middleware';

// Route imports
import authRoutes from './modules/auth/auth.routes';
import providersRoutes from './modules/providers/providers.routes';
import customersRoutes from './modules/customers/customers.routes';
import serviceRequestsRoutes from './modules/service-requests/service-requests.routes';
import bookingsRoutes from './modules/bookings/bookings.routes';
import reviewsRoutes from './modules/reviews/reviews.routes';
import inquiriesRoutes from './modules/inquiries/inquiries.routes';
import housingRoutes from './modules/housing/housing.routes';
import pointsRoutes from './modules/points/points.routes';
import adminRoutes from './modules/admin/admin.routes';
import internalRoutes from './modules/internal/internal.routes';

const app = express();

// ─── Security middleware ──────────────────────────────────────────────────────
app.use(helmet());
app.use(
  cors({
    origin: (origin, callback) => {
      // Allowed origins from env + sensible defaults
      const allowedRaw = config.frontendUrl
        ? config.frontendUrl.split(',').map(s => s.trim())
        : [];
      const allowed = [
        ...allowedRaw,
        'http://localhost:3000',
        'http://localhost:3001',
        'https://haven-rccg.vercel.app',
        'https://rccg-hackathon.vercel.app',
      ];
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS blocked: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Internal-Key'],
  })
);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use((req, res, next) => {
  if (req.originalUrl === '/api/v1/bookings/paystack/callback') {
    next();
  } else {
    express.json({ limit: '10mb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Logging ─────────────────────────────────────────────────────────────────
if (config.isDev) {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined'));
}

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/', generalLimiter);

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'haven-api', timestamp: new Date().toISOString() });
});

// ─── API Routes ───────────────────────────────────────────────────────────────
const API = '/api/v1';

app.use(`${API}/auth`, authRoutes);
app.use(`${API}/providers`, providersRoutes);
app.use(`${API}/customers`, customersRoutes);
app.use(`${API}/service-requests`, serviceRequestsRoutes);
app.use(`${API}/bookings`, bookingsRoutes);
app.use(`${API}/inquiries`, inquiriesRoutes);
app.use(`${API}/housing`, housingRoutes);
app.use(`${API}/points`, pointsRoutes);
app.use(`${API}/admin`, adminRoutes);

// Reviews nested under bookings path
app.use(`${API}`, reviewsRoutes);

// ─── Internal API (bot-only) ─────────────────────────────────────────────────
app.use(`${API}/internal`, internalAuth, internalRoutes);

// ─── 404 + Error handlers ─────────────────────────────────────────────────────
app.use(notFoundHandler);
app.use(errorHandler);

export default app;
