import CouponCode from '../models/PremiumCouponCodes.js'
import User from '../models/User.js'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

const CouponCodeController = {}

// Función para generar un código único de 5 caracteres
async function generateUniqueCode() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    let code
    let exists = true

    while (exists) {
        // Generar un string aleatorio de 5 caracteres
        code = Array.from({ length: 5 }, () =>
            chars.charAt(Math.floor(Math.random() * chars.length))
        ).join('')

        // Verificar que no exista en la DB
        const existing = await CouponCode.findOne({ code })
        if (!existing) exists = false
    }

    return code
}

// Crear un nuevo código de cupón
CouponCodeController.create = async (req, res) => {
    try {
        const token = req.headers.authorization?.split(' ')[1]
        if (!token) return res.status(401).json({ error: 'Token no proporcionado' })

        const payload = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(payload.id)
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' })

        // Generar código único
        const uniqueCode = await generateUniqueCode()

        const couponCode = new CouponCode({
            code: uniqueCode,
            coupon: req.body.coupon, // ID del cupón al que pertenece
            user: user._id
        })

        await couponCode.save()
        res.status(201).json(couponCode.code)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// Obtener todos los códigos de cupón (no eliminados)
CouponCodeController.getAll = async (req, res) => {
    try {
        const codes = await CouponCode.find({ deletedAt: null })
            .populate('coupon')
            .populate('user', 'username firstName lastName image')

        res.json(codes)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener un código de cupón por ID
CouponCodeController.getById = async (req, res) => {
    try {
        const { id } = req.params
        const code = await CouponCode.findOne({ _id: id, deletedAt: null })
            .populate('coupon')
            .populate('user', 'username firstName lastName image')

        if (!code) return res.status(404).json({ error: 'Código no encontrado' })
        res.json(code)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Actualizar un código de cupón
CouponCodeController.update = async (req, res) => {
    try {
        const { id } = req.params
        const code = await CouponCode.findOneAndUpdate(
            { _id: id, deletedAt: null },
            req.body,
            { new: true }
        )
        if (!code) return res.status(404).json({ error: 'Código no encontrado' })
        res.json(code)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// Eliminar un código de cupón (lógico)
CouponCodeController.softDelete = async (req, res) => {
    try {
        const { id } = req.params
        const code = await CouponCode.findOneAndUpdate(
            { _id: id, deletedAt: null },
            { deletedAt: new Date() },
            { new: true }
        )
        if (!code) return res.status(404).json({ error: 'Código no encontrado' })
        res.json({ message: 'Código eliminado correctamente (soft delete)', code })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Eliminar un código de cupón (definitivo)
CouponCodeController.delete = async (req, res) => {
    try {
        const { id } = req.params
        const code = await CouponCode.findByIdAndDelete(id)
        if (!code) return res.status(404).json({ error: 'Código no encontrado' })
        res.json({ message: 'Código eliminado permanentemente' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

export default CouponCodeController
