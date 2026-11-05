import News from '../models/News.js';
import Adoption from '../models/Adoption.js';
import FindMe from '../models/FindMe.js';

const NewsController = {
  // ── Público ────────────────────────────────────────────────────────────────

  // Feed combinado para la sección "Novedades" de la web:
  // noticias del admin + historias reales de la comunidad.
  async feed(req, res) {
    try {
      const [noticias, adoptados, encontrados, enAdopcion] = await Promise.all([
        News.find({ activo: true, deletedAt: null }).sort({ createdAt: -1 }).limit(8).lean(),
        Adoption.find({ adopted: true, deletedAt: null, imagen: { $nin: [null, ''] } })
          .sort({ updatedAt: -1 }).limit(6).select('nombre especie distrito imagen updatedAt').lean(),
        FindMe.find({ encontrado: true, deletedAt: null, imagen: { $nin: [null, ''] } })
          .sort({ updatedAt: -1 }).limit(6).select('nombre especie distrito imagen updatedAt').lean(),
        Adoption.find({ status: 'approved', adopted: false, deletedAt: null, imagen: { $nin: [null, ''] } })
          .sort({ createdAt: -1 }).limit(6).select('nombre especie distrito imagen createdAt').lean(),
      ]);

      const items = [
        ...noticias.map((n) => ({
          tipo: 'noticia', titulo: n.titulo, texto: n.texto,
          imagen: n.imagen, link: n.link || '', fecha: n.createdAt,
        })),
        ...adoptados.map((a) => ({
          tipo: 'adoptado', titulo: `¡${a.nombre} encontró familia!`,
          texto: `Una historia con final feliz gracias a la comunidad${a.distrito ? ` de ${a.distrito}` : ''}.`,
          imagen: a.imagen, link: '', fecha: a.updatedAt,
        })),
        ...encontrados.map((f) => ({
          tipo: 'encontrado', titulo: `¡${f.nombre} volvió a casa!`,
          texto: `Se reencontró con su familia gracias a los reportes de la comunidad${f.distrito ? ` en ${f.distrito}` : ''}.`,
          imagen: f.imagen, link: '', fecha: f.updatedAt,
        })),
        ...enAdopcion.map((a) => ({
          tipo: 'en_adopcion', titulo: `${a.nombre} busca un hogar`,
          texto: `${a.especie}${a.distrito ? ` en ${a.distrito}` : ''}, esperando una familia. Descarga la app para conocer su historia.`,
          imagen: a.imagen, link: '', fecha: a.createdAt,
        })),
      ];

      items.sort((x, y) => new Date(y.fecha) - new Date(x.fecha));
      res.json(items.slice(0, 14));
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  // ── Admin ─────────────────────────────────────────────────────────────────

  async list(req, res) {
    try {
      const news = await News.find({ deletedAt: null }).sort({ createdAt: -1 });
      res.json(news);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async create(req, res) {
    try {
      const { titulo, texto, link, activo } = req.body;
      const imagen = req.file ? `/api/uploads/${req.file.filename}` : (req.body.imagen || '');
      if (!titulo || !texto) return res.status(400).json({ error: 'Faltan título o texto.' });
      if (!imagen) return res.status(400).json({ error: 'Se requiere una imagen.' });
      const item = await News.create({ titulo, texto, imagen, link: link || '', activo: activo !== 'false' });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async update(req, res) {
    try {
      const { titulo, texto, link, activo } = req.body;
      const update = { titulo, texto, link, activo: activo !== 'false' };
      if (req.file) update.imagen = `/api/uploads/${req.file.filename}`;
      Object.keys(update).forEach((k) => update[k] === undefined && delete update[k]);
      const item = await News.findByIdAndUpdate(req.params.id, update, { new: true });
      if (!item) return res.status(404).json({ error: 'Noticia no encontrada.' });
      res.json(item);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },

  async remove(req, res) {
    try {
      const item = await News.findByIdAndUpdate(req.params.id, { deletedAt: new Date() }, { new: true });
      if (!item) return res.status(404).json({ error: 'Noticia no encontrada.' });
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  },
};

export default NewsController;
