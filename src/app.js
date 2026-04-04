const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');
const authRoutes = require('./routes/auth');
const onboardingRoutes = require('./routes/onboarding');
const profileRoutes = require('./routes/profile');
const workoutsRoutes = require('./routes/workouts');
const challengesRoutes = require('./routes/challenges');
const sessionsRoutes = require('./routes/sessions');
const subscriptionsRoutes = require('./routes/subscriptions');
const analyticsRoutes = require('./routes/analytics');
const nutritionRoutes = require('./routes/nutrition');
const subscribeRoutes = require('./routes/subscribe');
const stripeWebhook = require('./routes/stripeWebhook');
const { authRequired, loadUser } = require('./middleware/auth');
const rateLimit = require('express-rate-limit');

const app = express();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(
  cors({
    origin: process.env.CLIENT_ORIGIN || 'http://localhost:5173',
    credentials: true,
  })
);
app.post('/webhooks/stripe', express.raw({ type: 'application/json' }), stripeWebhook);
app.use(express.json({ limit: '2mb' }));

app.get('/', (_req, res) => {
  res.json({
    ok: true,
    service: 'fitsphere-api',
    message: 'FitSphere MVP API is running.',
  });
});

app.use('/health', healthRoutes);
app.use('/auth', authLimiter, authRoutes);
app.use('/onboarding', onboardingRoutes);
app.use('/profile', profileRoutes);
app.use('/workouts', workoutsRoutes);
app.use('/challenges', challengesRoutes);
app.use('/sessions', sessionsRoutes);
app.use('/subscriptions', subscriptionsRoutes);
app.use('/analytics', analyticsRoutes);
app.use('/nutrition', nutritionRoutes);
app.use('/subscribe', authLimiter, authRequired, loadUser, subscribeRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
