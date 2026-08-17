// ─── Estado del Panel y Pestañas ──────────────────────────────────────────────
let viewMode = localStorage.getItem('viewMode') || 'grid'; // 'grid' | 'list'
let showStats = localStorage.getItem('showStats') !== 'false'; // default true
let isRefreshing = false;
let activeTab = 'tab-monitoreo';

// Configuración cargada del servidor
let configImpresoras = null; // Estructura de printers.json


// Elementos del DOM - Monitoreo
const toggleStatsBtn = document.getElementById('toggle-stats-btn');
const statsBtnText = document.getElementById('stats-btn-text');
const statsPanel = document.getElementById('stats-panel');
const toggleViewBtn = document.getElementById('toggle-view-btn');
const viewBtnText = document.getElementById('view-btn-text');
const viewIcon = document.getElementById('view-icon');
const refreshBtn = document.getElementById('refresh-btn');
const printersContainer = document.getElementById('printers-container');
const lastUpdateSpan = document.getElementById('last-update');

// Elementos del DOM - Pestañas
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// Elementos del DOM - Modales y Formularios
const printerModal = document.getElementById('printer-modal');
const addPrinterBtn = document.getElementById('add-printer-btn');
const closePrinterModal = document.getElementById('close-printer-modal');
const cancelPrinterBtn = document.getElementById('cancel-printer-btn');
const printerForm = document.getElementById('printer-form');



// SVGs auxiliares
const copySvgHTML = document.getElementById('svg-copy').outerHTML;
const checkSvgHTML = document.getElementById('svg-check').outerHTML;
const dropletSvgHTML = document.getElementById('svg-droplet').outerHTML;
const paperSvgHTML = document.getElementById('svg-paper').outerHTML;
const alertSvgHTML = document.getElementById('svg-alert').outerHTML;

// Icono para botón cambiar vista
const gridIconSVG = `<rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect>`;
const listIconSVG = `<line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line>`;

// ─── Inicialización y Navegación entre Pestañas ─────────────────────────────

function initLayout() {
    // Stats Panel
    if (showStats) {
        statsPanel.classList.remove('collapsed');
        statsBtnText.textContent = "Ocultar Resumen";
    } else {
        statsPanel.classList.add('collapsed');
        statsBtnText.textContent = "Ver Resumen";
    }

    // View Mode
    updateViewToggleElements();
    
    // Configurar Navegación de Tabs
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active-content'));
            
            btn.classList.add('active');
            document.getElementById(targetTab).classList.add('active-content');
            activeTab = targetTab;
            
            if (targetTab === 'tab-impresoras') {
                cargarConfigImpresoras();
            } else if (targetTab === 'tab-monitoreo') {
                updateDashboard();
            }
        });
    });

    // Configurar Modales
    setupModalEvents();
}

function updateViewToggleElements() {
    if (viewMode === 'grid') {
        viewIcon.innerHTML = listIconSVG;
        viewBtnText.textContent = "Vista: Lista";
    } else {
        viewIcon.innerHTML = gridIconSVG;
        viewBtnText.textContent = "Vista: Tarjetas";
    }
}

// ─── Eventos del Dashboard de Monitoreo ─────────────────────────────────────

toggleStatsBtn.addEventListener('click', () => {
    showStats = !showStats;
    localStorage.setItem('showStats', showStats);
    
    if (showStats) {
        statsPanel.classList.remove('collapsed');
        statsBtnText.textContent = "Ocultar Resumen";
    } else {
        statsPanel.classList.add('collapsed');
        statsBtnText.textContent = "Ver Resumen";
    }
});

toggleViewBtn.addEventListener('click', () => {
    viewMode = (viewMode === 'grid') ? 'list' : 'grid';
    localStorage.setItem('viewMode', viewMode);
    updateViewToggleElements();
    updateDashboard();
});

refreshBtn.addEventListener('click', async () => {
    if (isRefreshing) return;
    isRefreshing = true;
    refreshBtn.classList.add('spin');

    let previaActualizacion = null;
    try {
        const prev = await (await fetch('/api/datos')).json();
        previaActualizacion = prev.ultima_actualizacion;
    } catch {}

    try { await fetch('/api/refrescar', { method: 'POST' }); } catch {}

    for (let i = 0; i < 6; i++) {
        await new Promise(r => setTimeout(r, 500));
        try {
            const data = await (await fetch('/api/datos')).json();
            if (data.ultima_actualizacion !== previaActualizacion) break;
        } catch {}
    }

    await updateDashboard();
    refreshBtn.classList.remove('spin');
    isRefreshing = false;
});

function triggerRefreshAnimation() {
    isRefreshing = true;
    refreshBtn.classList.add('spin');
    setTimeout(() => {
        refreshBtn.classList.remove('spin');
        isRefreshing = false;
    }, 1000);
}

// ─── Lógica de Utilidades y Render ──────────────────────────────────────────

function getColorClass(pct) {
    if (pct === null || pct === undefined || isNaN(pct)) return 'offline';
    if (pct > 50) return 'good';
    if (pct > 20) return 'warning';
    return 'critical';
}

function copiarIP(ip, button) {
    navigator.clipboard.writeText(ip).then(() => {
        button.innerHTML = checkSvgHTML;
        button.classList.add('success');
        button.setAttribute('title', '¡Copiado!');
        
        setTimeout(() => {
            button.innerHTML = copySvgHTML;
            button.classList.remove('success');
            button.setAttribute('title', 'Copiar Dirección IP');
        }, 1500);
    }).catch(err => {
        console.error('Error al copiar IP: ', err);
    });
}

function parseToner(tonerVal) {
    let pct = 0;
    let text = "N/D";
    let cls = "critical";

    if (tonerVal === "OK") {
        pct = 100;
        text = "OK";
        cls = "good";
    } else if (tonerVal !== null && tonerVal !== undefined && !isNaN(tonerVal)) {
        pct = Number(tonerVal);
        text = pct + "%";
        cls = getColorClass(pct);
    }
    return { pct, text, cls };
}

// ─── Generación de Componentes HTML ──────────────────────────────────────────

function buildCard(ip, info) {
    const card = document.createElement('div');
    card.className = 'card';
    
    const monitorPapel = info.monitorear_papel !== false;
    const monitorToner = info.monitorear_toner !== false;
    
    let isOffline = false;
    if (monitorPapel && info.promedio === null) isOffline = true;
    if (monitorToner && info.toner === null) isOffline = true;
    if (!monitorPapel && !monitorToner) isOffline = false;

    if (isOffline) {
        card.classList.add('offline-card');
    }

    let statusCls = isOffline ? 'offline' : 'online';
    if (!isOffline) {
        const paperLow = monitorPapel && info.promedio !== null && info.promedio < 20;
        const parsedT = parseToner(info.toner);
        const tonerLow = monitorToner && info.toner !== 'OK' && parsedT.pct < 20;
        if (paperLow || tonerLow) statusCls = 'attention';
    }

    let html = `
        <div class="card-header">
            <div class="card-title-group">
                <span class="card-title">${info.nombre}</span>
                <div class="ip-group">
                    <span class="ip-badge">${ip}</span>
                    <button class="copy-ip-btn" onclick="copiarIP('${ip}', this)" title="Copiar Dirección IP">
                        ${copySvgHTML}
                    </button>
                </div>
            </div>
            <span class="status-badge ${statusCls}">
                ${isOffline ? 'Offline' : 'Online'}
            </span>
        </div>
    `;

    if (isOffline) {
        html += `
            <div class="offline-msg">
                <svg class="offline-icon" viewBox="0 0 24 24">
                    <circle cx="12" cy="12" r="10"></circle>
                    <line x1="12" y1="8" x2="12" y2="12"></line>
                    <line x1="12" y1="16" x2="12.01" y2="16"></line>
                </svg>
                <span>Sin conexión o datos no disponibles</span>
            </div>
        `;
    } else {
        if (monitorPapel) {
            const promedioClass = getColorClass(info.promedio);
            html += `
                <div class="stat-group">
                    <div class="stat-header">
                        <span class="stat-label">
                            ${paperSvgHTML}
                            Promedio Papel
                        </span>
                        <span class="stat-value ${promedioClass}">${info.promedio !== null ? info.promedio + '%' : 'N/D'}</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill ${promedioClass}" style="width:${info.promedio !== null ? info.promedio : 0}%"></div>
                    </div>
                </div>
            `;
            
            if (info.detalle && info.detalle.length > 0) {
                html += `<ul class="detalle-list">`;
                info.detalle.forEach(bandeja => {
                    const cls = getColorClass(bandeja.pct);
                    html += `
                        <li class="detalle-item" title="${bandeja.bandeja}: ${bandeja.pct}%">
                            <span class="tray-name">${bandeja.bandeja}</span>
                            <span class="tray-pct ${cls}">${bandeja.pct}%</span>
                        </li>
                    `;
                });
                html += `</ul>`;
            }
        } else {
            html += `
                <div class="stat-group">
                    <div class="stat-header">
                        <span class="stat-label">
                            ${paperSvgHTML}
                            Nivel Papel
                        </span>
                        <span class="stat-value text-muted" style="background:none;">Desactivado</span>
                    </div>
                </div>
            `;
        }

        if (monitorToner) {
            const tonerData = parseToner(info.toner);
            html += `
                <div class="stat-group" style="margin-top: ${monitorPapel ? '18px' : '0'};">
                    <div class="stat-header">
                        <span class="stat-label">
                            ${dropletSvgHTML}
                            Tóner
                        </span>
                        <span class="stat-value ${tonerData.cls}">${tonerData.text}</span>
                    </div>
                    <div class="bar-container">
                        <div class="bar-fill ${tonerData.cls}" style="width:${tonerData.pct}%"></div>
                    </div>
                </div>
            `;
        } else {
            html += `
                <div class="stat-group" style="margin-top: ${monitorPapel ? '18px' : '0'};">
                    <div class="stat-header">
                        <span class="stat-label">
                            ${dropletSvgHTML}
                            Tóner
                        </span>
                        <span class="stat-value text-muted" style="background:none;">Desactivado</span>
                    </div>
                </div>
            `;
        }
    }

    card.innerHTML = html;
    return card;
}

function buildRow(ip, info) {
    const row = document.createElement('div');
    row.className = 'table-row';
    
    const monitorPapel = info.monitorear_papel !== false;
    const monitorToner = info.monitorear_toner !== false;
    
    let isOffline = false;
    if (monitorPapel && info.promedio === null) isOffline = true;
    if (monitorToner && info.toner === null) isOffline = true;
    if (!monitorPapel && !monitorToner) isOffline = false;

    if (isOffline) {
        row.classList.add('offline-row');
    }

    let cellName = `<div class="table-cell printer-name" data-label="Impresora">${info.nombre}</div>`;
    
    let cellIp = `
        <div class="table-cell" data-label="IP">
            <div class="ip-group">
                <span class="ip-badge">${ip}</span>
                <button class="copy-ip-btn" onclick="copiarIP('${ip}', this)" title="Copiar Dirección IP">
                    ${copySvgHTML}
                </button>
            </div>
        </div>
    `;

    let statusCls = isOffline ? 'offline' : 'online';
    if (!isOffline) {
        const paperLow = monitorPapel && info.promedio !== null && info.promedio < 20;
        const parsedT = parseToner(info.toner);
        const tonerLow = monitorToner && info.toner !== 'OK' && parsedT.pct < 20;
        if (paperLow || tonerLow) statusCls = 'attention';
    }

    let cellStatus = `
        <div class="table-cell" data-label="Estado">
            <span class="status-badge ${statusCls}">
                ${isOffline ? 'Offline' : 'Online'}
            </span>
        </div>
    `;

    let cellToner = `<div class="table-cell" data-label="Tóner"><span class="text-muted">—</span></div>`;
    let cellPaper = `<div class="table-cell" data-label="Papel"><span class="text-muted">—</span></div>`;
    let cellTrays = `<div class="table-cell table-cell-trays" data-label="Bandejas"><span class="text-muted" style="font-size:0.75rem;">—</span></div>`;

    if (!isOffline) {
        if (monitorToner) {
            const tonerData = parseToner(info.toner);
            cellToner = `
                <div class="table-cell" data-label="Tóner">
                    <div class="bar-container">
                        <div class="bar-fill ${tonerData.cls}" style="width:${tonerData.pct}%"></div>
                    </div>
                    <span class="stat-value ${tonerData.cls}">${tonerData.text}</span>
                </div>
            `;
        } else {
            cellToner = `<div class="table-cell" data-label="Tóner"><span class="text-muted" style="font-size:0.75rem;">Desactivado</span></div>`;
        }

        if (monitorPapel) {
            const promedioClass = getColorClass(info.promedio);
            cellPaper = `
                <div class="table-cell" data-label="Papel">
                    <div class="bar-container">
                        <div class="bar-fill ${promedioClass}" style="width:${info.promedio !== null ? info.promedio : 0}%"></div>
                    </div>
                    <span class="stat-value ${promedioClass}">${info.promedio !== null ? info.promedio + '%' : 'N/D'}</span>
                </div>
            `;

            if (info.detalle && info.detalle.length > 0) {
                let trayBadges = '';
                info.detalle.forEach(bandeja => {
                    const cls = getColorClass(bandeja.pct);
                    const shortName = bandeja.bandeja.replace(/Depósito\s*/i, 'D');
                    trayBadges += `<span class="table-tray-badge ${cls}" title="${bandeja.bandeja}: ${bandeja.pct}%">${shortName}:${bandeja.pct}%</span>`;
                });
                cellTrays = `
                    <div class="table-cell table-cell-trays" data-label="Bandejas">
                        <div class="table-trays-summary">
                            ${trayBadges}
                        </div>
                    </div>
                `;
            }
        } else {
            cellPaper = `<div class="table-cell" data-label="Papel"><span class="text-muted" style="font-size:0.75rem;">Desactivado</span></div>`;
            cellTrays = `<div class="table-cell table-cell-trays" data-label="Bandejas"><span class="text-muted" style="font-size:0.75rem;">Desactivado</span></div>`;
        }
    } else {
        cellTrays = `
            <div class="table-cell table-cell-trays" data-label="Bandejas">
                <span class="text-muted" style="font-size:0.75rem;">Equipo desconectado</span>
            </div>
        `;
    }

    row.innerHTML = cellName + cellIp + cellStatus + cellToner + cellPaper + cellTrays;
    return row;
}

// ─── Actualización en Tiempo Real del Dashboard ─────────────────────────────

async function updateDashboard() {
    if (activeTab !== 'tab-monitoreo') return;
    try {
        const response = await fetch('/api/datos');
        const data = await response.json();

        let horaMinuto = '';
        if (data.ultima_actualizacion) {
            const timePart = data.ultima_actualizacion.split(' ')[1];
            if (timePart) {
                const parts = timePart.split(':');
                if (parts.length >= 2) {
                    horaMinuto = `${parts[0]}:${parts[1]}`;
                }
            }
        }
        if (!horaMinuto) {
            horaMinuto = data.ultima_actualizacion || 'Sincronizado';
        }

        lastUpdateSpan.classList.remove('error-state');
        lastUpdateSpan.innerHTML = `
            <span>Actualizado: ${horaMinuto}</span>
        `;

        let total = 0;
        let online = 0;
        let offline = 0;
        let attention = 0;

        const printers = Object.entries(data.impresoras).sort((a, b) => {
            return a[1].nombre.localeCompare(b[1].nombre, 'es', { sensitivity: 'base' });
        });
        
        printers.forEach(([ip, info]) => {
            total++;
            const monitorPapel = info.monitorear_papel !== false;
            const monitorToner = info.monitorear_toner !== false;
            
            let isOffline = false;
            if (monitorPapel && info.promedio === null) isOffline = true;
            if (monitorToner && info.toner === null) isOffline = true;
            if (!monitorPapel && !monitorToner) isOffline = false;

            if (isOffline) {
                offline++;
                attention++;
            } else {
                online++;
                const paperLow = monitorPapel && info.promedio !== null && info.promedio < 20;
                const parsedT = parseToner(info.toner);
                const tonerLow = monitorToner && info.toner !== 'OK' && parsedT.pct < 20;
                
                if (paperLow || tonerLow) {
                    attention++;
                }
            }
        });

        document.getElementById('stat-online').textContent = online;
        document.getElementById('stat-offline').textContent = offline;
        document.getElementById('stat-attention').textContent = attention;

        printersContainer.innerHTML = '';

        if (viewMode === 'list') {
            printersContainer.className = 'view-list animate-view';
            
            const headerRow = document.createElement('div');
            headerRow.className = 'table-header';
            headerRow.innerHTML = `
                <div>Impresora</div>
                <div>Dirección IP</div>
                <div>Estado</div>
                <div>Nivel Tóner</div>
                <div>Promedio Papel</div>
                <div class="table-cell-trays">Bandejas de Papel</div>
            `;
            printersContainer.appendChild(headerRow);

            printers.forEach(([ip, info]) => {
                printersContainer.appendChild(buildRow(ip, info));
            });
        } else {
            printersContainer.className = 'view-grid animate-view';
            printers.forEach(([ip, info]) => {
                printersContainer.appendChild(buildCard(ip, info));
            });
        }

    } catch (err) {
        console.error("Error al actualizar panel:", err);
        lastUpdateSpan.classList.add('error-state');
        lastUpdateSpan.innerHTML = `
            <span>Error de conexión</span>
        `;
    }
}

// ─── Pestaña: Gestión de Impresoras (CRUD) ─────────────────────────────────

async function cargarConfigImpresoras() {
    try {
        const response = await fetch('/api/impresoras');
        configImpresoras = await response.json();
        renderConfigImpresoras();
    } catch (err) {
        console.error("Error al cargar configuración de impresoras:", err);
    }
}

function renderConfigImpresoras() {
    const listBody = document.getElementById('printers-config-list');
    listBody.innerHTML = '';
    
    if (!configImpresoras || !configImpresoras.devices) return;
    
    Object.entries(configImpresoras.devices).sort((a, b) => {
        return a[1].nombre.localeCompare(b[1].nombre, 'es', { sensitivity: 'base' });
    }).forEach(([ip, dev]) => {
        const tr = document.createElement('tr');
        
        const monitorPapel = dev.monitorear_papel !== false;
        const monitorToner = dev.monitorear_toner !== false;
        const monitorLabel = [];
        if (monitorPapel) monitorLabel.push('<span class="status-badge online" style="margin-bottom:0;">Papel</span>');
        if (monitorToner) monitorLabel.push('<span class="status-badge online" style="margin-bottom:0; background-color:rgba(56, 189, 248, 0.08); color:#38bdf8; border-color:rgba(56, 189, 248, 0.2);">Tóner</span>');
        if (monitorLabel.length === 0) monitorLabel.push('<span class="status-badge offline" style="margin-bottom:0;">Ninguno</span>');

        tr.innerHTML = `
            <td style="font-weight: 600;">${dev.nombre}</td>
            <td style="font-family: var(--font-mono); font-size: 0.85rem;">${ip}</td>

            <td>
                <div style="display:flex; gap:6px;">${monitorLabel.join('')}</div>
            </td>
            <td style="text-align: right;">
                <button class="btn-action edit" onclick="editarImpresora('${ip}')" title="Editar Impresora">
                    <svg viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4Z"></path></svg>
                </button>
                <button class="btn-action delete" onclick="eliminarImpresora('${ip}')" title="Eliminar Impresora">
                    <svg viewBox="0 0 24 24"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </td>
        `;
        listBody.appendChild(tr);
    });
}

window.editarImpresora = function(ip) {
    if (!configImpresoras || !configImpresoras.devices[ip]) return;
    const dev = configImpresoras.devices[ip];
    
    document.getElementById('printer-original-ip').value = ip;
    document.getElementById('printer-ip').value = ip;
    document.getElementById('printer-name').value = dev.nombre;

    document.getElementById('printer-monitor-paper').checked = dev.monitorear_papel !== false;
    document.getElementById('printer-monitor-toner').checked = dev.monitorear_toner !== false;
    
    document.getElementById('printer-modal-title').textContent = "Editar Impresora";
    abrirModal(printerModal);
};

window.eliminarImpresora = async function(ip) {
    if (!confirm(`¿Estás seguro de que deseas eliminar la impresora "${configImpresoras.devices[ip].nombre}" (${ip})?`)) return;
    
    delete configImpresoras.devices[ip];
    await guardarConfigImpresoras();
};

async function guardarConfigImpresoras() {
    try {
        const response = await fetch('/api/impresoras', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(configImpresoras)
        });
        
        if (response.ok) {
            cargarConfigImpresoras();
            showToast('Cambios guardados');
        } else {
            showToast('Error al guardar la configuración', 'error');
        }
    } catch (err) {
        console.error("Error al guardar impresoras:", err);
    }
}




// ─── Control de Modales (Eventos y Lógica) ──────────────────────────────────

function abrirModal(modal) {
    modal.classList.add('active-modal');
}

function cerrarModal(modal) {
    modal.classList.remove('active-modal');
}

function setupModalEvents() {
    // Abrir Modal Impresoras (Agregar)
    addPrinterBtn.addEventListener('click', () => {
        printerForm.reset();
        document.getElementById('printer-original-ip').value = '';
        document.getElementById('printer-modal-title').textContent = "Agregar Impresora";
        abrirModal(printerModal);
    });

    // Cerrar Modal Impresoras
    closePrinterModal.addEventListener('click', () => cerrarModal(printerModal));
    cancelPrinterBtn.addEventListener('click', () => cerrarModal(printerModal));

    // Guardar Formulario Impresora
    printerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const originalIp = document.getElementById('printer-original-ip').value;
        const newIp = document.getElementById('printer-ip').value.trim();
        const name = document.getElementById('printer-name').value.trim();
        const monitorPaper = document.getElementById('printer-monitor-paper').checked;
        const monitorToner = document.getElementById('printer-monitor-toner').checked;
        if (!configImpresoras) configImpresoras = { community: "public", alerts_threshold_paper: 20, bot_api_url: "http://127.0.0.1:3001/alerta", trays: { "2": "Depósito 1", "3": "Depósito 2", "4": "Depósito 3", "5": "Depósito 4" }, devices: {} };
        
        // Si cambió la IP, eliminar la vieja
        if (originalIp && originalIp !== newIp) {
            delete configImpresoras.devices[originalIp];
        }

        configImpresoras.devices[newIp] = {
            nombre: name,
            monitorear_papel: monitorPaper,
            monitorear_toner: monitorToner
        };

        cerrarModal(printerModal);
        await guardarConfigImpresoras();
    });


    // Cerrar al hacer clic fuera del modal
    window.addEventListener('click', (e) => {
        if (e.target === printerModal) cerrarModal(printerModal);
    });
}

function showToast(mensaje, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;
    toast.textContent = mensaje;
    document.body.appendChild(toast);
    
    // Forzar reflujo para disparar animación
    toast.offsetHeight;
    toast.classList.add('visible');
    
    setTimeout(() => {
        toast.classList.remove('visible');
        toast.addEventListener('transitionend', () => {
            toast.remove();
        });
    }, 3000);
}

// ─── Inicio de Aplicación ──────────────────────────────────────────────────
initLayout();

updateDashboard();

// Intervalo de actualización del dashboard cada 5 segundos
setInterval(updateDashboard, 5000);
