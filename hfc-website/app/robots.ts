import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/agent/', '/api/'],
    },
    sitemap: 'https://hfc-website-two.vercel.app/sitemap.xml',
  }
}
