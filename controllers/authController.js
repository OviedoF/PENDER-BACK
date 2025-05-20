import User from '../models/User.js';
import Login from '../models/Login.js';
import Notification from '../models/Notification.js';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import fetch from 'node-fetch';
import { v4 } from 'uuid';
import createUserNotification from '../utils/createUserNotification.js';

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
    });

    if (userWithSameEmail) {
      return res.status(400).json({ error: "Email ya en uso" });
    }

    const userWithSameUsername = await User.findOne({
      username: req.body.username,
    });

    if (userWithSameUsername) {
      return res.status(400).json({ error: "Nombre de usuario ya en uso" });
    }

    if (new Date(req.body.birthDate) == "Invalid Date") {
      return res.status(400).json({ error: "Fecha de nacimiento inválida" });
    }
    if (req.body.birthDate) req.body.birthdate = new Date(req.body.birthDate);

    req.body.image = `${req.file ? `${process.env.API_URL}/uploads/${req.file.filename}` : `${process.env.API_URL}/images/default_user.png`}`;

    const user = new User(req.body);
    await user.save();
    console.log("Correo enviado:", info.response);
    return res.status(201).json({ message: "User registered successfully" });
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

    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const emailAlreadyExists = await User.findOne({
      email: req.body.email,
      _id: { $ne: user._id },
    });

    if (emailAlreadyExists) return res.status(400).json({ error: "Email ya en uso" });

    if (req.file) {
      req.body.image = `${process.env.API_URL}/uploads/${req.file.filename}`;
    }

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
    });

    if (userWithSameEmail) {
      return res.status(400).json({ error: "Email ya en uso" });
    }

    const userWithSameUsername = await User.findOne({
      username: req.body.username,
    });

    if (userWithSameUsername) {
      return res.status(400).json({ error: "Nombre comercial ya en uso" });
    }

    req.body.image = `${req.file ? `${process.env.APP_URL}/uploads/${req.file.filename}` : `${process.env.API_URL}/images/default_user.png`}`;
    req.body.role = "enterprise";

    if (req.files.images && req.files.images.length > 0) {
      req.body.images = req.files.images.map((image) => {
        return `${process.env.API_URL}/api/uploads/${image.filename}`;
      });
    }

    const user = new User(req.body);
    await user.save();
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

    if (!user || !(await user.comparePassword(password))) {
      if (user.saveHistory) {
        const login = new Login({
          user: user._id,
          date: date || new Date(),
          device: `${deviceOs} | (${device})` || "Desconocido",
          status: 'failed'
        });

        await login.save();
      }

      if(user.loginNotifications) createUserNotification(user._id, "Intento de inicio de sesión fallido", "Se ha detectado un intento de inicio de sesión fallido en tu cuenta.", 'empresa/config/securityHistory');

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

    if (user.loginNotifications) createUserNotification(user._id, "Inicio de sesión exitoso", "Has iniciado sesión correctamente.", 'empresa/config/securityHistory');

    res.status(200).json({ token, role: user.role });
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

    if (userWithSameEmail) {
      const token = jwt.sign({ id: userWithSameEmail._id, role: userWithSameEmail.role }, process.env.JWT_SECRET, { expiresIn: "1d" });
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

    const registeredToken = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "1d" });

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

    res.status(200).json({ user });
  } catch (error) {
    res.status(401).json({ message: "Token inválido" });
  }
};

authController.getUsersByTokens = async (req, res) => {
  try {
    const tokens = req.body.tokens;
    const users = []

    tokens.forEach((token) => {
      if (!token) {
        return res.status(400).json({ error: "Token inválido" });
      }
    });

    const usersPromises = tokens.map(async (token) => {
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.id, { image: 1, username: 1, suscription: 1 });
      if (!user) {
        return res.status(404).json({ error: "Usuario no encontrado" });
      }
      return {
        id: user._id,
        image: user.image,
        username: user.username,
        suscription: user.suscription,
        token: token,
      };
    });

    const usersData = await Promise.all(usersPromises);
    usersData.forEach((user) => {
      if (user) {
        users.push(user);
      }
    });

    res.status(200).json(users);
  } catch (error) {
    console.log(error);
    res.status(500).json({ error: error.message });
  }
}

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

    console.log(user.suscription, suscription);
    user.suscription = suscription;

    await user.save();
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
    const {password} = req.body;
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

    await User.findByIdAndDelete(id);                         
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
    const notifications = await Notification.find({ user: id }).populate("user").sort({ date: -1 }).limit(50);

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

export default authController;