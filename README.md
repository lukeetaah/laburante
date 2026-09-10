# LABURANTE

> **Hay gente que sabe hacer cosas. Hay gente que necesita que esas cosas se hagan. LABURANTE intenta acercarlas.**

Infraestructura digital gratuita, abierta y de alcance nacional para facilitar el encuentro entre personas que ofrecen su trabajo, oficio, profesión o servicios y personas que necesitan encontrar a alguien para realizar un trabajo en toda la República Argentina.

Una creación de **[Lukson Arts](https://luksonarts.vercel.app)**.

---

## Principios del Producto

- **0% para LABURANTEs**: Sin comisiones sobre trabajos ni suscripciones obligatorias. Quien busca inicia un pedido de presupuesto para abrir un contacto contextualizado.
- **Alcance Nacional Real**: Diseñado desde el inicio para las 23 provincias argentinas y la Ciudad Autónoma de Buenos Aires.
- **Contacto Contextual y Voluntario**: Después de un pedido de presupuesto respondido, solo se muestran los medios de contacto que cada persona elige compartir y autoriza expresamente.
- **Transparencia**: Sin falsas promesas de verificación ni garantías que la plataforma no puede controlar. Herramientas de reporte comunitario.
- **Privacidad por Diseño**: Sin recopilación innecesaria de DNI ni datos bancarios. Observancia estricta de la Ley 25.326.
- **Ecosistema Integrado**: Conexión editorial y descubrimiento natural hacia las demás creaciones del universo Lukson Arts (MI MANDATO, SENDERO, CORPORITY, RASTRO, MANDÍBULA, EL ORIGEN, AMAN, UMBRAL, EL BUCLE).

---

## Stack Tecnológico

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS v4
- **Routing & State**: React Router v7, Zustand
- **Backend & Database**: Supabase (PostgreSQL con Row Level Security)
- **Animaciones & Iconografía**: Framer Motion, Lucide React
- **Hosting & Deploy**: Vercel (`vercel.json` con SPA rewrites)

---

## Estructura del Proyecto

```
laburante/
├── public/
│   ├── favicon.svg          # Isotipo de LABURANTE
│   └── robots.txt           # Configuración SEO y privacidad
├── src/
│   ├── components/
│   │   ├── layout/          # Header, Footer
│   │   ├── lukson/          # Portal del universo Lukson Arts
│   │   └── profile/         # ProfileCard, ContactModal, ReportModal
│   ├── data/
│   │   ├── categories.ts    # Sistema de categorías extensible
│   │   ├── provinces.ts     # Provincias y localidades de Argentina
│   │   └── lukson-universe.ts # Registro centralizado de obras de Lukson Arts
│   ├── lib/
│   │   ├── constants.ts     # Configuración de sitio y dominio
│   │   └── supabase.ts      # Cliente Supabase tipado
│   ├── pages/               # Home, Search, ProfilePage, Categories, Auth, Legal
│   ├── stores/              # auth-store, profile-store (Zustand)
│   ├── App.tsx              # Router principal
│   └── index.css            # Sistema de diseño LABURANTE + Lukson DNA
├── supabase/
│   └── schema.sql           # Esquema SQL con tablas, índices y RLS
├── LABURANTE_AUDIT.md       # Documento completo de auditoría técnica
└── vercel.json              # Configuración de deploy en Vercel
```

---

## Puesta en marcha local

1. Clonar el repositorio:
   ```bash
   git clone https://github.com/lukeetaah/laburante.git
   cd laburante
   ```

2. Instalar dependencias:
   ```bash
   npm install
   ```

3. Crear el archivo `.env.local`:
   ```env
   VITE_SUPABASE_URL=https://gmctzgrzwagtsnfkdbte.supabase.co
   VITE_SUPABASE_ANON_KEY=tu_anon_key
   VITE_SITE_URL=http://localhost:5173
   ```

4. Iniciar en modo desarrollo:
   ```bash
   npm run dev
   ```

5. Compilar para producción:
   ```bash
   npm run build
   ```

---

## Base de Datos (Supabase)

El script SQL completo con todas las tablas, índices y políticas RLS está disponible en:
`supabase/schema.sql`.

Para una instalación existente, aplicar las migraciones de Empresa y oportunidades (`migration_companies_documents.sql`, `migration_opportunities_languages.sql`, `migration_company_opportunity_budget.sql` y `migration_company_candidate_inquiries.sql`), luego `supabase/migration_company_plans.sql`, `supabase/migration_company_plan_lockdown.sql` y `supabase/migration_authenticated_job_requests.sql`.
Esa migración agrega el plan persistente de las cuentas Empresa y la operación protegida
que permite al administrador activar o quitar el plan Pago desde el panel.

---

## Licencia y Créditos

LABURANTE es una obra y producto social del universo creativo de **Lukson Arts**.
Desarrollado para la comunidad de trabajadores y usuarios de la República Argentina.
