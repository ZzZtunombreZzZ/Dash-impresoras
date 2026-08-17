import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const HOST = '127.0.0.1';

const MIME_TYPES = {
    html: 'text/html; charset=utf-8',
    css:  'text/css; charset=utf-8',
    js:   'application/javascript; charset=utf-8',
    json: 'application/json',
    ico:  'image/x-icon',
    png:  'image/png',
    jpg:  'image/jpeg',
    svg:  'image/svg+xml',
    woff: 'font/woff',
    woff2:'font/woff2',
};

const PUBLIC_DIR = path.join(__dirname, 'public');

function serveFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(err.code === 'ENOENT' ? 404 : 500);
            return res.end(err.code === 'ENOENT' ? 'Not found' : 'Server error');
        }
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(data);
    });
}

function readJsonBody(req) {
    return new Promise((resolve, reject) => {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                resolve(JSON.parse(body || '{}'));
            } catch (err) {
                reject(err);
            }
        });
    });
}

const server = http.createServer((req, res) => {
    const url = req.url.split('?')[0];

    if (url === '/' || url === '/index.html') {
        return serveFile(res, path.join(PUBLIC_DIR, 'index.html'), MIME_TYPES.html);
    }



    if (url === '/api/datos') {
        return serveFile(
            res,
            path.join(__dirname, '../../core/storage/printers_state.json'),
            MIME_TYPES.json
        );
    }

    if (url === '/api/impresoras') {
        if (req.method === 'GET') {
            return serveFile(
                res,
                path.join(__dirname, '../../core/config/printers.json'),
                MIME_TYPES.json
            );
        } else if (req.method === 'POST') {
            readJsonBody(req).then(data => {
                fs.writeFile(
                    path.join(__dirname, '../../core/config/printers.json'),
                    JSON.stringify(data, null, 4),
                    'utf8',
                    err => {
                        if (err) {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            return res.end(JSON.stringify({ error: err.message }));
                        }
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ ok: true }));
                    }
                );
            }).catch(err => {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'JSON inválido: ' + err.message }));
            });
            return;
        }
    }

    if (url === '/api/refrescar' && req.method === 'POST') {
        const cfgPath = path.join(__dirname, '../../core/config/printers.json');
        const now = new Date();
        fs.utimes(cfgPath, now, now, err => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'application/json' });
                return res.end(JSON.stringify({ error: err.message }));
            }
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ ok: true }));
        });
        return;
    }


    // Archivos estáticos en la carpeta PUBLIC_DIR
    const ext = path.extname(url).slice(1);
    if (MIME_TYPES[ext]) {
        const safePath = path.join(PUBLIC_DIR, path.normalize(url));
        
        // Evita path traversal
        if (!safePath.startsWith(PUBLIC_DIR)) {
            res.writeHead(403);
            return res.end('Forbidden');
        }
        return serveFile(res, safePath, MIME_TYPES[ext]);
    }

    res.writeHead(404);
    res.end();
});

server.listen(PORT, HOST, () => {
    console.log(`Servidor activo en http://${HOST}:${PORT}`);
});
