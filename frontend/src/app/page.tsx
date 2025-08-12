'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { DCAForm } from '@/components/DCAForm'
import { BatchStatus } from '@/components/BatchStatus'
import { BalanceView } from '@/components/BalanceView'
import { WalletConnect } from '@/components/WalletConnect'
import { 
  Shield, 
  TrendingUp, 
  Users, 
  Eye,
  Github,
  ExternalLink,
  Zap,
  Lock
} from 'lucide-react'

type TabType = 'create' | 'status' | 'balance'

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabType>('create')

  const tabs = [
    { id: 'create', label: 'Create Intent', icon: Shield },
    { id: 'status', label: 'Batch Status', icon: Users },
    { id: 'balance', label: 'My Balance', icon: Eye },
  ] as const

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-purple-600 rounded-xl flex items-center justify-center">
                <Shield className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                  DCA FHE Bot
                </h1>
                <p className="text-sm text-muted-foreground">
                  Privacy-Preserving Dollar Cost Averaging
                </p>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.5 }}
            >
              <WalletConnect />
            </motion.div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-12 px-4">
        <div className="container mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="max-w-4xl mx-auto"
          >
            <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent mb-6">
              Private DCA Strategies
            </h2>
            <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
              Execute dollar-cost averaging strategies with full privacy using Fully Homomorphic Encryption. 
              Your investment parameters remain encrypted while participating in batch executions.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.2 }}
                className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border"
              >
                <Lock className="w-12 h-12 text-blue-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Encrypted Privacy</h3>
                <p className="text-sm text-muted-foreground">
                  All DCA parameters encrypted using FHE technology
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.3 }}
                className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border"
              >
                <Users className="w-12 h-12 text-purple-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Batch Execution</h3>
                <p className="text-sm text-muted-foreground">
                  K-anonymity through batched operations with 10 users
                </p>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.4 }}
                className="p-6 bg-white/60 backdrop-blur-sm rounded-xl border"
              >
                <TrendingUp className="w-12 h-12 text-green-600 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">Smart Conditions</h3>
                <p className="text-sm text-muted-foreground">
                  Encrypted price ranges for conditional execution
                </p>
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Main Content */}
      <section className="py-8 px-4">
        <div className="container mx-auto max-w-6xl">
          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex justify-center mb-8"
          >
            <div className="flex bg-white/60 backdrop-blur-sm rounded-xl p-1 border">
              {tabs.map((tab) => {
                const Icon = tab.icon
                return (
                  <Button
                    key={tab.id}
                    variant={activeTab === tab.id ? 'default' : 'ghost'}
                    onClick={() => setActiveTab(tab.id as TabType)}
                    className="flex items-center gap-2 px-6 py-3"
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </Button>
                )
              })}
            </div>
          </motion.div>

          {/* Tab Content */}
          <div className="flex justify-center">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="w-full max-w-4xl"
            >
              {activeTab === 'create' && <DCAForm />}
              {activeTab === 'status' && <BatchStatus />}
              {activeTab === 'balance' && <BalanceView />}
            </motion.div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-16 border-t bg-white/80 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-white" />
              </div>
              <div>
                <p className="font-medium">DCA FHE Bot</p>
                <p className="text-sm text-muted-foreground">
                  Built for Zama Bounty Season 9
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <a
                  href="https://github.com/zama-ai"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Github className="w-4 h-4" />
                  GitHub
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href="https://docs.zama.ai/fhevm"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  fhEVM Docs
                </a>
              </Button>
              <Button variant="ghost" size="sm" asChild>
                <a
                  href="https://sepolia.etherscan.io/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  Sepolia
                </a>
              </Button>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t text-center text-sm text-muted-foreground">
            <p>
              Built with ❤️ using Zama fhEVM, Next.js, and Tailwind CSS. 
              Privacy-first DCA strategies on Ethereum Sepolia testnet.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}