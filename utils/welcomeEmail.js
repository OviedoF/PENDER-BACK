const welcomeEmail = () => {
return `
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Bienvenido/a</title>
    <style type="text/css">
        /* Estilos base */
        body, html {
            margin: 0;
            padding: 0;
            font-family: Arial, sans-serif;
            line-height: 1.6;
        }
        /* Algunos clientes de correo ignoran los estilos externos, por lo que usamos estilos en línea también */
    </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f4f4f4; font-family: Arial, sans-serif;">
    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff;">
        <!-- Encabezado con gradiente -->
        <tr>
            <td style="background: linear-gradient(90deg, #FC684E 0.01%, #DE0A5E 100.01%); padding: 30px 20px; text-align: center; color: white;">
                <h1 style="margin: 0; font-size: 28px; font-weight: bold;">¡Bienvenido/a!</h1>
            </td>
        </tr>
        
        <!-- Contenido principal -->
        <tr>
            <td style="padding: 30px 20px;">
                <table border="0" cellpadding="0" cellspacing="0" width="100%">
                    <tr>
                        <td>
                            <p style="margin-top: 0; font-size: 16px;">Estimado/a cliente,</p>
                            <p style="font-size: 16px;">¡Gracias por unirte a nosotros! Estamos encantados de tenerte como parte de nuestra comunidad.</p>
                            <p style="font-size: 16px;">Tu cuenta ha sido creada exitosamente y ahora puedes disfrutar de todos nuestros servicios.</p>
                            
                            <p style="font-size: 16px;">Con tu nueva cuenta podrás:</p>
                            <ul style="font-size: 16px;">
                                <li>Acceder a contenido exclusivo</li>
                                <li>Gestionar tus preferencias</li>
                                <li>Recibir ofertas especiales</li>
                                <li>Participar en nuestra comunidad</li>
                            </ul>
                            
                            <p style="font-size: 16px;">Si tienes alguna pregunta, no dudes en contactarnos.</p>
                        </td>
                    </tr>
                    
                    <!-- Botón de acción -->
                    <tr>
                        <td style="padding: 20px 0; text-align: center;">
                            <table border="0" cellpadding="0" cellspacing="0" style="margin: 0 auto;">
                                <tr>
                                    <td style="background: linear-gradient(90deg, #FC684E 0.01%, #DE0A5E 100.01%); border-radius: 4px; padding: 0;">
                                        <a href="#" style="display: inline-block; padding: 12px 30px; color: white; text-decoration: none; font-weight: bold; font-size: 16px;">COMENZAR AHORA</a>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
        
        <!-- Pie de página -->
        <tr>
            <td style="background-color: #ED3954; padding: 20px; text-align: center; color: white;">
                <p style="margin: 0; font-size: 14px;">© 2025 Tu Empresa. Todos los derechos reservados.</p>
                <p style="margin: 10px 0 0; font-size: 14px;">
                    <a href="#" style="color: white; text-decoration: underline; margin: 0 10px;">Política de Privacidad</a>
                    <a href="#" style="color: white; text-decoration: underline; margin: 0 10px;">Términos de Servicio</a>
                </p>
                <p style="margin: 10px 0 0; font-size: 12px;">Si no deseas recibir más correos, puedes <a href="#" style="color: white; text-decoration: underline;">darte de baja</a>.</p>
            </td>
        </tr>
    </table>
</body>
</html>
`;
}

export default welcomeEmail;