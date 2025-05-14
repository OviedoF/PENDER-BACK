import EmailVerification from '../models/EmailVerification.js';
import { sendVerificationEmail } from '../utils/sendEmail.js';

const generateCode = () => Math.floor(100000 + Math.random() * 900000).toString(); // 6 dígitos

export const requestVerification = async (req, res) => {
  const { email } = req.body;

  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutos

  await EmailVerification.findOneAndUpdate(
    { email },
    { code, expiresAt },
    { upsert: true, new: true }
  );

  await sendVerificationEmail({ to: email, code });

  res.status(200).json({ message: 'Código de verificación enviado al correo.' });
};

export const verifyCode = async (req, res) => {
  const { email, code } = req.body;

  const record = await EmailVerification.findOne({ email, code });
  if (!record || record.expiresAt < new Date()) {
    return res.status(400).json({ message: 'Código inválido o expirado.' });
  }

  await EmailVerification.deleteOne({ _id: record._id });

  res.status(200).json({ message: 'Correo verificado correctamente.' });
};

