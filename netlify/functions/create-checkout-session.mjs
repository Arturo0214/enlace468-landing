import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY)

export async function handler(event) {
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  }

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' }
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) }
  }

  try {
    const { items, customerEmail, customerName, customerPhone, company, orderNumber } = JSON.parse(event.body)

    if (!items?.length || !customerEmail) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing items or email' }) }
    }

    // Build Stripe line items from cart items
    const lineItems = []

    for (const item of items) {
      // Main price
      lineItems.push({
        price_data: {
          currency: 'mxn',
          product_data: {
            name: item.plan_name,
            description: `${item.product_line} - ${item.billing_cycle === 'monthly' ? 'Suscripción mensual' : item.billing_cycle === 'per_vacancy' ? 'Por vacante' : 'Pago único'}`,
          },
          unit_amount: Math.round(item.price_mxn * 100), // Stripe uses cents
          ...(item.billing_cycle === 'monthly'
            ? { recurring: { interval: 'month' } }
            : {}),
        },
        quantity: 1,
      })

      // Setup fee as separate line item
      if (item.setup_fee_mxn > 0) {
        lineItems.push({
          price_data: {
            currency: 'mxn',
            product_data: {
              name: `Setup - ${item.plan_name}`,
              description: 'Configuración inicial (pago único)',
            },
            unit_amount: Math.round(item.setup_fee_mxn * 100),
          },
          quantity: 1,
        })
      }
    }

    // Determine mode based on whether any items are recurring
    const hasRecurring = items.some(i => i.billing_cycle === 'monthly')
    const mode = hasRecurring ? 'subscription' : 'payment'

    // For subscription mode, separate one-time items into setup fees
    let finalLineItems = lineItems
    if (hasRecurring) {
      // Stripe subscription mode doesn't allow mixing recurring and one-time in line_items
      // Use invoice items for one-time fees or simplify to payment mode
      // Simplest approach: use payment mode with all items (no auto-recurring)
      // The team manages subscriptions manually via the admin panel
      finalLineItems = lineItems.map(item => {
        const copy = { ...item, price_data: { ...item.price_data } }
        delete copy.price_data.recurring
        return copy
      })
    }

    const origin = event.headers.origin || event.headers.referer?.replace(/\/$/, '') || 'http://localhost:8888'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment', // Always payment mode - subscriptions managed manually
      line_items: finalLineItems,
      customer_email: customerEmail,
      metadata: {
        order_number: orderNumber,
        customer_name: customerName,
        customer_phone: customerPhone || '',
        company: company || '',
        plan_ids: items.map(i => i.plan_id).join(','),
      },
      success_url: `${origin}/checkout/success?session_id={CHECKOUT_SESSION_ID}&order=${orderNumber}`,
      cancel_url: `${origin}/checkout`,
      locale: 'es',
      allow_promotion_codes: true,
    })

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ sessionId: session.id, url: session.url }),
    }
  } catch (error) {
    console.error('Stripe error:', error)
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message }),
    }
  }
}
