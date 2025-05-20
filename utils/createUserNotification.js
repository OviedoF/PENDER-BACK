import Notification from '../models/Notification.js';

export default async function createUserNotification(userId, title, text, link) {
    const notification = new Notification({
        title,
        text,
        readed: false,
        link: link || null,
        user: userId,
    });

    await notification.save()
}