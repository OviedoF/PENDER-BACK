import AdminRole from '../models/AdminRole.js';
import User from '../models/User.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
dotenv.config();

const verifyAdmin = async (req) => {
  const token = req.headers.authorization.split(' ')[1];
  const payload = jwt.verify(token, process.env.JWT_SECRET);
  const user = await User.findOne({ _id: payload.id });
  if (!user || user.role !== 'admin') throw new Error('No tienes permisos de administrador');
  return user;
};

const AdminUsersController = {};

// ─── ROLES ──────────────────────────────────────────────────────────────────

AdminUsersController.getRoles = async (req, res) => {
  try {
    await verifyAdmin(req);
    const roles = await AdminRole.find().sort({ isDefault: -1, createdAt: -1 });
    res.status(200).json(roles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

AdminUsersController.createRole = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { name, description, permissions } = req.body;
    if (!name) return res.status(400).json({ error: 'El nombre es requerido' });

    const exists = await AdminRole.findOne({ name });
    if (exists) return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });

    const role = await AdminRole.create({ name, description, permissions });
    res.status(201).json(role);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

AdminUsersController.updateRole = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { id } = req.params;
    const { name, description, permissions } = req.body;

    const role = await AdminRole.findById(id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });

    if (name && name !== role.name) {
      const exists = await AdminRole.findOne({ name });
      if (exists) return res.status(400).json({ error: 'Ya existe un rol con ese nombre' });
    }

    if (name !== undefined) role.name = name;
    if (description !== undefined) role.description = description;
    if (permissions) role.permissions = { ...role.permissions.toObject(), ...permissions };

    await role.save();
    res.status(200).json(role);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

AdminUsersController.deleteRole = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { id } = req.params;

    const role = await AdminRole.findById(id);
    if (!role) return res.status(404).json({ error: 'Rol no encontrado' });
    if (role.isDefault) return res.status(400).json({ error: 'No se puede eliminar el rol por defecto' });

    const usersWithRole = await User.countDocuments({ adminRole: id });
    if (usersWithRole > 0) {
      return res.status(400).json({ error: `Hay ${usersWithRole} usuario(s) con este rol. Reasígnalos antes de eliminar.` });
    }

    await AdminRole.findByIdAndDelete(id);
    res.status(200).json({ message: 'Rol eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ─── ADMIN USERS ────────────────────────────────────────────────────────────

AdminUsersController.getAdminUsers = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { search, page = 1, limit = 20 } = req.query;

    const filter = { role: { $in: ['admin', 'moderator'] } };
    if (search) {
      filter.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName:  { $regex: search, $options: 'i' } },
        { email:     { $regex: search, $options: 'i' } },
        { username:  { $regex: search, $options: 'i' } },
      ];
    }

    const total = await User.countDocuments(filter);
    const users = await User.find(filter)
      .select('-password')
      .populate('adminRole')
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.status(200).json({ users, total, pages: Math.ceil(total / limit) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

AdminUsersController.createAdminUser = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { firstName, lastName, username, email, password, phone, role, adminRole } = req.body;

    if (!firstName || !lastName || !username || !email || !password || !phone) {
      return res.status(400).json({ error: 'Todos los campos son requeridos' });
    }

    if (!['admin', 'moderator'].includes(role)) {
      return res.status(400).json({ error: 'El rol debe ser admin o moderator' });
    }

    const emailExists = await User.findOne({ email });
    if (emailExists) return res.status(400).json({ error: 'El email ya está registrado' });

    const usernameExists = await User.findOne({ username });
    if (usernameExists) return res.status(400).json({ error: 'El nombre de usuario ya está registrado' });

    const user = await User.create({
      firstName, lastName, username, email, password, phone,
      role, adminRole: adminRole || undefined,
      verified: true,
    });

    const populated = await User.findById(user._id).select('-password').populate('adminRole');
    res.status(201).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

AdminUsersController.updateAdminUser = async (req, res) => {
  try {
    await verifyAdmin(req);
    const { id } = req.params;
    const { firstName, lastName, email, phone, role, adminRole, password } = req.body;

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!['admin', 'moderator'].includes(user.role)) {
      return res.status(400).json({ error: 'Solo se pueden editar usuarios administrativos' });
    }

    if (email && email !== user.email) {
      const emailExists = await User.findOne({ email });
      if (emailExists) return res.status(400).json({ error: 'El email ya está registrado' });
    }

    if (firstName !== undefined) user.firstName = firstName;
    if (lastName !== undefined) user.lastName = lastName;
    if (email !== undefined) user.email = email;
    if (phone !== undefined) user.phone = phone;
    if (role && ['admin', 'moderator'].includes(role)) user.role = role;
    if (adminRole !== undefined) user.adminRole = adminRole || undefined;
    if (password) user.password = password;

    await user.save();
    const populated = await User.findById(user._id).select('-password').populate('adminRole');
    res.status(200).json(populated);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

AdminUsersController.deleteAdminUser = async (req, res) => {
  try {
    const currentAdmin = await verifyAdmin(req);
    const { id } = req.params;

    if (currentAdmin._id.toString() === id) {
      return res.status(400).json({ error: 'No puedes eliminarte a ti mismo' });
    }

    const user = await User.findById(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    if (!['admin', 'moderator'].includes(user.role)) {
      return res.status(400).json({ error: 'Solo se pueden eliminar usuarios administrativos' });
    }

    await User.findByIdAndDelete(id);
    res.status(200).json({ message: 'Usuario administrativo eliminado' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default AdminUsersController;
