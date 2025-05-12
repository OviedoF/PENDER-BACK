import multer from 'multer';
import path from 'path';
import env from '../env.js';

const storage = multer.diskStorage({
    destination: path.join(env.__dirname, 'public', 'api', 'uploads'),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname);
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});

const upload = multer({ storage });

export default upload;