# 📱 QR Iorana Dev

**Generador de códigos QR - Next.js**

---

## 📌 INSTRUCCIÓN INICIAL

> **Claude:** Al abrir esta sesión, SIEMPRE muestra el menú de opciones de abajo. Espera que el usuario seleccione una opción (número 1-10) y ejecuta la acción correspondiente. No hagas nada más hasta que seleccione.

---

## INSTRUCCIÓN: Si el usuario escribe "menu", muestra el menú

Si el usuario escribe exactamente `menu`, `Menu`, `MENU` o `/menu`, MUESTRA el menú y ESPERA selección.

## ¿Qué te gustaría hacer?

1 Crear/personalizar QR
2 Hacer cambios de diseño
3 Mejorar performance
4 Revisar tracking
5 Debuggear un problema
6 Gestionar estilos/plantillas
7 Compilar para producción
8 Revisar analíticas
10 Ver status del proyecto (stack, entorno, TODOs)
9 Otra cosa específica

---

## Arranque Rápido

Instalar dependencias: `pnpm install`
Iniciar dev server: `pnpm run dev`

**Acceso:** http://localhost:3007

---

## Archivos Importantes

- src/pages/ - Páginas principales
- src/components/ - Componentes QR
- src/lib/ - Lógica de generación
- package.json - Dependencias
- .env.local - Configuración

## Stack Técnico

- Next.js
- React
- TypeScript
- Tailwind CSS
- QR Library (qrcode.react u otra)

---

## Comandos Útiles

**Dev:** `pnpm run dev`
**Build:** `pnpm run build`
**Start:** `pnpm start`
**Lint:** `pnpm run lint`
**Type check:** `tsc --noEmit`

---

**Necesitas ayuda?** Dime el número y arrancamos.

8 Tipo: Herramienta
9 Estado: En desarrollo

10 Archivos principales
11 Configuración
12 Base de datos (si aplica)
13 Documentación

14 Servidor/hosting
15 Base de datos
16 Caché

---

**Necesitas ayuda?** Dime el número y arrancamos.
---

## PROTOCOLO GLOBAL: Almacenamiento de Archivos Generados

REGLA ABSOLUTA: Todos los archivos generados van en docs/[tipo]/ del proyecto.

Si docs/ no existe, se crea automaticamente con estructura:
- docs/instructions/ (Instrucciones, README)
- docs/database/ (SQL migrations, schemas)
- docs/analysis/ (Audits, reports)
- docs/api/ (OpenAPI specs)
- docs/architecture/ (Diagramas)
- docs/deployment/ (Deploy, Docker)
- docs/generated/ (Otros)

Confirmacion: Se reportara - Guardado en: docs/[tipo]/[archivo]

Documentacion: E:\git\app\PROTOCOLO-GLOBAL-ARCHIVOS.md

---
---

## INSTRUCCION CRITICA: Leer Master.env al iniciar servidores

OBLIGATORIO cada vez que inicie servidores:

1. LEER E:\master.env (PRIMERO - OBLIGATORIO)
2. EXTRAER puertos: [PROYECTO]_FRONTEND_PORT, [PROYECTO]_BACKEND_PORT
3. VERIFICAR: . E:\scripts\verify-ports.ps1
4. REUTILIZAR procesos existentes (NO reiniciar)
5. INICIAR solo los faltantes
6. USAR puerto EXACTO de master.env (NO automatico)

Puertos en master.env (2026-06-10):
- 3000 (main), 3002 (io-semantico-front), 3003 (io-neruda-front)
- 3004 (io-prospector-front), 4000 (io-semantico-back)
- 4005 (io-neruda-back), 4006 (io-prospector-back)
- 5000 (io-semantico-python), 6379 (redis)

Documentacion: E:\git\app\INSTRUCCION-LEER-MASTER-ENV.md

---
---

## INSTRUCCION: Crear Nuevo Proyecto (con CLAUDE.md)

Cada nuevo proyecto DEBE incluir CLAUDE.md desde el inicio.

CHECKLIST para nuevo proyecto:
[ ] Carpeta creada: E:\git\app\[TIPO]\[NOMBRE]
[ ] CLAUDE.md creado con instrucciones globales
[ ] Puertos agregados a E:\master.env
[ ] Estructura docs/ creada
[ ] Agregado a pnpm-workspace.yaml
[ ] pnpm install sin errores
[ ] tsc --noEmit sin errores

Documentacion completa: E:\git\app\INSTRUCCION-CREAR-NUEVO-PROYECTO.md

---
---

## INSTRUCCION: Archivos de Configuracion para Nuevo Proyecto

Despues de crear estructura base, necesitas estos 10 archivos:

OBLIGATORIOS:
- .gitignore (Ignorar node_modules, .env.local, dist, etc)
- .env.example (Template sin valores reales)
- .env.local (Desarrollo local - NO versionado)
- next.config.js (Si es Next.js)
- tailwind.config.js (Si usa Tailwind)
- .eslintrc.json (Linting rules)
- prettier.config.js (Formato codigo)
- tsconfig.json (TypeScript config)
- README.md (Documentacion basica)
- src/ (Estructura de codigo)

OPCIONAL:
- .github/workflows/ci.yml (GitHub Actions)

Documentacion completa: E:\git\app\INSTRUCCION-ARCHIVOS-CONFIGURACION-PROYECTO.md

---
---

## INSTRUCCION: Estructura de Carpeta /docs/

La carpeta /docs/ es para documentacion operacional y referencia (NO codigo).

ESTRUCTURA RECOMENDADA:
docs/
├── README.md (Indice)
├── QUICK-START.md
├── setup/ (Instalacion)
├── usage/ (Uso)
├── architecture/ (Diseno)
├── database/ (Esquemas BD)
├── deployment/ (Deploy)
├── development/ (Desarrollo)
├── changelog/ (Historial)
├── operations/ (Operacion)
├── security/ (Seguridad)
├── troubleshooting/ (Problemas)
└── resources/ (Recursos)

QUE VA EN /docs/:
✓ Instrucciones de uso
✓ Esquemas de BD (para ejecutar manualmente)
✓ Guias de configuracion
✓ Procesos operacionales
✓ Decisiones de arquitectura
✓ Historias de cambios

QUE NO VA EN /docs/:
✗ Codigo fuente (va en src/)
✗ Archivos de configuracion (van en raiz)
✗ Tests (van en tests/)

Documentacion completa: E:\git\app\INSTRUCCION-CARPETA-DOCS-COMPLETA.md

---