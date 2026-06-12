/** @type {import('next').NextConfig} */
const nextConfig = {
  compiler: {
    // Strip console output from production bundles (client and server) so the
    // verbose debug logging — which includes userIds, chatIds and message
    // content — is not emitted in prod. console.error is kept for ops/error
    // visibility. Dev builds keep all logging. Source is untouched, so the
    // tests that assert on console calls still pass.
    removeConsole:
      process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
        port: '',
        pathname: '/vi/**'
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/a/**' // Google user content often follows this pattern
      }
    ]
  }
}

export default nextConfig
