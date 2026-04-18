'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'

export default function LoginPage() {
  const [loading, setLoading] = useState(false)

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-slate-100">
      <div className="card p-8 w-full max-w-sm space-y-6">
        {/* Logo / Brand */}
        <div className="text-center space-y-1">
          <div className="mx-auto w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center mb-4">
            <svg className="w-7 h-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10" />
            </svg>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">UTLC FFD System</h1>
          <p className="text-xs text-gray-500">United Thai Logistics Company Limited</p>
        </div>

        <div className="space-y-3">
          <button
            onClick={async () => {
              setLoading(true)
              await signIn('azure-ad', { callbackUrl: '/' })
            }}
            disabled={loading}
            className="btn-primary w-full justify-center py-2.5"
          >
            {loading ? (
              <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : (
              <svg className="w-4 h-4" viewBox="0 0 21 21" fill="currentColor">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
            )}
            {loading ? 'Signing in...' : 'Sign in with Microsoft'}
          </button>
        </div>

        <p className="text-center text-xs text-gray-400">
          ใช้ account บริษัท UTLC เท่านั้น
        </p>
      </div>
    </div>
  )
}
