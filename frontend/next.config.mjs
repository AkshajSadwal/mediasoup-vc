// Keep browser HTTP API calls same-origin in development and in production.
// Production's Nginx routes /api/meetings, profile pictures and Socket.IO to
// the backend; these rewrites also make `next dev` work without Nginx.
const backend = (process.env.BACKEND_URL || 'http://127.0.0.1:4000').replace(/\/$/, '');

const nextConfig = {
  async rewrites() {
    return [
      { source: '/api/meetings/:path*', destination: `${backend}/api/meetings/:path*` },
      ...['signup', 'login', 'me', 'profile'].map((name) => ({
        source: `/api/auth/${name}`, destination: `${backend}/api/auth/${name}`,
      })),
      { source: '/profile-pictures/:path*', destination: `${backend}/profile-pictures/:path*` },
    ];
  },
};

export default nextConfig;
