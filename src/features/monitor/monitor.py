import socket
import time
import schedule
import requests
import sys
import json
import os
from datetime import datetime
from concurrent.futures import ThreadPoolExecutor

# Cargar configuraciones centralizadas
base_dir = os.path.dirname(os.path.abspath(__file__))
config_path = os.path.abspath(os.path.join(base_dir, "..", "..", "core", "config", "printers.json"))
storage_path = os.path.abspath(os.path.join(base_dir, "..", "..", "core", "storage", "printers_state.json"))

try:
    with open(config_path, "r", encoding="utf-8") as f:
        config = json.load(f)
except Exception as e:
    print(f"❌ Error al cargar configuración printers.json: {e}")
    sys.exit(1)

COMMUNITY = config.get("community", "public")
UMBRAL_ALERTA = config.get("alerts_threshold_paper", 20)

# Convertir claves de bandejas a enteros
TRAY_NAMES = {int(k): v for k, v in config.get("trays", {}).items()}

# Mapear dispositivos y alias
PRINTERS = {ip: dev["nombre"] for ip, dev in config.get("devices", {}).items()}
PRINTER_ALIASES = {ip: dev["aliases"] for ip, dev in config.get("devices", {}).items()}

OID_CAP       = "1.3.6.1.2.1.43.8.2.1.9.1."
OID_LEVEL     = "1.3.6.1.2.1.43.8.2.1.10.1."
OID_TONER_CAP   = "1.3.6.1.2.1.43.11.1.1.8.1.1"
OID_TONER_LEVEL = "1.3.6.1.2.1.43.11.1.1.9.1.1"

impresoras_alertadas = set()


def snmp_get_int(ip, oid_str):
    oid_parts = [int(x) for x in oid_str.split('.') if x]
    oid_enc = bytes([40 * oid_parts[0] + oid_parts[1]])
    for p in oid_parts[2:]:
        if p == 0:
            oid_enc += b'\x00'
        else:
            enc = []
            while p:
                enc.append(p & 0x7f)
                p >>= 7
            enc.reverse()
            for i, b in enumerate(enc):
                oid_enc += bytes([b | (0x80 if i < len(enc) - 1 else 0)])
    comm    = COMMUNITY.encode()
    oid_tlv = b'\x06' + bytes([len(oid_enc)]) + oid_enc
    vb      = b'\x30' + bytes([len(oid_tlv) + 2]) + oid_tlv + b'\x05\x00'
    vbl     = b'\x30' + bytes([len(vb)]) + vb
    pdu     = b'\xa0' + bytes([len(vbl) + 9]) + b'\x02\x01\x01\x02\x01\x00\x02\x01\x00' + vbl
    msg     = b'\x02\x01\x00' + b'\x04' + bytes([len(comm)]) + comm + pdu
    pkt     = b'\x30' + bytes([len(msg)]) + msg
    sock    = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    sock.settimeout(0.5)
    try:
        sock.sendto(pkt, (ip, 161))
        data, _ = sock.recvfrom(4096)
        oid_pos = data.find(oid_enc)
        if oid_pos == -1:
            return None
        vs      = oid_pos + len(oid_enc)
        vt, vl  = data[vs], data[vs + 1]
        vb      = data[vs + 2: vs + 2 + vl]
        if vt in (0x02, 0x41, 0x42):
            return int.from_bytes(vb, 'big', signed=(vt == 0x02))
        return None
    except Exception:
        return None
    finally:
        sock.close()


def guardar_estado(datos):
    """Guarda la información de las impresoras ordenadas en la capa de storage de core"""
    try:
        dir_name = os.path.dirname(storage_path)
        if not os.path.exists(dir_name):
            os.makedirs(dir_name)
            
        data_final = {
            "ultima_actualizacion": datetime.now().strftime('%d/%m/%Y %H:%M:%S'),
            "impresoras": datos
        }
        
        with open(storage_path, "w", encoding="utf-8") as f:
            json.dump(data_final, f, indent=4, ensure_ascii=False)
            
    except Exception as e:
        print(f"❌ Error al guardar el JSON del estado en storage: {e}")


def obtener_estado_impresoras():
    resultado = {}
    global config, PRINTERS, PRINTER_ALIASES
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config = json.load(f)
        PRINTERS = {ip: dev["nombre"] for ip, dev in config.get("devices", {}).items()}
        PRINTER_ALIASES = {ip: dev["aliases"] for ip, dev in config.get("devices", {}).items()}
    except Exception as e:
        print(f"❌ Error al recargar config en monitor: {e}")

    DEVICES = config.get("devices", {})

    queries = [] # list of tuples: (ip, qtype, key, oid)
    
    for ip, nombre in PRINTERS.items():
        dev_conf = DEVICES.get(ip, {})
        monitorear_papel = dev_conf.get("monitorear_papel", True)
        monitorear_toner = dev_conf.get("monitorear_toner", True)
        
        # Inicializar estructura de resultado
        resultado[ip] = {
            "nombre": nombre, 
            "promedio": None, 
            "detalle": [],
            "toner": None,
            "monitorear_papel": monitorear_papel,
            "monitorear_toner": monitorear_toner
        }
        
        if monitorear_papel:
            for tray_idx in TRAY_NAMES.keys():
                queries.append((ip, 'paper_cap', tray_idx, OID_CAP + str(tray_idx)))
                queries.append((ip, 'paper_level', tray_idx, OID_LEVEL + str(tray_idx)))
                
        if monitorear_toner:
            queries.append((ip, 'toner_cap', None, OID_TONER_CAP))
            queries.append((ip, 'toner_level', None, OID_TONER_LEVEL))

    # Ejecutar peticiones SNMP en paralelo
    temp_data = {ip: {"bandejas_raw": {}, "toner_cap": None, "toner_level": None} for ip in PRINTERS}
    
    if queries:
        with ThreadPoolExecutor(max_workers=max(len(queries), 1)) as executor:
            future_to_query = {
                executor.submit(snmp_get_int, ip, oid): (ip, qtype, key)
                for ip, qtype, key, oid in queries
            }
            
            for future in future_to_query:
                ip, qtype, key = future_to_query[future]
                try:
                    val = future.result()
                except Exception:
                    val = None
                    
                if val is not None:
                    if qtype == 'paper_cap':
                        if key not in temp_data[ip]["bandejas_raw"]: 
                            temp_data[ip]["bandejas_raw"][key] = {}
                        temp_data[ip]["bandejas_raw"][key]["cap"] = val
                    elif qtype == 'paper_level':
                        if key not in temp_data[ip]["bandejas_raw"]: 
                            temp_data[ip]["bandejas_raw"][key] = {}
                        temp_data[ip]["bandejas_raw"][key]["level"] = val
                    elif qtype == 'toner_cap':
                        temp_data[ip]["toner_cap"] = val
                    elif qtype == 'toner_level':
                        temp_data[ip]["toner_level"] = val

    # Procesar resultados finales
    for ip, info in resultado.items():
        t_data = temp_data.get(ip, {})
        
        # 1. Procesar bandejas
        if info["monitorear_papel"]:
            bandejas_pct = []
            detalle = []
            for tray_idx, tray_name in TRAY_NAMES.items():
                raw = t_data["bandejas_raw"].get(tray_idx, {})
                cap = raw.get("cap")
                level = raw.get("level")
                if cap and cap > 0 and level is not None and level >= 0:
                    pct = round(level / cap * 100)
                    bandejas_pct.append(pct)
                    detalle.append({"bandeja": tray_name, "pct": pct})
            
            info["detalle"] = detalle
            info["promedio"] = round(sum(bandejas_pct) / len(bandejas_pct)) if bandejas_pct else None
            
        # 2. Procesar tóner
        if info["monitorear_toner"]:
            t_cap = t_data.get("toner_cap")
            t_level = t_data.get("toner_level")
            
            if t_cap and t_cap > 0 and t_level is not None and t_level >= 0:
                info["toner"] = round(t_level / t_cap * 100)
            elif t_level == -3:
                info["toner"] = "OK"
            else:
                info["toner"] = None

    guardar_estado(resultado)
    return resultado



def revisar_impresoras():
    hora   = datetime.now().strftime('%d/%m/%Y %H:%M')
    estado = obtener_estado_impresoras()
    print(f"\n[{hora}] Revisando impresoras...")

    for ip, data in estado.items():
        nombre   = data["nombre"]
        promedio = data["promedio"]
        detalle  = data["detalle"]
        toner    = data.get("toner")
        monitorear_papel = data.get("monitorear_papel", True)
        monitorear_toner = data.get("monitorear_toner", True)

        if not monitorear_papel and not monitorear_toner:
            print(f"  {nombre}: monitoreo desactivado por completo")
            continue

        if monitorear_papel and promedio is None:
            print(f"  {nombre}: sin respuesta")
            continue

        papel_str = f"{promedio}%" if monitorear_papel else "Desactivado"
        toner_str = f"{toner}%" if (monitorear_toner and toner is not None) else ("Desactivado" if not monitorear_toner else "Sin Datos")
        print(f"  {nombre}: Papel {papel_str} | Tóner: {toner_str}")

        if monitorear_papel and promedio is not None and promedio < UMBRAL_ALERTA:
            if ip not in impresoras_alertadas:
                print(f"  ⚠️ {nombre} alcanzó el nivel de alerta ({promedio}%).")
                impresoras_alertadas.add(ip)
        else:
            if ip in impresoras_alertadas:
                print(f"  ✅ {nombre} recuperado ({promedio}%), alertas reactivadas")
                impresoras_alertadas.discard(ip)


# ─── Modo monitor (ejecución normal vía launcher) ─────────────────────────────

revisar_impresoras()
schedule.every(10).minutes.do(revisar_impresoras)
print(f"\nMonitor activo. Revisando cada 10 min...\n")

while True:
    schedule.run_pending()
    time.sleep(1)
