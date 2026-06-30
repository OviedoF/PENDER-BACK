import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export default async function sendGenericEmail({ to, subject, body }) {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.MAIL_USERNAME,
      pass: process.env.MAIL_PASSWORD,
    },
  });

  await transporter.sendMail({
    from: `"Petnder" <${process.env.MAIL_USERNAME}>`,
    to,
    subject,
    html: `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <tr>
            <td style="background: linear-gradient(90deg, #FC684E 0.01%, #DE0A5E 100.01%); padding: 30px 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">${subject}</h1>
            </td>
        </tr>
        <tr>
            <td style="padding: 30px 20px;">
                <p style="font-size: 16px; color: #333; line-height: 1.6;">${body}</p>
            </td>
        </tr>
        <tr>
            <td style="background-color: #ED3954; padding: 20px; text-align: center; color: white;">
                <p style="margin: 0; font-size: 14px;">© 2025 Petnder. Todos los derechos reservados.</p>
                <p style="margin: 10px 0 0; font-size: 12px;">Este es un correo automatico, por favor no respondas a este mensaje.</p>
            </td>
        </tr>
    </table>
</body>
</html>`,
  });
}
