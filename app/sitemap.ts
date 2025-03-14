import { MetadataRoute } from 'next'

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://quizlabai.com'
  
  // Add all your static routes here
  const routes = [
    '',
    '/about',
    '/contact',
    '/pricing',
    '/auth/sign-in',
    '/auth/sign-up',
  ]

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: new Date(),
    changeFrequency: 'daily',
    priority: route === '' ? 1 : 0.8,
  })) as MetadataRoute.Sitemap
} 