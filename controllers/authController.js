import User from '../models/User.js';
import Login from '../models/Login.js';
import SuscriptionChange from '../models/SuscriptionChange.js';
import Notification from '../models/Notification.js';
import Message from "../models/Message.js";
import Service from '../models/Service.js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import { v4 } from 'uuid';
import createUserNotification from '../utils/createUserNotification.js';
import Adoption from '../models/Adoption.js';
import FindMe from '../models/FindMe.js';
import SystemNotification from '../models/SystemNotification.js';
import { Cupon } from '../models/Coupon.js';
import CouponCode from '../models/PremiumCouponCodes.js';
import FeaturedRequest from '../models/FeaturedRequest.js';

async function verifyGoogleToken(token) {
  const response = await fetch('https://www.googleapis.com/oauth2/v1/userinfo?alt=json', {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const userInfo = await response.json();

  if (response.status !== 200) {
    return res.status(400).json({ message: 'Token inválido o expirado' });
  }

  return userInfo;
}

async function verifyFacebookToken(token) {
  const response = await fetch(
    `https://graph.facebook.com/me?access_token=${token}&fields=id,name,email`
  );
  const data = await response.json();
  if (data.error) throw new Error(data.error.message);
  return data; // Contiene datos del usuario (id, nombre, email)
}

const authController = {};

authController.register = async (req, res) => {
  try {
    const email = req.body.email;
    const userWithSameEmail = await User.findOne({
      email: email,
      deletedAt: null
    });

    if (userWithSameEmail) {
      return res.status(400).json({ error: "Email ya en uso" });
    }

    const userWithSameUsername = await User.findOne({
      username: req.body.username,
      deletedAt: null
    });

    if (userWithSameUsername) {
      return res.status(400).json({ error: "Nombre de usuario ya en uso" });
    }

    if (new Date(req.body.birthDate) == "Invalid Date") {
      return res.status(400).json({ error: "Fecha de nacimiento inválida" });
    }
    if (req.body.birthDate) req.body.birthdate = new Date(req.body.birthDate);

    req.body.image = `${req.file ? `${process.env.API_URL}/api/uploads/${req.file.filename}` : `${process.env.API_URL}/api/images/default_user.png`}`;

    const alreadyUser = await User.findOne({
      $or: [
        { email: email },
        { username: req.body.username }
      ],
      deletedAt: null
    });

    if (alreadyUser) {
      const user = await User.findByIdAndUpdate(alreadyUser._id, { deletedAt: null });



      if (req.body.role === "enterprise") {
        return res.status(201).json({ message: `Empresa ${user.commercialName} registrada correctamente` });
      }

      return res.status(201).json({ message: "Usuario registrado correctamente" });
    } else {
      const user = new User(req.body);
      await user.save();

      if (req.body.role === "enterprise") {
        return res.status(201).json({ message: `Empresa ${user.commercialName} registrada correctamente` });
      }

      return res.status(201).json({ message: "Usuario registrado correctamente" });
    }
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

authController.updateUser = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);

    console.log(req.files);
    console.log(req.file);
    
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (req.body.email) {
      const emailAlreadyExists = await User.findOne({
        email: req.body.email,
        _id: { $ne: user._id },
      });

      if (emailAlreadyExists) return res.status(400).json({ error: "Email ya en uso" });
    }

    if (req.file) {
      req.body.image = `${process.env.API_URL}/api/uploads/${req.file.filename}`;
    }

    req.body.enterpriseAprobationPending = req.body.enterpriseAprobationPending ? true : false;

    await User.findByIdAndUpdate(payload.id, req.body);
    res.status(200).json({ message: "User updated successfully" });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

authController.registerEnterprise = async (req, res) => {
  try {
    const email = req.body.email;
    const userWithSameEmail = await User.findOne({
      email: email,
      deletedAt: null
    });

    if (userWithSameEmail) {
      return res.status(400).json({ error: "Email ya en uso" });
    }

    const userWithSameUsername = await User.findOne({
      username: req.body.username,
      deletedAt: null
    });

    if (userWithSameUsername) {
      return res.status(400).json({ error: "Nombre comercial ya en uso" });
    }

    req.body.image = `${req.files.image ? `${process.env.API_URL}/api/uploads/${req.files.image[0].filename}` : `${process.env.API_URL}/api/images/default_user.png`}`;
    req.body.role = "enterprise";

    if (req.files.images && req.files.images.length > 0) {
      req.body.images = req.files.images.map((image) => {
        return `${process.env.API_URL}/api/uploads/${image.filename}`;
      });
    }

    const alreadyUser = await User.findOne({
      $or: [
        { email: email },
        { username: req.body.username }
      ],
      deletedAt: null
    });

    if(alreadyUser) {
      const user = await User.findByIdAndUpdate(alreadyUser._id, { deletedAt: null });

      if (req.body.role === "enterprise") {
        return res.status(201).json({ message: `Empresa ${user.commercialName} registrada correctamente` });
      }

      return res.status(201).json({ message: "Usuario registrado correctamente" });
    }

    const user = new User(req.body);
    await user.save();

    const newService = new Service({
      nombre: req.body.commercialName,
      ciudad: req.body.city,
      distrito: req.body.district,
      departamento: req.body.department,
      direccion: req.body.address,
      telefono: req.body.phone,
      categoria: req.body.principalActivity,
      etiquetas: req.body.secondaryActivity ? [req.body.secondaryActivity] : [],
      detalle: req.body.description,
      imagen: req.body.image || `${process.env.API_URL}/api/images/default_service.png`,
      imagenes: req.body.images || [],
      user: user._id,
      ruc: req.body.ruc,
      times: req.body.times || "",
    });

    await newService.save();
    res.status(201).json({ message: "User registered successfully" });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

authController.login = async (req, res) => {
  try {
    const { email, password, date, device, deviceOs } = req.body;
    const user = await User.findOne({ email });

    if(!user) return res.status(401).json({ message: "Credenciales inválidas" });

    if(user.deletedAt) {
      return res.status(404).json({ message: "Cuenta deshabilitada, vuelve a registrar el email para recuperarla." });
    }

    if (user.banned) {
      return res.status(403).json({ message: "Tu cuenta ha sido baneada permanentemente." });
    }

    if (user.suspendedTo && new Date(user.suspendedTo) > new Date()) {
      return res.status(403).json({ message: `Tu cuenta está suspendida hasta el ${new Date(user.suspendedTo).toLocaleDateString('es-AR')}.` });
    }

    if (user.enterpriseAprobationPending === true) {
      if (!(await user.comparePassword(password))) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }
      const token = jwt.sign({ id: user._id, role: 'user' }, process.env.JWT_SECRET);
      return res.status(200).json({ token, role: 'user', suscription: user.suscription, enterpriseAprobationPending: true });
    }

    if (user.role === 'enterprise' && user.enterpriseActive === false) {
      if (!(await user.comparePassword(password))) {
        return res.status(401).json({ message: "Credenciales inválidas" });
      }
      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);
      return res.status(200).json({ token, role: 'user', suscription: user.suscription, enterpriseDeactivated: true });
    }

    if (!user || !(await user.comparePassword(password))) {
      if (user && user.saveHistory) {
        const login = new Login({
          user: user._id,
          date: date || new Date(),
          device: `${deviceOs} | (${device})` || "Desconocido",
          status: 'failed'
        });

        await login.save();
      }

      if (user && user.loginNotifications) createUserNotification(user._id, "Intento de inicio de sesión fallido", "Se ha detectado un intento de inicio de sesión fallido en tu cuenta.", 'empresa/config/security');

      return res.status(401).json({ message: "Credenciales inválidas" });
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);

    if (user.saveHistory) {
      const login = new Login({
        user: user._id,
        date: date || new Date(),
        device: device || deviceOs || "Desconocido",
        status: 'connected'
      });

      await login.save();
    }

    if (user.loginNotifications) createUserNotification(user._id, "Inicio de sesión exitoso", "Has iniciado sesión correctamente.", 'empresa/config/security');

    res.status(200).json({ token, role: user.role, suscription: user.suscription });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

authController.socialLogin = async (req, res) => {
  try {
    const { provider, token } = req.body;
    let userData;

    if (provider === "google") {
      userData = await verifyGoogleToken(token);
    } else if (provider === "facebook") {
      userData = await verifyFacebookToken(token);
    } else {
      throw new Error("Proveedor no válido");
    }

    const email = userData.email;

    const userWithSameEmail = await User.findOne({
      email: email,
    });

    if (userWithSameEmail.deletedAt) {
      return res.status(404).json({ message: "Cuenta deshabilitada, vuelve a registrar el email para recuperarla." });
    }

    if (userWithSameEmail) {
      const token = jwt.sign({ id: userWithSameEmail._id, role: userWithSameEmail.role }, process.env.JWT_SECRET);
      return res.status(200).json({ token, role: userWithSameEmail.role });
    }

    const user = new User({
      email: userData.email,
      username: userData.name,
      password: Math.random().toString(36).substring(7),
      birthdate: new Date(),
      genre: "Otro",
      dni: "00000000",
      phone: "00000000",
      role: "user",
    });

    await user.save();

    const registeredToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET);

    return res.status(200).json({ token: registeredToken, role: user.role });
  } catch (error) {
    console.log(error);
    res.status(400).json({ error: error.message });
  }
};

authController.whoIam = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    const unreadNotifications = await Notification.countDocuments({ user: user._id, readed: false });
    const unreadMessages = await Message.countDocuments({
      participants: { $in: [user._id] },
      readed: false
    });
    const isEnterpriseAlso = user.ruc ? true : false;

    res.status(200).json({ user, unreadNotifications, unreadMessages, isEnterpriseAlso });
  } catch (error) {
    res.status(401).json({ message: "Token inválido" });
  }
};

authController.getUsersByTokens = async (req, res) => {
  try {
    const tokens = req.body.tokens;

    if (!Array.isArray(tokens) || tokens.length === 0) {
      return res.status(400).json({ error: "Tokens inválidos" });
    }

    const usersPromises = tokens.map(async (token) => {
      if (!token) return null;

      const payload = jwt.verify(token, process.env.JWT_SECRET);

      const user = await User.findById(payload.id, {
        image: 1,
        username: 1,
        suscription: 1,
      });

      if (!user) return null;

      return {
        id: user._id,
        image: user.image,
        username: user.username,
        suscription: user.suscription,
        token: token,
      };
    });

    const users = (await Promise.all(usersPromises)).filter(Boolean);

    return res.status(200).json(users);

  } catch (error) {
    console.log(error);
    return res.status(500).json({ error: error.message });
  }
};

authController.getModerators = async (req, res) => {
  try {
    const moderators = await User.find({ role: "moderator" }).populate("club");
    res.status(200).json(moderators);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

authController.editUser = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.id);
    console.log(req.body);
    if (!req.body.email) delete req.body.email;
    if (!req.body.dni) delete req.body.dni;
    if (!req.body.instagram) delete req.body.instagram;
    if (!req.body.phone) delete req.body.phone;
    console.log(req.files);
    console.log(req.file);

    if (req.body.email && req.body.email !== user.email) {
      const userWithSameEmail = await User.findOne({
        email: req.body.email,
      });

      if (userWithSameEmail && userWithSameEmail.email !== user.email) {
        return res.status(400).json({ error: "Email ya en uso" });
      }
    }

    if (req.body.dni && req.body.dni !== user.dni) {
      const userWithSameUsername = await User.findOne({
        dni: req.body.dni,
      });

      if (userWithSameUsername && userWithSameUsername.dni !== user.dni) {
        return res.status(400).json({ error: "DNI ya en uso" });
      }
    }

    if (req.body.instagram && req.body.instagram !== user.instagram) {
      const userWithSameUsername = await User.findOne({
        instagram: req.body.instagram,
      });

      if (userWithSameUsername && userWithSameUsername.instagram !== user.instagram) {
        return res.status(400).json({ error: "Instagram ya en uso" });
      }
    }

    if (req.body.phone && req.body.phone !== user.phone) {
      const userWithSameUsername = await User.findOne({
        phone: req.body.phone,
      });

      if (userWithSameUsername && userWithSameUsername.phone !== user.phone) {
        return res.status(400).json({ error: "Teléfono ya en uso" });
      }
    }

    await User.findByIdAndUpdate(payload.id, req.body);
    res.status(201).json({ message: "User registered successfully" });
  }
  catch (error) {
    res.status(400).json({ error: error.message });
  }
}

authController.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    await User.findByIdAndDelete(id);
    res.status(201).json({ message: "User deleted successfully" });
  }
  catch (error) {
    res.status(400).json({ error: error.message });
  }
}

authController.verifyAdmin = async (req, res, next) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    if (payload.role !== "admin") {
      return res.status(403).json({ message: "No tienes permisos para realizar esta acción" });
    }
    return res.status(200).json({ message: "Acción permitida" });
  } catch (error) {
    res.status(401).json({ message: "Token inválido" });
  }
}

authController.requestPasswordReset = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Usuario no encontrado" });
    }

    // Generar un código de recuperación con los últimos 6 caracteres del token
    const token = v4().slice(-5).toUpperCase();
    user.resetPasswordToken = token;
    user.resetPasswordExpires = Date.now() + (5 * 60 * 1000); // 5 minutos
    await user.save();

    // Configurar transporte de correo
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      }
    });

    // Enviar correo
    const mailOptions = {
      to: user.email,
      from: process.env.EMAIL_USER,
      subject: "Recuperación de contraseña",
      html: `<!DOCTYPE html>
        <html lang="es">
          <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Código de Recuperación de Contraseña</title>
              <style>
                  body {
                      font-family: Arial, sans-serif;
                      line-height: 1.6;
                      color: #000000;
                      background-color: #ffffff;
                      margin: 0;
                      padding: 0;
                  }
                  .container {
                      max-width: 600px;
                      margin: 20px auto;
                      padding: 20px;
                      border: 1px solid #000000;
                  }
                  h1 {
                      color: #000000;
                      border-bottom: 2px solid #000000;
                      padding-bottom: 10px;
                  }
                  .code {
                      font-size: 24px;
                      font-weight: bold;
                      text-align: center;
                      margin: 20px 0;
                      padding: 10px;
                      background-color: #f0f0f0;
                      border: 1px dashed #000000;
                  }
                  .footer {
                      margin-top: 20px;
                      text-align: center;
                      font-size: 12px;
                      color: #666666;
                  }
              </style>
          </head>
          <body>
              <div class="container">
                  <h1>Recuperación de Contraseña</h1>
                  <p>Has solicitado restablecer tu contraseña. Ingresa el siguiente código para continuar:</p>
                  <div class="code">${token}</div>
                  <p>El enlace es válido por 1 hora.</p>
                  <div class="footer">
                      Este es un correo electrónico automático, por favor no responda a este mensaje.
                  </div>
              </div>
          </body>
        </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    res.status(200).json({ message: "Correo enviado para recuperación de contraseña" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.verifyPasswordResetCode = async (req, res) => {
  try {
    const { email, verificationCode } = req.body;
    const user = await User.findOne({
      email,
      resetPasswordToken: verificationCode,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(404).json({ error: "Código inválido o expirado" });
    }

    res.status(200).json({ message: "Código válido" });
  }
  catch (error) {
    res.status(500).json({ error: error.message });
  }
}

authController.resetPassword = async (req, res) => {
  try {
    const { password, confirmPassword, email } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Las contraseñas no coinciden" });
    }

    const user = await User.findOne({
      email
    });

    if (!user) {
      return res.status(404).json({ error: "Código inválido o expirado" });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;
    await user.save();

    res.status(200).json({ message: "Contraseña actualizada exitosamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.changeUserSuscription = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;
    const { plan: suscription } = req.body;
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const previousSuscription = user.suscription;
    user.suscription = suscription;
    await user.save();

    if (previousSuscription !== suscription) {
      await SuscriptionChange.create({ user: id, from: previousSuscription, to: suscription });
    }

    res.status(200).json({ message: "Suscripción actualizada exitosamente" });
  }
  catch (error) {
    res.status(500).json({ error: error.message });
  }
}

authController.getUserLogins = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;
    const logins = await Login.find({ user: id }).populate("user").sort({ date: -1 });
    res.status(200).json(logins);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

authController.deleteAccount = async (req, res) => {
  try {
    const { password } = req.body;
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (!(await user.comparePassword(password))) {
      return res.status(401).json({ error: "Contraseña incorrecta" });
    }

    await User.findByIdAndUpdate(id, { deletedAt: new Date() });

    await Service.updateMany({ user: id }, { deletedAt: new Date() });
    await Adoption.updateMany({ user: id }, { deletedAt: new Date() });

    res.status(200).json({ message: "Cuenta eliminada exitosamente" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

authController.getNotifications = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;
    const notifications = await Notification.find({ user: id }).populate("user").sort({ createdAt: -1 }).limit(50);

    res.status(200).json(notifications);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

authController.readNotification = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;
    const notificationId = req.params.id;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ error: "Notificación no encontrada" });
    }

    if (notification.user.toString() !== id) {
      return res.status(403).json({ error: "No tienes permiso para marcar esta notificación como leída" });
    }

    notification.readed = true;
    await notification.save();

    res.status(200).json({ message: "Notificación marcada como leída" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

authController.readAllNotifications = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;
    await Notification.updateMany({ user: id }, { readed: true });
    res.status(200).json({ message: "Todas las notificaciones marcadas como leídas" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

authController.deleteNotification = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;
    const notificationId = req.params.id;

    const notification = await Notification.findById(notificationId);

    if (!notification) {
      return res.status(404).json({ error: "Notificación no encontrada" });
    }

    if (notification.user.toString() !== id) {
      return res.status(403).json({ error: "No tienes permiso para eliminar esta notificación" });
    }

    await Notification.findByIdAndDelete(notificationId);

    res.status(200).json({ message: "Notificación eliminada" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

authController.getBankAccounts = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    res.status(200).json(user.banks);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

authController.saveBankAccount = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const { name, type, number } = req.body;

    user.banks.push({ name, type, number });
    await user.save();

    res.status(200).json({ message: "Cuenta bancaria guardada exitosamente" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

authController.deleteBankAccount = async (req, res) => {
  try {
    const token = req.headers.authorization.split(" ")[1];
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const id = payload.id;

    const user = await User.findById(id);

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const { bankId } = req.params;
    console.log(bankId);

    await User.findByIdAndUpdate(id, { $pull: { banks: { _id: bankId } } });

    res.status(200).json({ message: "Cuenta bancaria eliminada exitosamente" });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

authController.getUsersAdmin = async (req, res) => {
  try {
    const { search = '', role = '', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query = { deletedAt: null };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { commercialName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role === 'normal')        query.role = 'user';
    else if (role === 'premium')  { query.role = 'user'; query.suscription = { $ne: 'free' }; }
    else if (role === 'empresa')  query.$or = [{ ruc: { $exists: true, $ne: null, $gt: '' } }, { commercialName: { $exists: true, $ne: null, $gt: '' } }];
    else if (role === 'moderador') query.role = { $in: ['moderator', 'aprobation'] };
    else if (role === 'administrador') query.role = 'admin';

    const [users, total] = await Promise.all([
      User.find(query)
        .select('firstName lastName commercialName email role suscription image createdAt deletedAt city department banned suspendedTo verified')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(query),
    ]);

    const [totalUsers, totalPremium, totalEnterprises] = await Promise.all([
      User.countDocuments({ deletedAt: null, role: 'user' }),
      User.countDocuments({ deletedAt: null, role: 'user', suscription: { $ne: 'free' } }),
      User.countDocuments({ deletedAt: null, $or: [{ ruc: { $exists: true, $ne: null, $gt: '' } }, { commercialName: { $exists: true, $ne: null, $gt: '' } }] }),
    ]);

    res.json({
      users,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      stats: { totalUsers, totalPremium, totalEnterprises },
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

authController.exportUsersAdmin = async (req, res) => {
  try {
    const { search = '', role = '' } = req.query;

    const query = { deletedAt: null };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { commercialName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }

    if (role === 'normal')        query.role = 'user';
    else if (role === 'premium')  { query.role = 'user'; query.suscription = { $ne: 'free' }; }
    else if (role === 'empresa')  query.$or = [{ ruc: { $exists: true, $ne: null, $gt: '' } }, { commercialName: { $exists: true, $ne: null, $gt: '' } }];
    else if (role === 'moderador') query.role = { $in: ['moderator', 'aprobation'] };
    else if (role === 'administrador') query.role = 'admin';

    const users = await User.find(query)
      .select('firstName lastName commercialName email role suscription createdAt city department')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();

    res.json({ users });
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
};

authController.adminUpdateUser = async (req, res) => {
  try {
    const allowed = [
      'firstName', 'lastName', 'username', 'email', 'phone', 'birthdate',
      'city', 'district', 'department',
      'commercialName', 'ruc', 'socialReason', 'principalActivity',
      'secondaryActivity', 'description', 'potentialSegment', 'balance',
    ];
    const update = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) update[key] = req.body[key] === '' ? null : req.body[key];
    }
    if (Object.keys(update).length === 0) return res.status(400).json({ error: 'No hay campos para actualizar' });
    await User.findByIdAndUpdate(req.params.id, update);
    res.json({ message: 'Usuario actualizado correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .select('-password -resetPasswordToken -resetPasswordExpires -times')
      .lean();
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.getUserActivity = async (req, res) => {
  try {
    const userId = req.params.id;
    const [personal, global] = await Promise.all([
      Notification.find({ user: userId }).sort({ createdAt: -1 }).limit(50).lean(),
      SystemNotification.find({ specificUser: userId }).sort({ createdAt: -1 }).limit(50).lean(),
    ]);
    const merged = [
      ...personal.map(n => ({ ...n, source: 'personal' })),
      ...global.map(n => ({ ...n, source: 'global' })),
    ];
    merged.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    res.json({ activity: merged.slice(0, 50) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.getUserReports = async (req, res) => {
  try {
    const reports = await FindMe.find({ user: req.params.id, deletedAt: null }).sort({ createdAt: -1 }).lean();
    res.json({ reports });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.updateUserRole = async (req, res) => {
  try {
    const { role, suscription } = req.body;
    const update = {};
    if (role) update.role = role;
    if (suscription !== undefined) update.suscription = suscription;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    await User.findByIdAndUpdate(req.params.id, update);
    if (suscription !== undefined && suscription !== user.suscription) {
      await SuscriptionChange.create({ user: req.params.id, from: user.suscription ?? 'free', to: suscription });
    }
    res.json({ message: "Cuenta actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.suspendUser = async (req, res) => {
  try {
    const { suspendedTo } = req.body;
    await User.findByIdAndUpdate(req.params.id, { suspendedTo: new Date(suspendedTo), banned: false });
    res.json({ message: "Usuario suspendido correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.banUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    const newBanned = !user.banned;
    await User.findByIdAndUpdate(req.params.id, { banned: newBanned, suspendedTo: null });
    res.json({ message: newBanned ? "Usuario baneado permanentemente" : "Usuario desbaneado", banned: newBanned });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.resetUserPassword = async (req, res) => {
  try {
    const { password } = req.body;
    if (!password || password.length < 6) {
      return res.status(400).json({ error: "La contraseña debe tener al menos 6 caracteres" });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: "Usuario no encontrado" });
    user.password = password;
    await user.save();
    res.json({ message: "Contraseña actualizada correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.verifyUser = async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.params.id, { verified: true });
    res.json({ message: "Usuario verificado correctamente" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// * EMPRESAS ADMIN

authController.getEnterprisesAdmin = async (req, res) => {
  try {
    const { search = '', page = 1, limit = 20 } = req.query;
    const skip = (Number(page) - 1) * Number(limit);

    const query = {
      $and: [
        { $or: [{ ruc: { $exists: true, $ne: null, $gt: '' } }, { commercialName: { $exists: true, $ne: null, $gt: '' } }] },
        { deletedAt: null },
        ...(search
          ? [{ $or: [{ commercialName: { $regex: search, $options: 'i' } }, { email: { $regex: search, $options: 'i' } }] }]
          : []),
      ],
    };

    const [enterprises, total, totalFeatured, totalInactive, totalPending] = await Promise.all([
      User.find(query)
        .select('commercialName email city department image createdAt featured priority enterpriseActive ruc enterpriseAprobationPending')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      User.countDocuments(query),
      User.countDocuments({ $or: [{ ruc: { $exists: true, $ne: null, $gt: '' } }, { commercialName: { $exists: true, $ne: null, $gt: '' } }], deletedAt: null, featured: true }),
      User.countDocuments({ $or: [{ ruc: { $exists: true, $ne: null, $gt: '' } }, { commercialName: { $exists: true, $ne: null, $gt: '' } }], deletedAt: null, enterpriseActive: false }),
      User.countDocuments({ $or: [{ ruc: { $exists: true, $ne: null, $gt: '' } }, { commercialName: { $exists: true, $ne: null, $gt: '' } }], enterpriseAprobationPending: true, deletedAt: null }),
    ]);

    res.json({
      enterprises,
      total,
      page: Number(page),
      totalPages: Math.ceil(total / Number(limit)),
      stats: { total, totalFeatured, totalInactive, totalPending },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.exportEnterprisesAdmin = async (req, res) => {
  try {
    const { search = '' } = req.query;
    const query = { $or: [{ ruc: { $exists: true, $ne: null, $gt: '' } }, { commercialName: { $exists: true, $ne: null, $gt: '' } }], deletedAt: null };
    if (search) {
      query.$or = [
        { commercialName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
      ];
    }
    const enterprises = await User.find(query)
      .select('commercialName email city department createdAt featured priority enterpriseActive ruc')
      .sort({ createdAt: -1 })
      .limit(5000)
      .lean();
    res.json({ enterprises });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.toggleFeaturedEnterprise = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Empresa no encontrada' });
    const newFeatured = !user.featured;
    await User.findByIdAndUpdate(req.params.id, { featured: newFeatured });
    res.json({ message: newFeatured ? 'Empresa destacada' : 'Empresa quitada de destacados', featured: newFeatured });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.setEnterprisePriority = async (req, res) => {
  try {
    const { priority } = req.body;
    const p = Number(priority);
    if (isNaN(p) || p < 1 || p > 100) return res.status(400).json({ error: 'Prioridad debe ser entre 1 y 100' });
    await User.findByIdAndUpdate(req.params.id, { priority: p });
    res.json({ message: 'Prioridad actualizada', priority: p });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.toggleEnterpriseActive = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Empresa no encontrada' });
    const newActive = !user.enterpriseActive;
    await User.findByIdAndUpdate(req.params.id, { enterpriseActive: newActive });
    res.json({ message: newActive ? 'Empresa activada' : 'Empresa desactivada', enterpriseActive: newActive });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.bulkDisableEnterprises = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'Se requiere al menos un ID' });
    }
    const now = new Date();
    await Promise.all([
      User.updateMany({ _id: { $in: ids } }, { deletedAt: now }),
      Service.updateMany({ user: { $in: ids } }, { deletedAt: now }),
    ]);
    res.json({ message: `${ids.length} empresa(s) eliminada(s) correctamente`, count: ids.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.getPendingEnterprises = async (req, res) => {
  try {
    const pending = await User.find({ enterpriseAprobationPending: true, deletedAt: null })
      .select('firstName lastName commercialName email ruc socialReason city district department principalActivity secondaryActivity description potentialSegment image images createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ pending, total: pending.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.approveEnterprise = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    await User.findByIdAndUpdate(req.params.id, {
      role: 'enterprise',
      enterpriseAprobationPending: false,
    });
    res.json({ message: 'Empresa aprobada correctamente' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.denyEnterprise = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });
    await User.findByIdAndUpdate(req.params.id, {
      role: 'user',
      enterpriseAprobationPending: false,
    });
    res.json({ message: 'Solicitud de empresa denegada' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.getEnterpriseHistory = async (req, res) => {
  try {
    const userId = req.params.id;
    const events = [];

    // 1. Servicios
    const services = await Service.find({ user: userId })
      .select('nombre createdAt updatedAt deletedAt')
      .lean();

    for (const svc of services) {
      events.push({ type: 'service_created', date: svc.createdAt, label: `Servicio creado`, meta: svc.nombre });
      if (svc.updatedAt && new Date(svc.updatedAt) - new Date(svc.createdAt) > 60000) {
        events.push({ type: 'service_edited', date: svc.updatedAt, label: `Servicio editado`, meta: svc.nombre });
      }
      if (svc.deletedAt) {
        events.push({ type: 'service_disabled', date: svc.deletedAt, label: `Servicio eliminado`, meta: svc.nombre });
      }
    }

    // 2. Cupones
    const serviceIds = services.map(s => s._id);
    const coupons = await Cupon.find({ service: { $in: serviceIds } })
      .populate('service', 'nombre')
      .select('nombre tipoDescuento valorDescuento premium createdAt deletedAt')
      .lean();

    for (const cup of coupons) {
      const svcName = cup.service?.nombre || '';
      const desc = cup.nombre + (svcName ? ` — ${svcName}` : '');
      events.push({ type: 'coupon_created', date: cup.createdAt, label: `Cupón creado${cup.premium ? ' (Premium)' : ''}`, meta: desc });
      if (cup.deletedAt) {
        events.push({ type: 'coupon_deleted', date: cup.deletedAt, label: `Cupón eliminado`, meta: desc });
      }
    }

    // 3. Cupones premium canjeados
    const couponIds = coupons.map(c => c._id);
    if (couponIds.length > 0) {
      const usedCodes = await CouponCode.find({ coupon: { $in: couponIds }, status: 'approved' })
        .populate({ path: 'coupon', select: 'nombre service', populate: { path: 'service', select: 'nombre' } })
        .select('updatedAt createdAt')
        .lean();
      for (const code of usedCodes) {
        const couponName = code.coupon?.nombre || '';
        const svcName = code.coupon?.service?.nombre || '';
        const meta = [couponName, svcName].filter(Boolean).join(' — ');
        events.push({ type: 'coupon_used', date: code.updatedAt || code.createdAt, label: 'Cupón premium canjeado', meta });
      }
    }

    // 4. Solicitudes de destacado
    const featuredReqs = await FeaturedRequest.find({ user: userId })
      .populate('service', 'nombre')
      .select('status createdAt updatedAt')
      .lean();

    for (const req of featuredReqs) {
      const svcName = req.service?.nombre || '';
      events.push({ type: 'featured_requested', date: req.createdAt, label: 'Solicitud de destacado enviada', meta: svcName });
      if (req.status === 'approved') {
        events.push({ type: 'featured_approved', date: req.updatedAt, label: 'Solicitud de destacado aprobada', meta: svcName });
      } else if (req.status === 'rejected') {
        events.push({ type: 'featured_rejected', date: req.updatedAt, label: 'Solicitud de destacado rechazada', meta: svcName });
      }
    }

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    res.json({ history: events.slice(0, 150) });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

authController.getEnterpriseMetrics = async (req, res) => {
  try {
    const services = await Service.find({ user: req.params.id, deletedAt: null }).lean();
    const metrics = await Promise.all(services.map(async (service) => {
      const coupons = await Cupon.find({ service: service._id }).lean();
      const couponIds = coupons.map(c => c._id);
      const conversiones = await CouponCode.countDocuments({ coupon: { $in: couponIds }, status: 'approved' });
      return {
        serviceName: service.nombre,
        vistas: service.vistas ?? 0,
        clicks: service.score ?? 0,
        conversiones,
        cupones: coupons.length,
      };
    }));
    res.json({ metrics });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export default authController;