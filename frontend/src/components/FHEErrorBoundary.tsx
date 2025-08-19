'use client'

import React from 'react'
import { AlertCircle, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
}

export class FHEErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      error
    }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('FHE Error Boundary caught an error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50 flex items-center justify-center">
          <div className="max-w-md w-full mx-4">
            <div className="bg-white rounded-lg shadow-lg p-6 text-center">
              <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-gray-900 mb-2">
                FHE Initialization Error
              </h2>
              <p className="text-gray-600 mb-4">
                The FHE encryption system failed to load. This might be due to browser compatibility or network issues.
              </p>
              <div className="bg-gray-50 rounded p-3 mb-4">
                <p className="text-sm text-gray-700 font-mono">
                  {this.state.error?.message || 'Unknown error occurred'}
                </p>
              </div>
              <Button
                onClick={() => {
                  this.setState({ hasError: false })
                  window.location.reload()
                }}
                className="w-full"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Reload Page
              </Button>
              <p className="text-xs text-gray-500 mt-3">
                You can continue using other features, but FHE encryption will be disabled.
              </p>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}