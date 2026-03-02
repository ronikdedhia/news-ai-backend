'use client'

import { useAuth } from '@clerk/nextjs'
import { useEffect } from 'react'
import apiClient from './api'

export function useApiClient() {
  const { getToken } = useAuth()

  useEffect(() => {
    // Set up interceptor with token
    const interceptor = apiClient.interceptors.request.use(async (config) => {
      try {
        // Only try to get token if online
        if (navigator.onLine) {
          const token = await getToken()
          if (token) {
            config.headers.Authorization = `Bearer ${token}`
          }
        }
      } catch (error) {
        console.error('[useApiClient] Error getting auth token:', error)
        // Continue without token if offline
      }
      return config
    })

    return () => {
      apiClient.interceptors.request.eject(interceptor)
    }
  }, [getToken])

  return apiClient
}
