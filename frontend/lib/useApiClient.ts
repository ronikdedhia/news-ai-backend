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
        const token = await getToken()
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      } catch (error) {
        console.error('Error getting auth token:', error)
      }
      return config
    })

    return () => {
      apiClient.interceptors.request.eject(interceptor)
    }
  }, [getToken])

  return apiClient
}
