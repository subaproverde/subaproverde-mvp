/** @type {import('next').NextConfig} */
const nextConfig = {
  allowedDevOrigins: [
    "localhost",
    "127.0.0.1",
    "meta-untubbed-felice.ngrok-free.dev",
    // Se seu Next aceitar, tente também:
    // "*.ngrok-free.dev",
  ],
};

module.exports = nextConfig;
