'use client'

import { ClerkProvider } from '@clerk/nextjs'
import { ReactNode } from 'react'
import { PreferencesApplier } from './PreferencesApplier'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ClerkProvider>
      <PreferencesApplier />
      {children}
    </ClerkProvider>
  )
}
