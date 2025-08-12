import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'DCA FHE Bot - Privacy-Preserving Dollar Cost Averaging',
  description: 'A decentralized dollar-cost averaging bot with fully homomorphic encryption for maximum privacy',
  keywords: ['DCA', 'FHE', 'Privacy', 'Ethereum', 'Zama', 'Dollar Cost Averaging'],
  authors: [{ name: 'DCA FHE Bot Team' }],
  viewport: 'width=device-width, initial-scale=1',
  themeColor: '#3b82f6',
}

declare global {
  interface Window {
    ethereum?: any
  }
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="h-full">
      <body className={`${inter.className} h-full bg-gradient-to-br from-blue-50 via-white to-purple-50`}>
        <div className="min-h-full">
          {children}
        </div>
      </body>
    </html>
  )
}