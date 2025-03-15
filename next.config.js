/** @type {import('next').NextConfig} */
const nextConfig = {
    // Required for standalone Docker deployment
    output: 'standalone',

    // Configure image domains for the S3 service
    images: {
        remotePatterns: [
            {
                protocol: 'https',
                hostname: '**.cubbit.eu',
                port: '',
                pathname: '/**',
            },
            // Allow any domain for flexibility in changing S3 providers
            {
                protocol: 'https',
                hostname: '**',
                port: '',
                pathname: '/**',
            },
        ],
    },
};

module.exports = nextConfig;
