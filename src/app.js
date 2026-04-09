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
const catalogFoodRoutes = require('./routes/catalogFood');
const catalogExerciseRoutes = require('./routes/catalogExercise');
const checkInsRoutes = require('./routes/checkIns');
const messagesRoutes = require('./routes/messages');
const subscribeRoutes = require('./routes/subscribe');
const stripeWebhook = require('./routes/stripeWebhook');
const { authRequired, loadUser } = require('./middleware/auth');
const rateLimit = require('express-rate-limit');
const Callbacks = require('./models/callback');

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
app.use('/catalog/food', catalogFoodRoutes);
app.use('/catalog/exercise', catalogExerciseRoutes);
app.use('/check-ins', authRequired, loadUser, checkInsRoutes);
app.use('/messages', authRequired, loadUser, messagesRoutes);
app.use('/subscribe', authLimiter, authRequired, loadUser, subscribeRoutes);
//callback test - when callback is called, it will save the data to the database
//app.post
app.post('/callback', async (req, res) => {
  try {
    let logsToSave;
    let isValid = req.body && typeof req.body === 'object';

    if (!isValid) {
      // Save the invalid payload in Callbacks as well
      logsToSave = { error: 'Invalid logs payload', received: req.body };
      const callback = new Callbacks({ logs: logsToSave });
      await callback.save();
      return res.status(400).json({ ok: false, message: 'Invalid logs payload' });
    } else {
      logsToSave = req.body;
      const callback = new Callbacks({ logs: logsToSave });
      await callback.save();
      return res.json({
        ok: true,
        message: 'Callback received',
      });
    }
  } catch (err) {
    console.error('[fitsphere] Error in /callback:', err);
    res.status(500).json({
      ok: false,
      message: 'Server error',
      error: err.message,
    });
  }
});


app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

module.exports = app;
