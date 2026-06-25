/**
 * WhatsApp notification sender.
 * Makes HTTP calls to the bot's /send endpoint.
 * Fire-and-forget — never throws, never blocks the main response.
 */
import { config } from '../config';

interface WAMessage {
  to: string;   // phone number (digits only, with country code, no +)
  text: string;
}

export async function sendWhatsAppMessage(to: string, text: string): Promise<void> {
  if (!config.whatsapp.internalApiKey || !config.whatsapp.botBaseUrl) return;

  // Normalize phone: strip +, spaces, dashes
  const phone = to.replace(/[\s\-()]/g, '').replace(/^\+/, '');

  try {
    const res = await fetch(`${config.whatsapp.botBaseUrl}/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Key': config.whatsapp.internalApiKey,
      },
      body: JSON.stringify({ to: phone, text }),
      signal: AbortSignal.timeout(5000), // 5s timeout — don't block the main flow
    });
    if (!res.ok) {
      console.warn(`[WhatsApp] /send returned ${res.status}`);
    }
  } catch (err: any) {
    // Non-critical — log and move on
    console.error('[WhatsApp] Failed to send message:', err?.message ?? err);
  }
}

// ─── Notification helpers ─────────────────────────────────────────────────────

export const waTemplates = {
  bookingCreated: (providerName: string, customerName: string, category: string, scheduledAt: Date) =>
    `🔔 *New Booking — Haven*\n\n` +
    `Hi *${providerName}*, you have a new booking!\n\n` +
    `👤 Customer: ${customerName}\n` +
    `🔧 Service: ${category}\n` +
    `📅 Scheduled: ${scheduledAt.toLocaleString('en-NG')}\n\n` +
    `Reply *jobs* to see all your bookings.`,

  paymentConfirmed: (customerName: string, providerName: string, amount: number, scheduledAt: Date) =>
    `✅ *Payment Confirmed — Haven*\n\n` +
    `Hi *${customerName}*, your payment has been confirmed!\n\n` +
    `🏪 Provider: ${providerName}\n` +
    `💳 Amount: ₦${amount.toLocaleString()}\n` +
    `📅 Scheduled: ${scheduledAt.toLocaleString('en-NG')}\n\n` +
    `Reply *bookings* to track your service.`,

  jobCompleted: (customerName: string, providerName: string, points: number) =>
    `🎉 *Job Completed — Haven*\n\n` +
    `Hi *${customerName}*, your service is done!\n\n` +
    `🏪 Completed by: ${providerName}\n` +
    `⭐ You earned *${points} points*!\n\n` +
    `Please take a moment to review your experience. Reply *history* to view past jobs.`,

  newInquiry: (providerName: string, customerName: string, service: string) =>
    `📨 *New Inquiry — Haven*\n\n` +
    `Hi *${providerName}*, you have a new inquiry!\n\n` +
    `👤 From: ${customerName}\n` +
    `🔧 Service: ${service}\n\n` +
    `Reply *inquiries* to view and respond.`,

  bookingCancelled: (recipientName: string, role: 'customer' | 'provider', category: string) =>
    `❌ *Booking Cancelled — Haven*\n\n` +
    `Hi *${recipientName}*, a booking has been cancelled.\n\n` +
    `🔧 Service: ${category}\n\n` +
    (role === 'customer'
      ? `If you need help, reply *menu* to start a new request.`
      : `Reply *jobs* to see your remaining bookings.`),
};
