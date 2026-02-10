import SystemNotification from '../models/SystemNotification.js';

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
