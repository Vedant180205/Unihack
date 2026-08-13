import { Analytics } from '@vercel/analytics/next'
import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geist = Geist({ subsets: ['latin'], variable: '--font-geist' })
const geistMono = Geist_Mono({ subsets: ['latin'], variable: '--font-geist-mono' })

export const metadata: Metadata = { title: 'UniClean AI | Catalog Operations', description: 'Frontend operations console for intelligent industrial catalog cleansing.', generator: 'v0.app' }
export const viewport: Viewport = { colorScheme: 'dark', themeColor: '#111923', userScalable: false }
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) { return <html lang="en" className="dark bg-background"><body className={`${geist.variable} ${geistMono.variable}`}>{children}{process.env.NODE_ENV === 'production' && <Analytics />}</body></html> }
