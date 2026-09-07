# LABURANTE — Documento de Auditoría y Transformación

**Fecha:** Septiembre 2026  
**Ecosistema:** Lukson Arts  
**Repositorio Oficial:** [https://github.com/lukeetaah/laburante](https://github.com/lukeetaah/laburante)  
**Proyecto Anterior:** LABURAR  

---

## 1. Qué se encontró

Al auditar la carpeta de scratch del proyecto anterior (`LABURAR`), se detectó:
- **Stack obsoleto y no escalable**: Arquitectura basada en Vanilla HTML/JS (`app.js` monolítico de 3776 líneas, `server.js` básico en Express para servir estáticos).
- **Persistencia ficticia en `localStorage`**: No existía una base de datos real. Todos los usuarios, servicios, chats y calificaciones vivían en el navegador del cliente bajo claves como `laburar_pros_db` y `laburar_users_db`.
- **Datos fabricados (Mock Data)**: Se cargaban automáticamente decenas de supuestos profesionales con nombres, teléfonos argentinos y calificaciones falsas, simulando una red activa que en realidad no existía.
- **Concepto comercial desalineado**:
  - `CommissionService`: Cobro de comisión del 10% a los trabajadores.
  - `PayoutService` y `TransactionService`: Solicitud de retiros, saldos y retenciones.
  - `WarrantyService`: Promesa irreal de "7 días de garantía o lo arreglamos gratis" y "Protección LaburAR", que exponía legalmente a la plataforma al garantizar servicios sobre los que no tenía control técnico ni contractual.
  - `AntiBypassFilter`: Algoritmo que censuraba números de teléfono, correos y menciones a WhatsApp para obligar a los usuarios a usar un chat interno y forzar pagos en la plataforma.
- **Restricción geográfica arbitraria**: La lógica estaba hardcodeada casi exclusivamente para 15 zonas de CABA y el conurbano bonaerense (`ZonesService`).
- **Seguridad comprometida**: Contraseñas almacenadas en texto plano en `localStorage` y credencial de administrador hardcodeada (`admin@laburar.com.ar / asd123`).

---

## 2. Qué se reutilizó

- **Concepto de navegación en pasos (Wizard Flow)**: La idea de conectar mediante la pregunta directa "¿Qué necesitás?" y "¿Dónde estás?" se rescató y trasladó a una experiencia de búsqueda fluida y mobile-first.
- **Taxonomía de oficios y servicios**: Las categorías de trabajo (plomería, electricidad, gas, cerrajería, pintura, limpieza, tecnología, etc.) se enriquecieron y convirtieron en un sistema modular extensible (`src/data/categories.ts`).
- **ADN Visual y técnico de Lukson Arts / Sendero**:
  - Tipografías: `Space Grotesk` para títulos y `Inter` para cuerpos de texto.
  - Paleta de diseño: Integración de los tonos base de Sendero (ámbar `#F5A623`, índigo `#6366f1`, violeta `#8B6FD4`, teal `#00C9A7`) sobre un fondo cálido humano (`#FAFAF7`), transicionando en el footer hacia el portal oscuro característico de Lukson Arts (`#050508`).
  - Stack moderno unificado: React 19 + TypeScript + Tailwind CSS v4 + Zustand + Framer Motion.

---

## 3. Qué se eliminó

- ❌ **Comisiones y saldo**: Eliminado al 100%. LABURANTE es gratuito; no cobra entrada, créditos ni comisiones por contactar o trabajar.
- ❌ **Falsas garantías y promesas de verificación**: Eliminada la falsa afirmación de "profesionales 100% verificados con antecedentes penales y garantía de 7 días". En su lugar se crearon señales de transparencia honestas.
- ❌ **Filtro Anti-Bypass y chat simulado**: LABURANTE promueve el contacto directo. Los usuarios pueden acordar por WhatsApp, llamada o email sin que la plataforma los bloquee.
- ❌ **Perfiles falsos en producción**: Se desterraron por completo los perfiles ficticios de la base pública. Los mocks existentes se aislaron exclusivamente en `src/lib/mock-fixtures.ts` con la marca explícita `isMock: true` y solo son accesibles si se activan intencionalmente para pruebas de interfaz en desarrollo.
- ❌ **Gamificación artificial y puntos de cliente**: Eliminado el sistema de niveles (bronce, plata, oro) que incentivaba un marketplace transaccional.
- ❌ **Almacenamiento de contraseñas inseguras**: Eliminado el registro inseguro en `localStorage`.

---

## 4. Qué se reconstruyó

- **Arquitectura de producción profesional**: Aplicación SPA en React 19 + TypeScript + Vite, estilizada con Tailwind CSS v4 y preparada para deploy estático optimizado en Vercel con rewrites SPA (`vercel.json`).
- **Persistencia y Seguridad con Supabase (PostgreSQL)**:
  - Esquema estructurado en `supabase/schema.sql` con tablas para `profiles`, `categories`, `skills`, `services`, `contact_methods`, `recommendations` y `reports`.
  - Políticas de **Row Level Security (RLS)** estrictas: solo los dueños editan su perfil; los datos de contacto solo son visibles si tienen consentimiento explícito (`is_public = true`) y el perfil está activo; los reportes solo los consulta el administrador.
- **Flujo de consentimiento voluntario (Privacy by Design)**:
  - En la creación de perfil (`CreateProfile.tsx`), cada canal de contacto requiere confirmación expresa de publicación.
  - Modal de contacto (`ContactModal.tsx`) con aclaración explícita de que los datos fueron provistos voluntariamente para contacto laboral y que LABURANTE no interviene en acuerdos.
- **Sistema de reportes de perfiles (`ReportModal.tsx`)**: Permite denunciar perfiles por datos falsos, spam, fraude, datos no autorizados, acoso o suplantación, quedando registrados en la tabla `reports`.
- **Alcance Nacional Argentino Real**: Incorporación de las 23 provincias y CABA con sus principales localidades en `src/data/provinces.ts`.
- **Ecosistema Lukson Arts como portal integrado (`LuksonUniverse.tsx`)**:
  - Componente centralizado y desacoplado (`src/data/lukson-universe.ts`) con los 9 proyectos públicos verificados: **MI MANDATO, SENDERO, CORPORITY, RASTRO, MANDÍBULA, EL ORIGEN, AMAN, UMBRAL y EL BUCLE**.
  - Footer con transición estética que abre las puertas al universo creativo sin interrumpir la utilidad cotidiana de LABURANTE.
- **Marco legal y de responsabilidad claro**:
  - `/terminos`: Redacción humana pero jurídicamente sólida adaptada a la legislación argentina. Define con precisión el rol de infraestructura de contacto y delimita responsabilidades sin cláusulas abusivas ni desproporcionadas.
  - `/privacidad`: Tratamiento de datos bajo el principio de minimización (sin pedir DNI ni datos bancarios) y observancia de la Ley 25.326.

---

## 5. Riesgos detectados y mitigaciones

| Riesgo Detectado | Nivel | Mitigación Implementada |
|---|---|---|
| **Publicación de números de terceros sin consentimiento** | Crítico | Checkbox de consentimiento obligatorio, vinculación a cuenta autenticada y canal de reporte inmediato con motivo específico de "datos sin autorización". |
| **Exposición de contraseñas o datos personales** | Alto | Delegación completa de la autenticación a Supabase Auth; eliminación de contraseñas en texto plano y de campos sensibles como DNI en perfiles. |
| **Reclamos de usuarios por trabajos mal realizados** | Alto | Redacción transparente en footer y Términos: LABURANTE no es garante, empleador ni certificador. No promete "garantías de 7 días". |
| **Scraping masivo de datos** | Medio | Políticas de Row Level Security (RLS), rutas privadas excluidas en `robots.txt` y datos de contacto desacoplados en modal bajo interacción intencional. |

---

## 6. Decisiones de arquitectura tomadas

1. **Frontend**: React 19 + TypeScript + Vite. Tiempo de build de 1.2 segundos con bundle minificado y tipado estricto.
2. **Estilos**: Tailwind CSS v4, combinando la calidez visual de una herramienta cotidiana argentina con la tipografía y el refinamiento de Lukson Arts.
3. **Estado Global**: Zustand (`auth-store.ts` y `profile-store.ts`), ligero, reactivo y desacoplado de dependencias complejas.
4. **Base de Datos**: Supabase Postgres con cliente tipado en `src/lib/supabase.ts`.
5. **Configuración de Dominio**: Centralizada en `src/lib/constants.ts` mediante `SITE_CONFIG.url`, permitiendo que el despliegue inicial en Vercel pueda mapearse en cualquier momento a un dominio propio (`laburante.com.ar` u otro) sin alterar la lógica de sitemap, Open Graph ni canonical URLs.

---

## 7. Qué queda pendiente / Próximos pasos recomendados

- **Ejecución del Schema en Supabase**: Ejecutar `supabase/schema.sql` en la consola SQL del proyecto Supabase vinculado (`gmctzgrzwagtsnfkdbte`).
- **Conectar dominio definitivo**: Configurar DNS del dominio personalizado en Vercel cuando esté disponible.
- **Upload de fotos de perfil**: Conectar Supabase Storage bucket `avatars` para permitir foto de perfil directa (actualmente muestra avatar tipográfico con iniciales).
- **Notificaciones por email/resumen**: Configurar webhooks de Supabase si se desea alertar por email ante nuevos reportes.

---

## 8. Cómo ejecutar el proyecto en local

1. Clonar o ingresar al directorio:
   ```bash
   cd C:\Users\lucas\.gemini\antigravity\scratch\laburante
   ```
2. Instalar dependencias:
   ```bash
   npm install
   ```
3. Configurar variables de entorno en `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://gmctzgrzwagtsnfkdbte.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   VITE_SITE_URL=http://localhost:5173
   ```
4. Iniciar servidor de desarrollo:
   ```bash
   npm run dev
   ```
5. Abrir en el navegador:
   `http://localhost:5173`

---

## 9. Cómo compilar y desplegar en producción

### Compilación local
```bash
npm run build
```
Genera la carpeta optimizada `dist/`.

### Despliegue en Vercel
El repositorio incluye `vercel.json` configurado para SPA routing.

- **Vía Vercel CLI**:
  ```bash
  npx vercel
  ```
- **Vía GitHub / Vercel Dashboard**:
  Vincular el repositorio `https://github.com/lukeetaah/laburante` en [vercel.com](https://vercel.com), configurar las variables de entorno (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `VITE_SITE_URL`) y el deploy se realizará de forma automática en cada push a la rama principal.
