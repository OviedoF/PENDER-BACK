import nodemailer from 'nodemailer';
import EmailAutomation from '../models/EmailAutomation.js';
import { buildEmailHtml } from './emailHtml.js';

/**
 * Variables disponibles en las plantillas de automatización.
 * Se reemplazan tanto en el asunto como en el cuerpo con la sintaxis {{variable}}.
 */
export const AUTOMATION_VARIABLES = {
  nombre:  'Nombre del usuario',
  email:   'Email del usuario',
  mascota: 'Nombre de la mascota (mascota recuperada / adopción)',
  codigo:  'Código de recuperación (recuperación de contraseña)',
  plan:    'Plan de suscripción (suscripciones)',
  dias:    'Días restantes / de inactividad',
  empresa: 'Nombre comercial (registro de empresa)',
};

function interpolate(text, vars) {
  return String(text || '').replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => (vars[key] ?? ''));
}

function createTransport() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.MAIL_USERNAME, pass: process.env.MAIL_PASSWORD },
  });
}

/**
 * Renderiza y envía el email de una automatización a un destinatario.
 * Usado directamente (delay 0) o desde el job `send_automation_email` (delay > 0).
 */
export async function sendAutomationEmailNow({ automationId, to, vars = {} }) {
  const automation = await EmailAutomation.findById(automationId).populate('template');
  if (!automation || !automation.active || !automation.template) return false;

  const template = automation.template;
  const rendered = {
    ...template.toObject(),
    subject:  interpolate(template.subject, vars),
    bodyHtml: interpolate(template.bodyHtml, vars),
    footerText: interpolate(template.footerText, vars),
  };

  const html = buildEmailHtml(rendered);
  await createTransport().sendMail({
    from: `"Petnder" <${process.env.MAIL_USERNAME}>`,
    to,
    subject: rendered.subject,
    html,
  });

  await EmailAutomation.findByIdAndUpdate(automationId, { $inc: { sentCount: 1 } });
  return true;
}

/**
 * Dispara todas las automatizaciones activas de un evento para un usuario.
 *
 * @param {string} event   Evento (ver enum en models/EmailAutomation.js)
 * @param {object} user    Debe tener `email`; se usan `firstName`, `commercialName` si existen
 * @param {object} extra   Variables adicionales ({ mascota, codigo, plan, dias, ... })
 * @returns {Promise<number>} Cantidad de automatizaciones ejecutadas o programadas.
 *          Si devuelve 0, el llamador puede aplicar su email por defecto.
 */
export async function triggerEmailAutomation(event, user, extra = {}) {
  try {
    if (!user?.email) return 0;

    const automations = await EmailAutomation.find({ event, active: true }).select('_id delayMinutes').lean();
    if (!automations.length) return 0;

    const vars = {
      nombre:  user.firstName || user.username || '',
      email:   user.email,
      empresa: user.commercialName || '',
      ...extra,
    };

    let count = 0;
    for (const automation of automations) {
      const delay = Number(automation.delayMinutes) || 0;
      if (delay > 0) {
        // Import dinámico para evitar dependencia circular con config/agenda.js
        const { default: agenda } = await import('../config/agenda.js');
        await agenda.schedule(`in ${delay} minutes`, 'send_automation_email', {
          automationId: String(automation._id),
          to: user.email,
          vars,
        });
        count++;
      } else {
        try {
          const ok = await sendAutomationEmailNow({ automationId: automation._id, to: user.email, vars });
          if (ok) count++;
        } catch (err) {
          console.error(`Error enviando automatización ${event} a ${user.email}:`, err.message);
        }
      }
    }
    return count;
  } catch (err) {
    console.error(`Error disparando automatización ${event}:`, err.message);
    return 0;
  }
}

/**
 * Helper para verificar si hay automatización activa para un evento
 * (permite decidir si mostrar/enviar el email hardcodeado de respaldo).
 */
export async function hasActiveAutomation(event) {
  return (await EmailAutomation.countDocuments({ event, active: true })) > 0;
}
