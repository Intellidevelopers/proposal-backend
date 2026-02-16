import rateLimit, { ipKeyGenerator } from "express-rate-limit";

export const generateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,

  keyGenerator: (req: any) =>
    req.user?.id ? `user:${req.user.id}` : ipKeyGenerator(req),

  message: {
    success: false,
    message: "20 generation limit/hour reached."
  },
});


// Brute-force protection for login/signup
export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, max: 10,
  message: { success: false, message: "Too many auth attempts. Try again in 15 min." },
  standardHeaders: true, legacyHeaders: false,
});