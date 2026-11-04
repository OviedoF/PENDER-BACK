import PageView from '../models/PageView.js';

const PageViewController = {
  // Público: beacon de la landing.
  async hit(req, res) {
    try {
      const { path, ref } = req.body || {};
      if (typeof path !== 'string' || !path.startsWith('/') || path.length > 200) {
        return res.status(400).json({ error: 'path inválido' });
      }
      const ua = String(req.headers['user-agent'] || '');
      await PageView.create({
        path,
        ref: typeof ref === 'string' ? ref.slice(0, 300) : '',
        mobile: /Mobi|Android/i.test(ua),
        day: new Date().toISOString().slice(0, 10),
      });
      return res.json({ ok: true });
    } catch (error) {
      return res.status(500).json({ error: 'error' });
    }
  },

  // Admin: visitas por día y por página de los últimos N días (default 30).
  async stats(req, res) {
    try {
      const days = Math.min(365, Math.max(1, parseInt(req.query.days, 10) || 30));
      const from = new Date(Date.now() - days * 24 * 3600 * 1000).toISOString().slice(0, 10);
      const [porDia, porPagina, total] = await Promise.all([
        PageView.aggregate([
          { $match: { day: { $gte: from } } },
          { $group: { _id: '$day', visitas: { $sum: 1 }, mobile: { $sum: { $cond: ['$mobile', 1, 0] } } } },
          { $sort: { _id: 1 } },
        ]),
        PageView.aggregate([
          { $match: { day: { $gte: from } } },
          { $group: { _id: '$path', visitas: { $sum: 1 } } },
          { $sort: { visitas: -1 } },
        ]),
        PageView.countDocuments({ day: { $gte: from } }),
      ]);
      return res.json({ desde: from, total, porDia, porPagina });
    } catch (error) {
      return res.status(500).json({ error: error.message });
    }
  },
};

export default PageViewController;
