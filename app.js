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

app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({extended:false}))
app.use(express.static(publicPath));

const routeFiles = fs.readdirSync(path.join(env.__dirname, 'routes')).filter( (file) => file.endsWith(".js") );

routeFiles.forEach( async (file) => {
    app.use(`/api/${file.split('.')[0]}`, (await import(`./routes/${file}`)).default);
    console.log(`Route: /api/${file.split('.')[0]} loaded!` );
});

export default app;
