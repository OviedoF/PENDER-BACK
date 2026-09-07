import SystemNotification from '../models/SystemNotification.js';
import SystemNotificationTemplate from '../models/SystemNotificationTemplate.js';

export default async function createSystemNotification({
    title,
    text,
    link = null,
    params = null,
    specificUser = null
}) {
    const notification = new SystemNotification({
        title,
        text,
        readedBy: [],
        link,
        paramsStringify: params ? JSON.stringify(params) : null,
        specificUser
    });

    await notification.save();
}

// Catálogo de pop-ups de sistema generados automáticamente por eventos.
// Los textos son los valores por defecto; el admin puede sobreescribirlos
// (o desactivar el evento) desde Marketing → Pop-ups de sistema.
// Las variables se insertan con {{nombre}}.
export const SYSTEM_NOTIFICATION_EVENTS = {
    adoption_adopted: {
        label: 'Mascota adoptada',
        description: 'Pop-up global cuando una mascota se marca como adoptada.',
        audience: 'global',
        variables: { nombre: 'Nombre de la mascota' },
        title: '{{nombre}} fue adoptado/a en Petnder!',
        text: 'Una mascota más ha sido adoptada en Petnder 🤗',
    },
    pet_recovered: {
        label: 'Mascota recuperada',
        description: 'Pop-up global cuando una mascota perdida vuelve con su dueño.',
        audience: 'global',
        variables: { nombre: 'Nombre de la mascota' },
        title: '{{nombre}} fue encontrado/a!',
        text: 'Nos alegra comunicar que ha vuelto con su dueño!',
    },
    pet_recovered_report: {
        label: 'Reporte recuperado (al autor del reporte)',
        description: 'Aviso al autor del reporte cuando su mascota se marca como recuperada.',
        audience: 'specific',
        variables: { nombre: 'Nombre de la mascota' },
        title: '{{nombre}} fue recuperado/a!',
        text: 'Nos alegra comunicar que la mascota ha vuelto con su dueño.',
    },
    adoption_request: {
        label: 'Solicitud de adopción (al dueño)',
        description: 'Aviso al dueño de la publicación cuando alguien solicita adoptar.',
        audience: 'specific',
        variables: { usuario: 'Nombre del solicitante', nombre: 'Nombre de la mascota' },
        title: 'Nueva solicitud de adopción',
        text: '{{usuario}} quiere adoptar a {{nombre}}',
    },
    adoption_rejected: {
        label: 'Solicitud rechazada (al solicitante)',
        description: 'Aviso al solicitante cuando el dueño rechaza su solicitud de adopción.',
        audience: 'specific',
        variables: {},
        title: 'Solicitud de adopción rechazada',
        text: 'El dueño rechazó tu solicitud de adopción.',
    },
    found_pet_request: {
        label: 'Posible encuentro (al dueño)',
        description: 'Aviso al dueño del reporte cuando alguien cree haber encontrado a su mascota.',
        audience: 'specific',
        variables: { usuario: 'Nombre de quien reporta', nombre: 'Nombre de la mascota' },
        title: 'Posible mascota encontrada',
        text: '{{usuario}} cree haber encontrado a {{nombre}}',
    },
    chat_new_message: {
        label: 'Mensajes sin leer (al receptor)',
        description: 'Aviso al receptor cuando recibe un mensaje de chat estando fuera de la conversación.',
        audience: 'specific',
        variables: { tipo: '"en adopción" o "en perdidos"' },
        title: 'Tienes mensajes {{tipo}}!',
        text: 'Revisa tu bandeja de entrada desde el ícono de Mensajes.',
    },
    findme_match_alert: {
        label: 'Reporte con coincidencias',
        description: 'Pop-up global cuando un reporte de mascota perdida/encontrada tiene coincidencias.',
        audience: 'global',
        variables: {
            tipo: 'Tipo de reporte (perdida / encontrada)',
            departamento: 'Departamento del reporte',
            nombre: 'Nombre de la mascota',
            especie: 'Especie de la mascota',
            zona: 'Zona del reporte',
            coincidencias: 'Cantidad de coincidencias',
            notificados: 'Cantidad de usuarios notificados',
        },
        title: 'Mascota {{tipo}} en {{departamento}}',
        text: 'Se reportó {{nombre}} ({{especie}}) en {{zona}}. {{coincidencias}} coincidencia(s) encontrada(s), se notificó a {{notificados}} usuario(s).',
    },
    findme_zone_alert: {
        label: 'Alerta de zona',
        description: 'Pop-up global cuando se notifica a usuarios cercanos sobre un reporte.',
        audience: 'global',
        variables: {
            departamento: 'Departamento del reporte',
            cantidad: 'Cantidad de usuarios cercanos notificados',
            nombre: 'Nombre de la mascota',
            especie: 'Especie de la mascota',
            zona: 'Zona del reporte',
        },
        title: 'Alerta de zona: {{departamento}}',
        text: 'Se notificó a {{cantidad}} usuario(s) cercanos sobre {{nombre}} ({{especie}}) en {{zona}}.',
    },
};

// Crea la notificación de un evento usando el texto editado en el admin si existe
// (y no la crea si el admin desactivó el evento). Nunca lanza: un pop-up fallido
// no debe romper la operación principal.
export async function createSystemNotificationFromTemplate(event, variables = {}, extra = {}) {
    try {
        const def = SYSTEM_NOTIFICATION_EVENTS[event];
        if (!def) return;

        const override = await SystemNotificationTemplate.findOne({ event }).lean();
        if (override && override.active === false) return;

        const render = (str) => String(str ?? '').replace(/\{\{\s*([a-zA-Z_]+)\s*\}\}/g, (match, key) => {
            const value = variables[key];
            return value === undefined || value === null ? match : String(value);
        });

        await createSystemNotification({
            title: render(override?.title || def.title),
            text: render(override?.text ?? def.text),
            ...extra,
        });
    } catch (error) {
        console.error(`Error creando pop-up de sistema (${event}):`, error.message);
    }
}
