// Parse Google Gemini API keys from environment variables.
// Supports single key or comma-separated multiple keys (e.g. "key1,key2").
const getGeminiApiKeys = () => {
  const envKeys =
    process.env.NEXT_PUBLIC_GEMINI_API_KEY ||
    process.env.NEXT_PUBLIC_GEMINI_API_KEYS ||
    process.env.REACT_APP_GEMINI_API_KEY ||
    process.env.REACT_APP_GEMINI_API_KEYS ||
    process.env.GEMINI_API_KEY ||
    '';

  if (!envKeys) return [];

  return envKeys
    .split(',')
    .map((key) => key.trim())
    .filter(Boolean);
};

export const GEMINI_API_KEYS = getGeminiApiKeys();
export const GEMINI_API_KEY = GEMINI_API_KEYS[0] || '';