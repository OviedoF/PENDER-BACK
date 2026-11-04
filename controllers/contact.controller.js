import sendGenericEmail from '../utils/sendGenericEmail.js';

// Rate limit simple en memoria: máx 5 mensajes por IP por hora.
const hits = new Map();
const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 5;

function tooMany(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) return true;
  list.push(now);
  hits.set(ip, list);
  return false;
}

const esc = (s) => String(s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const ContactController = {
  async send(req, res) {
    try {
      const { nombre, email, mensaje, telefono, website } = req.body || {};

      // Honeypot: los bots completan el campo oculto "website".
      if (website) return res.json({ ok: true });

      if (!nombre || !email || !mensaje) {
        return res.status(400).json({ error: 'Faltan campos: nombre, email y mensaje son obligatorios.' });
      }
      if (String(mensaje).length > 4000 || String(nombre).length > 120 || String(email).length > 200) {
        return res.status(400).json({ error: 'El mensaje es demasiado largo.' });
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email))) {
        return res.status(400).json({ error: 'El email no es válido.' });
      }

      const ip = req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || req.ip || '?';
      if (tooMany(String(ip))) {
        return res.status(429).json({ error: 'Demasiados mensajes. Probá de nuevo más tarde.' });
      }

      await sendGenericEmail({
        to: process.env.ADMIN_EMAIL,
        subject: 'Nuevo mensaje desde la web',
        body: `<b>Nombre:</b> ${esc(nombre)}<br>
<b>Email:</b> ${esc(email)}<br>
${telefono ? `<b>Teléfono:</b> ${esc(telefono)}<br>` : ''}
<br>${esc(mensaje).replace(/\n/g, '<br>')}`,
      });

      return res.json({ ok: true });
    } catch (error) {
      console.error('Error en contacto:', error.message);
      return res.status(500).json({ error: 'No se pudo enviar el mensaje. Intentá más tarde.' });
    }
  },
};

export default ContactController;
