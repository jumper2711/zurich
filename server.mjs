import express from 'express';
import session from 'express-session';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = process.env.PORT || 3050; // Render usa su propio puerto

// --- CONFIGURACIÓN DE RUTAS PERSISTENTES ---
// Si estamos en Render, usamos el Disk montado en /data, si no, la carpeta local
const DATA_DIR = process.env.RENDER ? '/data' : path.join(__dirname, 'data');
const UPLOADS_DIR = process.env.RENDER ? '/data/uploads' : path.join(__dirname, 'public/uploads');

// Asegurarnos de que las carpetas existan al arrancar
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
// Servir las imágenes desde el disco persistente en Render
if (process.env.RENDER) {
    app.use('/uploads', express.static('/data/uploads'));
}
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.use(session({
    secret: 'zurich_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, UPLOADS_DIR);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- CONFIG Y USUARIOS ---
const obtenerAdmin = () => {
    const ruta = path.join(DATA_DIR, 'usuarios.json');
    if (!fs.existsSync(ruta)) return { email: "admin@zurich.com", password: "123" };
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
};

const proteger = (req, res, next) => {
    if (req.session.adminId) return next();
    res.redirect('/admin/login.html');
};

app.get('/api/config', (req, res) => {
    const ruta = path.join(DATA_DIR, 'config.json');
    res.json(fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf-8')) : { whatsapp: "5493834773652" });
});

app.post('/api/config', proteger, (req, res) => {
    const { whatsapp, password } = req.body;
    fs.writeFileSync(path.join(DATA_DIR, 'config.json'), JSON.stringify({ whatsapp }, null, 2));
    if (password && password.trim() !== "") {
        fs.writeFileSync(path.join(DATA_DIR, 'usuarios.json'), JSON.stringify({ email: "admin@zurich.com", password }, null, 2));
    }
    res.json({ success: true });
});

// --- API PRODUCTOS ---
app.get('/api/get-productos', (req, res) => {
    const ruta = path.join(DATA_DIR, 'productos.json');
    res.json(fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf-8') || '[]') : []);
});

app.post('/api/productos', proteger, upload.single('imagen'), (req, res) => {
    const ruta = path.join(DATA_DIR, 'productos.json');
    let productos = fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf-8') || '[]') : [];
    
    productos.push({ 
        id: Date.now(), 
        nombre: req.body.nombre, 
        precio: req.body.precio, 
        categoria: req.body.categoria,
        imagen: `/uploads/${req.file.filename}` 
    });
    
    fs.writeFileSync(ruta, JSON.stringify(productos, null, 2));
    res.json({ success: true });
});

app.delete('/api/productos/:id', proteger, (req, res) => {
    const id = parseInt(req.params.id);
    const ruta = path.join(DATA_DIR, 'productos.json');
    let productos = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    const prod = productos.find(p => p.id === id);
    if (prod) {
        const fotoNombre = prod.imagen.split('/').pop();
        const rutaFoto = path.join(UPLOADS_DIR, fotoNombre);
        if (fs.existsSync(rutaFoto)) fs.unlinkSync(rutaFoto);
    }
    fs.writeFileSync(ruta, JSON.stringify(productos.filter(p => p.id !== id), null, 2));
    res.json({ success: true });
});

app.post('/api/login', (req, res) => {
    if (req.body.password === obtenerAdmin().password) {
        req.session.adminId = true;
        return res.json({ success: true });
    }
    res.status(401).json({ success: false });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public/index.html')));
app.get('/admin/dashboard.html', proteger, (req, res) => res.sendFile(path.join(__dirname, 'admin/dashboard.html')));

app.listen(PORT, () => {
    console.log(`\n🚀 ZURICH GOLDEN NIGHT OPERATIVO`);
    console.log(`🌍 En internet: https://zurich-golden-night.onrender.com`);
});