import { Cupon } from '../models/Coupon.js'
import User from '../models/User.js'
import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
dotenv.config()

const CouponController = {}

// Crear un nuevo cupón
CouponController.create = async (req, res) => {
    try {
        const token = req.headers.authorization.split(' ')[1]
        const payload = jwt.verify(token, process.env.JWT_SECRET)
        const user = await User.findById(payload.id)
        if (!user) return res.status(401).json({ error: 'Usuario no autorizado' })

        const cupon = new Cupon(req.body)
        await cupon.save()
        res.status(201).json(cupon)
    } catch (error) {
        console.log(error)
        res.status(400).json({ error: error.message })
    }
}

// Obtener todos los cupones de un servicio
CouponController.getAllByService = async (req, res) => {
    try {
        const { serviceId } = req.params
        const cupones = await Cupon.find({ service: serviceId }).sort({ createdAt: -1 })
        res.json(cupones)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener cupones activos de un servicio
CouponController.getActive = async (req, res) => {
    try {
        const { serviceId } = req.params;
        console.log("Service ID:", serviceId); // Verifica que el ID del servicio se reciba correctamente

        const cupones = await Cupon.find({
            service: serviceId,
            oculto: false,
            activarProgramacion: false
        }).sort({ createdAt: -1 })

        res.json(cupones)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener cupones programados de un servicio
CouponController.getScheduled = async (req, res) => {
    try {
        const { serviceId } = req.params

        const cupones = await Cupon.find({
            service: serviceId,
            oculto: false,
            activarProgramacion: true,
        }).sort({ createdAt: -1 })
        console.log(cupones)

        res.json(cupones)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener cupones ocultos de un servicio
CouponController.getHidden = async (req, res) => {
    try {
        const { serviceId } = req.params

        const cupones = await Cupon.find({
            service: serviceId,
            oculto: true
        }).sort({ createdAt: -1 })

        res.json(cupones)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Obtener un cupón por ID
CouponController.getById = async (req, res) => {
    try {
        const { id } = req.params
        const cupon = await Cupon.findById(id)
        if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' })
        res.json(cupon)
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

// Actualizar un cupón
CouponController.update = async (req, res) => {
    try {
        const { id } = req.params
        const cupon = await Cupon.findByIdAndUpdate(id, req.body, { new: true })
        if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' })
        res.json(cupon)
    } catch (error) {
        res.status(400).json({ error: error.message })
    }
}

// Eliminar un cupón (eliminación directa)
CouponController.delete = async (req, res) => {
    try {
        const { id } = req.params
        const cupon = await Cupon.findByIdAndDelete(id)
        if (!cupon) return res.status(404).json({ error: 'Cupón no encontrado' })
        res.json({ message: 'Cupón eliminado correctamente' })
    } catch (error) {
        res.status(500).json({ error: error.message })
    }
}

export default CouponController