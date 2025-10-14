import Notification from '../models/Notification.js';

export default async function createUserNotification(userId, title, text, link, params) {
    const notification = new Notification({
        title,
        text,
        readed: false,
        link: link || null,
        paramsStringify: params ? JSON.stringify(params) : null,
        user: userId,
    });

    await notification.save()
}