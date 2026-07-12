const isProd = import.meta.env.PROD;
export const API_URL = import.meta.env.VITE_API_URL || (isProd ? 'https://tracky-backend.onrender.com/api' : 'http://localhost:5001/api');
