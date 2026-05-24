import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)
const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function handler(event) {
  const sig = event.headers['stripe-signature']
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET

  let stripeEvent

  try {
    if (endpointSecret && sig) {
      stripeEvent = stripe.webhooks.constructEvent(event.body, sig, endpointSecret)
    } else {
      stripeEvent = JSON.parse(event.body)
    }
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message)
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid signature' }) }
  }

  if (stripeEvent.type === 'checkout.session.completed') {
    const session = stripeEvent.data.object
    const orderNumber = session.metadata?.order_number

    if (orderNumber) {
      // Update checkout_orders
      await supabase
        .from('checkout_orders')
        .update({
          payment_status: 'paid',
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
        })
        .eq('order_number', orderNumber)

      console.log(`Payment completed for order ${orderNumber}`)
    }
  }

  if (stripeEvent.type === 'checkout.session.expired') {
    const session = stripeEvent.data.object
    const orderNumber = session.metadata?.order_number

    if (orderNumber) {
      await supabase
        .from('checkout_orders')
        .update({ payment_status: 'failed' })
        .eq('order_number', orderNumber)
    }
  }

  return { statusCode: 200, body: JSON.stringify({ received: true }) }
}
