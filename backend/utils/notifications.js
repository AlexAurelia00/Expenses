import { supabaseAdmin } from '../config/supabaseClient.js';
import { sendMail } from './email.js';

export const createNotification = async ({ userId, title, message, type, emailData }) => {
  try {
    // 1. Insert in-app notification using Admin client to bypass RLS policies (so any user action can trigger notifications for others)
    const { error } = await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: userId,
        title,
        message,
        type
      });

    if (error) {
      console.error(`Failed to insert notification: ${error.message}`);
    }

    // 2. Send email notification if emailData is provided
    if (emailData && emailData.email) {
      await sendMail({
        to: emailData.email,
        subject: title,
        text: `${message}\n\nSplitwise Clone Team`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
            <h2 style="color: #4F46E5;">${title}</h2>
            <p>${message}</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
            <p style="font-size: 12px; color: #777;">You received this because you are registered on Splitwise Clone.</p>
          </div>
        `
      });
    }
  } catch (err) {
    console.error(`Error in notification engine: ${err.message}`);
  }
};
