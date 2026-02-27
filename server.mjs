import express from 'express';
import session from 'express-session';
import fs from 'node:fs';
import path from 'node:path';
import multer from 'multer';
import { fileURLToPath } from 'node:url';

const app = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PORT = 3050;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/admin', express.static(path.join(__dirname, 'admin')));

app.use(session({
    secret: 'zurich_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 3600000 }
}));

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, 'public/uploads/');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => {
        cb(null, Date.now() + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

// --- CONFIG Y USUARIOS ---
const obtenerAdmin = () => {
    const ruta = path.join(__dirname, 'data/usuarios.json');
    if (!fs.existsSync(ruta)) return { email: "admin@zurich.com", password: "123" };
    return JSON.parse(fs.readFileSync(ruta, 'utf-8'));
};

const proteger = (req, res, next) => {
    if (req.session.adminId) return next();
    res.redirect('/admin/login.html');
};

app.get('/api/config', (req, res) => {
    const ruta = path.join(__dirname, 'data/config.json');
    res.json(fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf-8')) : { whatsapp: "5493834773652" });
});

app.post('/api/config', proteger, (req, res) => {
    const { whatsapp, password } = req.body;
    const rutaData = path.join(__dirname, 'data');
    if (!fs.existsSync(rutaData)) fs.mkdirSync(rutaData);
    fs.writeFileSync(path.join(rutaData, 'config.json'), JSON.stringify({ whatsapp }, null, 2));
    if (password && password.trim() !== "") {
        fs.writeFileSync(path.join(rutaData, 'usuarios.json'), JSON.stringify({ email: "admin@zurich.com", password }, null, 2));
    }
    res.json({ success: true });
});

// --- API PRODUCTOS (CON CATEGORÍA) ---
app.get('/api/get-productos', (req, res) => {
    const ruta = path.join(__dirname, 'data/productos.json');
    res.json(fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf-8') || '[]') : []);
});

app.post('/api/productos', proteger, upload.single('imagen'), (req, res) => {
    const ruta = path.join(__dirname, 'data/productos.json');
    let productos = fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf-8') || '[]') : [];
    
    // Guardamos: nombre, precio, categoría e imagen
    productos.push({ 
        id: Date.now(), 
        nombre: req.body.nombre, 
        precio: req.body.precio, 
        categoria: req.body.categoria, // <--- NUEVO
        imagen: `/uploads/${req.file.filename}` 
    });
    
    fs.writeFileSync(ruta, JSON.stringify(productos, null, 2));
    res.json({ success: true });
});

app.delete('/api/productos/:id', proteger, (req, res) => {
    const id = parseInt(req.params.id);
    const ruta = path.join(__dirname, 'data/productos.json');
    let productos = JSON.parse(fs.readFileSync(ruta, 'utf-8'));
    const prod = productos.find(p => p.id === id);
    if (prod && fs.existsSync(path.join(__dirname, 'public', prod.imagen))) {
        fs.unlinkSync(path.join(__dirname, 'public', prod.imagen));
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
    console.log(`🏠 Catálogo: http://localhost:${PORT}`);
    console.log(`🔐 Admin: http://localhost:${PORT}/admin/login.html`);
});