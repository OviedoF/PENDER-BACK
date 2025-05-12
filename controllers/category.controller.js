import Category from '../models/Category.js';
import dotenv from 'dotenv';
dotenv.config();

const CategoryController = {};

CategoryController.create = async (req, res) => {
    try {
        if (req.file) {
            req.body.image = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
        }
        const category = new Category({ ...req.body });
        await category.save();
        res.status(201).json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CategoryController.getAll = async (req, res) => {
    try {
        const categories = await Category.find({ deletedAt: null });
        res.status(200).json(categories);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CategoryController.getById = async (req, res) => {
    try {
        const category = await Category.findOne({ _id: req.params.id, deletedAt: null });
        if (!category) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(category);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

CategoryController.update = async (req, res) => {
    try {
        if (req.file) {
            req.body.image = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
        }
        const category = await Category.findOneAndUpdate(
            { _id: req.params.id, deletedAt: null },
            req.body,
            { new: true }
        );
        if (!category) return res.status(404).json({ message: 'Not found' });
        res.status(200).json(category);
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
};

CategoryController.delete = async (req, res) => {
    try {
        const category = await Category.findByIdAndUpdate(req.params.id, { deletedAt: new Date() });
        if (!category) return res.status(404).json({ message: 'Not found' });
        res.status(200).json({ message: 'Deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export default CategoryController;
