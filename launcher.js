import { spawn } from 'child_process';
import chalk from 'chalk';

// ─── Configuración de servicios ───────────────────────────────────────────────

const MAX_REINICIOS = 5;
const VENTANA_MS = 10 * 60 * 1000;
const DELAY_MONITOR_MS = 2000;

const SERVICIOS = {
    monitor: {
        nombre: '🖨️  Monitor Impresoras',
        cmd: process.platform === 'win32' ? '.venv\\Scripts\\python.exe' : '.venv/bin/python',
        args: ['src/features/monitor/monitor.py'],
        color: chalk.cyan,
        stdio: ['ignore', 'pipe', 'pipe'],
        estado: 'detenido',
        reinicios: [],
        proceso: null,
    },
    web: {
        nombre: '🌐 Web Panel',
        cmd: process.execPath,
        args: ['src/features/dashboard/server.js'],
        color: chalk.magenta,
        stdio: ['ignore', 'pipe', 'pipe'],
        estado: 'detenido',
        reinicios: [],
        proceso: null,
    },
};

// ─── UI de estado ─────────────────────────────────────────────────────────────

function mostrarEstado() {
    const filas = Object.values(SERVICIOS).map(s => {
        const icono =
            s.estado === 'corriendo' ? chalk.green('●') :
                s.estado === 'reiniciando' ? chalk.yellow('◌') :
                    s.estado === 'fallido' ? chalk.red('✕') :
                        chalk.gray('○');
        return `  ${icono}  ${s.color(s.nombre.padEnd(28))} ${chalk.gray(s.estado)}`;
    });

    console.log(chalk.bold.white('\n  ┌─ Servicios ─────────────────────────────┐'));
    filas.forEach(f => console.log(`  │ ${f}  │`));
    console.log(chalk.bold.white('  └─────────────────────────────────────────┘\n'));
}

function log(id, msg, nivel = 'info') {
    const s = SERVICIOS[id];
    const ts = new Date().toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' });
    const pre = s.color(`[${ts}][${s.nombre}]`);
    if (nivel === 'error') console.error(`${pre} ${chalk.red(msg)}`);
    else if (nivel === 'warn') console.warn(`${pre} ${chalk.yellow(msg)}`);
    else console.log(`${pre} ${msg}`);
}

// ─── Ciclo de vida de servicios ───────────────────────────────────────────────

function iniciarServicio(id) {
    const s = SERVICIOS[id];
    const ahora = Date.now();

    // Limpiar reinicios fuera de la ventana de tiempo
    s.reinicios = s.reinicios.filter(t => ahora - t < VENTANA_MS);

    if (s.reinicios.length >= MAX_REINICIOS) {
        s.estado = 'fallido';
        console.log(chalk.red.bold(
            `\n  ❌ [${s.nombre}] Alcanzó ${MAX_REINICIOS} reinicios en 10 min. Deshabilitado.\n`
        ));
        mostrarEstado();
        return;
    }

    s.estado = 'corriendo';
    s.reinicios.push(ahora);

    const proc = spawn(s.cmd, s.args, {
        stdio: s.stdio,
        shell: false,
    });

    s.proceso = proc;

    // Captura de output para procesos en background
    if (s.stdio !== 'inherit') {
        proc.stdout?.on('data', chunk => {
            chunk.toString().split('\n').filter(Boolean).forEach(linea =>
                console.log(s.color(`  [${s.nombre}] `) + linea)
            );
        });
        proc.stderr?.on('data', chunk => {
            chunk.toString().split('\n').filter(Boolean).forEach(linea =>
                console.error(chalk.yellow(`  [${s.nombre}⚠] `) + linea)
            );
        });
    }

    proc.on('error', err => {
        log(id, `No se pudo iniciar: ${err.message}`, 'error');
        s.estado = 'error';
    });

    proc.on('exit', (code, signal) => {
        // Salida limpia (código 0)
        if (code === 0) {
            s.estado = 'detenido';
            log(id, `Salió limpiamente (código 0). No se reiniciará.`, 'warn');
            return;
        }

        // Crash o desconexión inesperada → reiniciar con backoff exponencial
        const espera = Math.min(1000 * 2 ** s.reinicios.length, 30_000);
        s.estado = 'reiniciando';
        log(id, `Caído (${code ?? signal}). Reiniciando en ${espera / 1000}s...`, 'warn');
        mostrarEstado();
        setTimeout(() => iniciarServicio(id), espera);
    });

    log(id, `Iniciado — PID ${proc.pid}`);
}

// ─── Apagado limpio ───────────────────────────────────────────────────────────

function shutdown() {
    console.log(chalk.red.bold('\n\n  🛑 Apagando todos los servicios...\n'));
    for (const s of Object.values(SERVICIOS)) {
        if (s.proceso && !s.proceso.killed) {
            s.proceso.kill('SIGTERM');
            log(
                Object.keys(SERVICIOS).find(k => SERVICIOS[k] === s),
                'SIGTERM enviado'
            );
        }
    }
    setTimeout(() => process.exit(0), 2000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// ─── Inicio ───────────────────────────────────────────────────────────────────

console.clear();

iniciarServicio('monitor');
iniciarServicio('web');

console.log(chalk.gray('  Ctrl+C para apagar el servicio\n'));

mostrarEstado();

