// API Configuration
// Note: Vercel Hobby plan limits serverless functions to 300 seconds (5 minutes)
export const MAX_DURATION = 300 // 5 minutes

export const API_CONFIG = {
  // Maximum request timeout in seconds
  // Set to 300s to comply with Vercel Hobby plan limits
  MAX_DURATION,
} as const
