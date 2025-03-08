/** @type {import('next').NextConfig} */

const nextConfig = {
  // Just include basic environment variables
  env: {
    CHROMA_DB_URL: 'http://localhost:8000',
    OLLAMA_BASE_URL: 'http://localhost:11434',
  },
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Handle native modules like better-sqlite3
    if (isServer) {
      config.externals.push('better-sqlite3');
    }
    
    return config;
  },
};

module.exports = nextConfig; 