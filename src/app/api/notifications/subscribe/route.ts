import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const { subscription } = await request.json()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!subscription) {
      return NextResponse.json({ error: 'Subscription data required' }, { status: 400 })
    }

    // Store or update the push subscription in the database
    // First, check if a subscription already exists for this user
    const { data: existingSubscription } = await supabase
      .from('push_subscriptions')
      .select('id')
      .eq('user_id', user.id)
      .single()

    if (existingSubscription) {
      // Update existing subscription
      const { error: updateError } = await supabase
        .from('push_subscriptions')
        .update({
          subscription_data: subscription,
          updated_at: new Date().toISOString()
        })
        .eq('user_id', user.id)

      if (updateError) {
        console.error('Error updating push subscription:', updateError)
        return NextResponse.json({ error: 'Failed to update subscription' }, { status: 500 })
      }
    } else {
      // Create new subscription
      const { error: insertError } = await supabase
        .from('push_subscriptions')
        .insert({
          user_id: user.id,
          subscription_data: subscription,
          created_at: new Date().toISOString()
        })

      if (insertError) {
        console.error('Error creating push subscription:', insertError)
        return NextResponse.json({ error: 'Failed to create subscription' }, { status: 500 })
      }
    }

    return NextResponse.json({ message: 'Subscription saved successfully' })

  } catch (error) {
    console.error('Push subscription API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()

    // Get current user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Delete the push subscription
    const { error } = await supabase
      .from('push_subscriptions')
      .delete()
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting push subscription:', error)
      return NextResponse.json({ error: 'Failed to delete subscription' }, { status: 500 })
    }

    return NextResponse.json({ message: 'Subscription deleted successfully' })

  } catch (error) {
    console.error('Push subscription delete API error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}