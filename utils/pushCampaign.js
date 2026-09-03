import { Expo } from 'expo-server-sdk';
import User from '../models/User.js';
import Adoption from '../models/Adoption.js';
import FindMe from '../models/FindMe.js';
import Notification from '../models/Notification.js';

const expo = new Expo();

const normalize = (s) =>
  String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim();

/**
 * Construye el filtro de usuarios de una campaña (roles, suscripción, departamentos).
 * Los intereses se resuelven aparte porque cruzan varias colecciones.
 */
export function buildAudienceFilter(campaign) {
  const filter = { deletedAt: null, banned: { $ne: true } };
  if (campaign.targetRoles?.length) {
    const roles = [];
    if (campaign.targetRoles.includes('user')) roles.push('user');
    if (campaign.targetRoles.includes('enterprise')) roles.push('enterprise');
    filter.role = { $in: roles };
  }
  if (campaign.targetSubscriptions?.length) filter.suscription = { $in: campaign.targetSubscriptions };
  if (campaign.targetDepartments?.length) filter.department = { $in: campaign.targetDepartments };
  return filter;
}

/**
 * Devuelve el set de IDs de usuario que coinciden con al menos uno de los intereses.
 * Un interés coincide si:
 *  - está en `User.interests` o `User.preferences` (texto explícito), o
 *  - es la especie de alguna mascota que el usuario publicó (adopción o reporte), o
 *  - es "adopcion" y el usuario publicó al menos una adopción, o
 *  - es "mascota perdida" / "reporte" y el usuario publicó al menos un reporte.
 */
export async function resolveInterestUserIds(interests) {
  const wanted = (interests || []).map(normalize).filter(Boolean);
  if (!wanted.length) return null; // null = sin restricción

  const ids = new Set();
  const add = (id) => id && ids.add(String(id));

  const regexes = wanted.map((w) => new RegExp(`^${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'));

  const explicit = await User.find({
    deletedAt: null,
    $or: [{ interests: { $in: regexes } }, { preferences: { $in: regexes } }],
  }).select('_id').lean();
  explicit.forEach((u) => add(u._id));

  const adoptionQuery = { deletedAt: null, $or: [{ especie: { $in: regexes } }] };
  if (wanted.some((w) => w === 'adopcion' || w === 'adopciones')) adoptionQuery.$or.push({});
  const adoptions = await Adoption.find(adoptionQuery).select('user').lean();
  adoptions.forEach((a) => add(a.user));

  const findMeQuery = { deletedAt: null, $or: [{ especie: { $in: regexes } }] };
  if (wanted.some((w) => ['mascota perdida', 'mascotas perdidas', 'reporte', 'reportes', 'perdidos'].includes(w))) {
    findMeQuery.$or.push({});
  }
  const reports = await FindMe.find(findMeQuery).select('user').lean();
  reports.forEach((r) => add(r.user));

  return ids;
}

/**
 * Envía notificaciones push reales vía Expo a una lista de tokens.
 * Elimina de los usuarios los tokens que Expo reporta como inválidos.
 */
async function sendExpoPush(messages) {
  if (!messages.length) return { sent: 0, invalidTokens: [] };
  const invalidTokens = [];
  let sent = 0;

  const chunks = expo.chunkPushNotifications(messages);
  for (const chunk of chunks) {
    try {
      const tickets = await expo.sendPushNotificationsAsync(chunk);
      tickets.forEach((ticket, i) => {
        if (ticket.status === 'ok') {
          sent++;
        } else if (ticket.details?.error === 'DeviceNotRegistered') {
          invalidTokens.push(chunk[i].to);
        }
      });
    } catch (err) {
      console.error('Error enviando chunk de push:', err.message);
    }
  }

  if (invalidTokens.length) {
    await User.updateMany(
      { 'pushTokens.token': { $in: invalidTokens } },
      { $pull: { pushTokens: { token: { $in: invalidTokens } } } }
    );
  }

  return { sent, invalidTokens };
}

/**
 * Ejecuta una campaña push: resuelve la audiencia, crea las notificaciones in-app
 * y envía el push real a los dispositivos registrados.
 * Usado tanto por el endpoint manual como por el job de campañas programadas.
 */
export async function dispatchPushCampaign(campaign) {
  const filter = buildAudienceFilter(campaign);
  const interestIds = await resolveInterestUserIds(campaign.targetInterests);
  if (interestIds) filter._id = { $in: [...interestIds] };

  const users = await User.find(filter).select('_id pushTokens').lean();

  const notifications = users.map((u) => ({
    title: campaign.title,
    text: campaign.body,
    link: campaign.link || null,
    user: u._id,
    campaign: campaign._id,
    readed: false,
  }));
  if (notifications.length) await Notification.insertMany(notifications);

  const messages = [];
  for (const u of users) {
    for (const t of u.pushTokens || []) {
      if (!Expo.isExpoPushToken(t.token)) continue;
      messages.push({
        to: t.token,
        sound: 'default',
        title: campaign.title,
        body: campaign.body,
        data: { link: campaign.link || null, campaignId: String(campaign._id) },
      });
    }
  }
  const { sent } = await sendExpoPush(messages);

  campaign.status = 'sent';
  campaign.sentAt = new Date();
  campaign.recipientCount = users.length;
  campaign.pushDelivered = sent;
  await campaign.save();

  return { recipients: users.length, pushDelivered: sent };
}

/**
 * Envía un push individual (no de campaña) a un usuario, si tiene tokens.
 * Pensado para reutilizarse desde notificaciones del sistema.
 */
export async function sendPushToUser(userId, { title, body, data = {} }) {
  const user = await User.findById(userId).select('pushTokens').lean();
  if (!user?.pushTokens?.length) return 0;
  const messages = user.pushTokens
    .filter((t) => Expo.isExpoPushToken(t.token))
    .map((t) => ({ to: t.token, sound: 'default', title, body, data }));
  const { sent } = await sendExpoPush(messages);
  return sent;
}
