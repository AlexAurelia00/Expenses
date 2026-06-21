import { supabase } from '../config/supabaseClient.js';

// Get in-app notifications
export const getNotifications = async (req, res) => {
  const userId = req.user.id;

  try {
    const { data: notifications, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return res.status(200).json(notifications);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};

// Mark single or all notifications as read
export const markAsRead = async (req, res) => {
  const userId = req.user.id;
  const { id } = req.params; // if id is 'all', mark all as read

  try {
    if (id === 'all') {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId);

      if (error) throw error;
      return res.status(200).json({ message: 'All notifications marked as read.' });
    } else {
      const { data: notification, error: getError } = await supabase
        .from('notifications')
        .select('*')
        .eq('id', id)
        .single();

      if (getError || !notification) {
        return res.status(404).json({ error: 'Notification not found.' });
      }

      if (notification.user_id !== userId) {
        return res.status(403).json({ error: 'Unauthorized.' });
      }

      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);

      if (updateError) throw updateError;
      return res.status(200).json({ message: 'Notification marked as read.' });
    }
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
