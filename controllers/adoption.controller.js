import Adoption from '../models/Adoption.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import createUserNotification from '../utils/createUserNotification.js';
dotenv.config();

const AdoptionController = {};

AdoptionController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        req.body.user = user._id;
        if (req.files.image && req.files.image.length > 0) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.files.image[0].filename}`;
        }

        if(req.files.images && req.files.images.length > 0) {
            req.body.imagenes = req.files.images.map((image) => {
                return `${process.env.API_URL}/api/uploads/${image.filename}`;
            });
        }

        const adoption = new Adoption({ ...req.body });
        createUserNotification(req.body.user, "Adopción creada", "Se ha creado tu adopción.", 'usuario/adoption/myAdoptions');
        await adoption.save();
        res.status(201).json(adoption);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

AdoptionController.getByUser = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const adoptions = await Adoption.find({ user: user._id, deletedAt: null }).sort({ createdAt: -1 });

        console.log(adoptions);

        const parsedAdoptions = adoptions.map((adoption) => {
            return {
                id: adoption._id,
                nombre: adoption.nombre,
                raza: adoption.raza,
                imagen: adoption.imagen,
                fecha: new Date(adoption.createdAt).toLocaleDateString(),
                status: adoption.adopted ? 'adoptado' : 'por_adoptar',
                lugar: `${adoption.distrito}, ${adoption.departamento}`
            };
        });

        res.status(200).json(parsedAdoptions);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};    

AdoptionController.getAll = async (req, res) => {
  try {
    const { search } = req.query;

    const query = {
      deletedAt: null,
    };

    if (search && search.trim()) {
      const regex = new RegExp(search, 'i');

      query.$or = [
        { nombre: regex },
        { raza: regex },
        { especie: regex },
        { tamano: regex },
        { sexo: regex },
        { ciudad: regex },
        { distrito: regex },
        { departamento: regex },
        { comentarios: regex },
      ];
    }

    const adoptions = await Adoption
      .find(query)
      .sort({ createdAt: -1 });

    res.status(200).json(adoptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

AdoptionController.getAllToAdopt = async (req, res) => {
  try {
    const { search } = req.query;

    const query = {
      deletedAt: null,
      adopted: false,
    };

    if (search && search.trim()) {
      const regex = new RegExp(search, 'i');

      query.$or = [
        { nombre: regex },
        { raza: regex },
        { especie: regex },
        { tamano: regex },
        { sexo: regex },
        { ciudad: regex },
        { distrito: regex },
        { departamento: regex },
        { comentarios: regex },
      ];
    }

    const adoptions = await Adoption
      .find(query)
      .sort({ createdAt: -1 });

    res.status(200).json(adoptions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

AdoptionController.getById = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const adoption = await Adoption.findOne({ _id: req.params.id, deletedAt: null });

        const isOwner = adoption.user.toString() === user._id.toString();

        if (!adoption) return res.status(404).json({ 
            message: 'No se encontró la adopcion' 
        });

        res.status(200).json({
            adoption,
            isOwner
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

AdoptionController.update = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });

        const isOwner = await Adoption.findOne({ _id: req.params.id, user: user._id });
        if (!isOwner) return res.status(403).json({ message: 'No tienes permisos' });

        if (req.files?.image?.length > 0) {
            req.body.imagen = `${process.env.API_URL}/api/uploads/${req.files.image[0].filename}`;
        }

        const oldAdoption = await Adoption.findOne({ _id: req.params.id, deletedAt: null });
        if (!oldAdoption) return res.status(404).json({ message: 'Not found' });

        const oldImages = oldAdoption.imagenes || [];
        if (req.body.oldImages) {
            if(typeof req.body.oldImages === 'string') {
                req.body.oldImages = [req.body.oldImages];
            }
            
            // * Borar las imágenes que no están en el nuevo array
            const imagesToDelete = oldImages.filter(image => !req.body.oldImages.includes(image));
            if (imagesToDelete.length > 0) {
                // * Aquí podrías agregar la lógica para eliminar las imágenes del servidor
                console.log('Imágenes a eliminar:', imagesToDelete);
            }
            // * Actualizar las imágenes en el objeto de adopción
            req.body.imagenes = req.body.oldImages;
        }

        if(!req.body.oldImages) {
            req.body.imagenes = [];
        }
        if (req.files?.images?.length > 0) {
            req.files.images.forEach((image) => {
                req.body.imagenes = req.body.imagenes || [];
                req.body.imagenes.push(`${process.env.API_URL}/api/uploads/${image.filename}`);
            });
        }

        const adoption = await Adoption.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );
        
        if (!adoption) return res.status(404).json({ message: 'Not found' });
        
        res.status(200).json(adoption);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

AdoptionController.delete = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1];
        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findOne({ _id: payload.id });
        const adoption = await Adoption.findOne({ _id: req.params.id, user: user._id });
        if (!adoption) return res.status(404).json({ message: 'Error al eliminar' });
        adoption.deletedAt = new Date();
        await adoption.save();
        res.status(200).json({ message: 'Eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default AdoptionController;
