import { logger } from './logger';

const DEV_OVERRIDE_RECIPIENT = process.env.NOTIFICATION_EMAIL_OVERRIDE || 'stofiksamuel@gmail.com';
const TRANSPORT = (process.env.NOTIFICATION_EMAIL_TRANSPORT || 'console').toLowerCase();

type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  context?: Record<string, unknown>;
};

type SendResult = { ok: true; transport: string } | { ok: false; error: string };

export async function sendNotificationEmail(payload: EmailPayload): Promise<SendResult> {
  const finalRecipient = DEV_OVERRIDE_RECIPIENT || payload.to;

  if (TRANSPORT === 'console') {
    logger.info(
      {
        event: 'notification-email',
        transport: 'console',
        to: finalRecipient,
        originalTo: payload.to,
        subject: payload.subject,
        text: payload.text,
        html: payload.html,
        context: payload.context,
      },
      `[email→${finalRecipient}] ${payload.subject}`,
    );
    return { ok: true, transport: 'console' };
  }

  logger.warn({ transport: TRANSPORT }, 'Unknown NOTIFICATION_EMAIL_TRANSPORT, dropping email');
  return { ok: false, error: `Unknown transport: ${TRANSPORT}` };
}
