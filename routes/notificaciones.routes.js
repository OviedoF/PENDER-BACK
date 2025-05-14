// app.js
import express from 'express';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import fs from 'fs';
import path from 'path';
import cors from 'cors';
import seeds from './seeds.js';
import env from './env.js';
import morgan from 'morgan';
import bodyParser from 'body-parser';

dotenv.config();
connectDB();
const publicPath = path.join(env.__dirname, 'public');
seeds();

const app = express();

// Middleware
app.use(cors({
    origin: '*'
}));
app.use(express.json({
    limit: '50mb'
}));

app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', 'Authorization, X-API-KEY, Origin, X-Requested-With, Content-Type, Accept, Access-Control-Allow-Request-Method');
    res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, DELETE');
    res.header('Allow', 'GET, POST, OPTIONS, PUT, DELETE');
    next();
});

// Morgan debe ir antes de las rutas si quieres loguear las peticiones a esas rutas
app.use(morgan('dev'));

// Body parsers también antes de las rutas que los necesiten
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

// Servir archivos estáticos
app.use(express.static(publicPath)); // Si tienes archivos en public/ que no son parte de /api/uploads

// Carga automática de todas las rutas de API
const routeFiles = fs.readdirSync(path.join(env.__dirname, 'routes')).filter((file) => file.endsWith(".js"));

// Usamos Promise.all para asegurar que todas las importaciones se resuelvan antes de continuar
// si fuera necesario, pero para app.use() el orden de registro secuencial es generalmente suficiente.
(async () => {
    for (const file of routeFiles) {
        const routeName = file.split('.')[0];
        try {
            const routeModule = await import(`./routes/${file}`);
            app.use(`/api/${routeName}`, routeModule.default);
            console.log(`Route: /api/${routeName} loaded!`);
        } catch (error) {
            console.error(`Error loading route /api/${routeName} from ${file}:`, error);
        }
    }
})();


export default app;