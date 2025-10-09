'use client'

// Push notification utilities for DevPulse

export interface NotificationPayload {
  title: string
  body: string
  icon?: string
  badge?: string
  tag?: string
  url?: string
  data?: any
  actions?: Array<{
    action: string
    title: string
    icon?: string
  }>
}

export class PushNotificationManager {
  private static instance: PushNotificationManager
  private registration: ServiceWorkerRegistration | null = null
  private subscription: PushSubscription | null = null

  static getInstance(): PushNotificationManager {
    if (!PushNotificationManager.instance) {
      PushNotificationManager.instance = new PushNotificationManager()
    }
    return PushNotificationManager.instance
  }

  // Check if push notifications are supported
  isSupported(): boolean {
    return (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    )
  }

  // Get current permission status
  getPermissionStatus(): NotificationPermission {
    return Notification.permission
  }

  // Request notification permission
  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) {
      throw new Error('Push notifications are not supported')
    }

    const permission = await Notification.requestPermission()
    return permission
  }

  // Register service worker
  async registerServiceWorker(): Promise<ServiceWorkerRegistration> {
    if (!this.isSupported()) {
      throw new Error('Service workers are not supported')
    }

    try {
      this.registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      })

      console.log('Service worker registered:', this.registration)
      return this.registration
    } catch (error) {
      console.error('Service worker registration failed:', error)
      throw error
    }
  }

  // Subscribe to push notifications
  async subscribe(): Promise<PushSubscription> {
    if (!this.registration) {
      await this.registerServiceWorker()
    }

    if (!this.registration) {
      throw new Error('Service worker not registered')
    }

    try {
      // You'll need to generate VAPID keys for production
      // For now, we'll use a placeholder
      const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || 'placeholder-key'
      
      this.subscription = await this.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: this.urlBase64ToUint8Array(vapidPublicKey)
      })

      console.log('Push subscription created:', this.subscription)
      return this.subscription
    } catch (error) {
      console.error('Push subscription failed:', error)
      throw error
    }
  }

  // Get existing subscription
  async getSubscription(): Promise<PushSubscription | null> {
    if (!this.registration) {
      await this.registerServiceWorker()
    }

    if (!this.registration) {
      return null
    }

    this.subscription = await this.registration.pushManager.getSubscription()
    return this.subscription
  }

  // Unsubscribe from push notifications
  async unsubscribe(): Promise<boolean> {
    const subscription = await this.getSubscription()
    
    if (subscription) {
      const result = await subscription.unsubscribe()
      this.subscription = null
      return result
    }
    
    return false
  }

  // Send subscription to server
  async sendSubscriptionToServer(subscription: PushSubscription): Promise<void> {
    try {
      const response = await fetch('/api/notifications/subscribe', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          subscription: subscription.toJSON()
        })
      })

      if (!response.ok) {
        throw new Error('Failed to send subscription to server')
      }
    } catch (error) {
      console.error('Error sending subscription to server:', error)
      throw error
    }
  }

  // Show local notification (for testing)
  async showLocalNotification(payload: NotificationPayload): Promise<void> {
    if (this.getPermissionStatus() !== 'granted') {
      throw new Error('Notification permission not granted')
    }

    const options: NotificationOptions = {
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.svg',
      badge: payload.badge || '/icons/icon-72x72.svg',
      tag: payload.tag || 'devpulse-local',
      data: payload.data || {},
      requireInteraction: false,
      silent: false
    }

    // Note: actions are not supported in regular Notification API, only in service worker notifications
    new Notification(payload.title, options)
  }

  // Initialize push notifications
  async initialize(): Promise<boolean> {
    try {
      if (!this.isSupported()) {
        console.warn('Push notifications not supported')
        return false
      }

      // Register service worker
      await this.registerServiceWorker()

      // Check permission
      let permission = this.getPermissionStatus()
      
      if (permission === 'default') {
        permission = await this.requestPermission()
      }

      if (permission !== 'granted') {
        console.warn('Notification permission not granted')
        return false
      }

      // Get or create subscription
      let subscription = await this.getSubscription()
      
      if (!subscription) {
        subscription = await this.subscribe()
      }

      // Send subscription to server
      await this.sendSubscriptionToServer(subscription)

      console.log('Push notifications initialized successfully')
      return true
    } catch (error) {
      console.error('Failed to initialize push notifications:', error)
      return false
    }
  }

  // Utility function to convert VAPID key
  private urlBase64ToUint8Array(base64String: string): ArrayBuffer {
    const padding = '='.repeat((4 - base64String.length % 4) % 4)
    const base64 = (base64String + padding)
      .replace(/-/g, '+')
      .replace(/_/g, '/')

    const rawData = window.atob(base64)
    const outputArray = new Uint8Array(rawData.length)

    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i)
    }
    return outputArray.buffer
  }
}

// Export singleton instance
export const pushNotificationManager = PushNotificationManager.getInstance()