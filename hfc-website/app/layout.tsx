import type { Metadata } from 'next'
import { Playfair_Display, Montserrat, Inter, Lora } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import Navbar from '@/components/layout/Navbar'
import Footer from '@/components/layout/Footer'
import './globals.css'

const fontDisplay = Playfair_Display({
  subsets: ['latin'],
  weight: ['700'],
  style: ['normal', 'italic'],
  variable: '--font-display',
  display: 'swap',
})

const fontBrand = Montserrat({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-brand',
  display: 'swap',
})

const fontBody = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-body',
  display: 'swap',
})

const fontTagline = Lora({
  subsets: ['latin'],
  weight: ['400', '600'],
  style: ['italic'],
  variable: '--font-tagline',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'HFC Restaurant Software | Order Delicious Food Online',
  description: 'Order premium quality chicken biryani, dal makhani, paneer tikka, and more online. Delivered hot and fresh directly to your doorstep in Rajam.',
  icons: {
    icon: '/logo.jpeg',
    apple: '/logo.jpeg',
  },
  openGraph: {
    title: 'HFC Restaurant Software | Order Delicious Food Online',
    description: 'Order premium quality chicken biryani, dal makhani, paneer tikka, and more online. Delivered hot and fresh directly to your doorstep in Rajam.',
    url: 'https://hfc-website-two.vercel.app',
    siteName: 'HFC Restaurant Software',
    images: [
      {
        url: 'https://hfc-website-two.vercel.app/logo.jpeg',
        width: 800,
        height: 800,
        alt: 'HFC Restaurant Software Brand Logo',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HFC Restaurant Software | Order Delicious Food Online',
    description: 'Order premium quality chicken biryani, dal makhani, paneer tikka, and more online. Delivered hot and fresh directly to your doorstep in Rajam.',
    images: ['https://hfc-website-two.vercel.app/logo.jpeg'],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${fontDisplay.variable} ${fontBrand.variable} ${fontBody.variable} ${fontTagline.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'Restaurant',
              'name': 'HFC Restaurant Software',
              'image': 'https://hfc-website-two.vercel.app/logo.jpeg',
              'url': 'https://hfc-website-two.vercel.app',
              'telephone': '+919912799855',
              'priceRange': '₹₹',
              'servesCuisine': 'Indian, Mughlai, Biryani',
              'address': {
                '@type': 'PostalAddress',
                'streetAddress': 'Labour Colony, Rajam',
                'addressLocality': 'Rajam',
                'addressRegion': 'Andhra Pradesh',
                'postalCode': '532127',
                'addressCountry': 'IN'
              },
              'openingHoursSpecification': {
                '@type': 'OpeningHoursSpecification',
                'dayOfWeek': [
                  'Monday',
                  'Tuesday',
                  'Wednesday',
                  'Thursday',
                  'Friday',
                  'Saturday',
                  'Sunday'
                ],
                'opens': '11:00',
                'closes': '23:00'
              }
            })
          }}
        />
      </head>
      <body className="bg-white text-brand-black min-h-screen flex flex-col antialiased">
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: '#FFFFFF',
              color: '#1A1A1A',
              border: '1px solid #F0F0F0',
              boxShadow: '0 4px 20px rgba(0,0,0,0.08)',
              borderRadius: '8px',
            },
          }}
        />
        <Navbar />
        <div className="flex-1">{children}</div>
        <Footer />
      </body>
    </html>
  )
}
