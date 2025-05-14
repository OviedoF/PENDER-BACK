import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

export const sendVerificationEmail = async ({ to, code }) => {
  const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.MAIL_USERNAME,
        pass: process.env.MAIL_PASSWORD,
      }
    });


  await transporter.sendMail({
    from: `"Pender" <${process.env.MAIL_USERNAME}>`,
    to,
    subject: 'Tu código de verificación',
    html: `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Código de Verificación</title>
    <style type="text/css">
        /* Estilos base */
        body, html {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            line-height: 1.6;
        }
        /* Algunos clientes de correo ignoran los estilos externos */
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Encabezado con gradiente -->
        <tr>
            <td style="background: linear-gradient(90deg, #FC684E 0.01%, #DE0A5E 100.01%); padding: 30px 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 24px; font-weight: bold;">Código de Verificación</h1>
            </td>
        </tr>
        
        <!-- Contenido principal -->
        <tr>
            <td style="padding: 30px 20px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td style="text-align: center; padding-bottom: 20px;">
                            <p style="margin-top: 0; font-size: 16px;">Hola,</p>
                            <p style="font-size: 16px;">Hemos recibido una solicitud para verificar tu cuenta. Utiliza el siguiente código para completar el proceso:</p>
                        </td>
                    </tr>
                    
                    <!-- Código de verificación -->
                    <tr>
                        <td style="text-align: center; padding: 20px 0;">
                            <div style="background-color: #f7f7f7; border: 1px solid #e0e0e0; border-radius: 8px; padding: 20px; display: inline-block; margin: 0 auto;">
                                <p style="font-size: 32px; font-weight: bold; letter-spacing: 5px; margin: 0; color: #333333;">
                                ${code}
                                </p>
                            </div>
                        </td>
                    </tr>
                    
                    <tr>
                        <td style="text-align: center; padding-top: 20px;">
                            <p style="font-size: 16px;">Este código expirará en 10 minutos por razones de seguridad.</p>
                            <p style="font-size: 16px;">Si no has solicitado este código, puedes ignorar este mensaje o contactarnos si tienes alguna preocupación.</p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        
        <!-- Pie de página -->
        <tr>
            <td style="background-color: #ED3954; padding: 20px; text-align: center; color: white;">
                <p style="margin: 0; font-size: 14px;">© 2025 Pender. Todos los derechos reservados.</p>
                <p style="margin: 10px 0 0; font-size: 12px;">Este es un correo automático, por favor no respondas a este mensaje.</p>
            </td>
        </tr>
    </table>
</body>
</html>`
  });
};