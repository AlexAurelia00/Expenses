import { supabase } from '../config/supabaseClient.js';

export const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization header with Bearer token is required.' });
  }

  const token = authHeader.split(' ')[1];
  try {
    // supabase.auth.getUser verifies the JWT signature and retrieves the user details
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({ error: 'Session expired or token is invalid.' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(500).json({ error: 'Internal Auth verification error: ' + err.message });
  }
};
