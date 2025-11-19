import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  throw new Error('❌ OPENAI_API_KEY manquante dans .env.local');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const OPENAI_CONFIG = {
  maxEmailLength: 800, // ⬆️ AUGMENTÉ de 1000 à 800
  maxAttachmentSize: 20_000_000,
  batchSize: 15, // ⬇️ RÉDUIT de 20 à 15 (emails plus longs = plus de temps)
  confidenceThreshold: 75, // ⬇️ RÉDUIT de 10 à 75 (plus permissif pour reçus)
  requestTimeout: 8000, // ⬆️ AUGMENTÉ de 15000 à 8000
} as const;

