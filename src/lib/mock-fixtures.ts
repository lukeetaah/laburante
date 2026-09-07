// FIXTURES DE DESARROLLO (MOCK DATA)
// REGLA CRÍTICA: Estos perfiles son ÚNICAMENTE para pruebas de interfaz durante desarrollo.
// NUNCA deben mostrarse en producción como perfiles reales.
// Todos llevan la propiedad `isMock: true` y están explícitamente etiquetados.

export interface MockProfile {
  id: string
  name: string
  slug: string
  photo_url: string | null
  bio: string
  provincia: string
  localidad: string
  zona_trabajo: string
  disponibilidad: 'disponible' | 'ocupado' | 'no_disponible'
  modalidad: 'presencial' | 'remoto' | 'ambas'
  status: 'activo'
  isMock: true
  categories: string[]
  skills: string[]
  services: { title: string; description: string; precio_orientativo?: string }[]
  contact_methods: {
    type: 'whatsapp' | 'telefono' | 'email' | 'instagram' | 'linkedin' | 'web' | 'portfolio'
    value: string
    is_public: boolean
  }[]
  recommendations: {
    from_name: string
    text: string
    context: string
    date: string
  }[]
  created_at: string
}

export const DEV_MOCK_PROFILES: MockProfile[] = [
  {
    id: 'mock-1',
    name: 'Esteban Morales (MOCK DEV)',
    slug: 'esteban-morales-mock',
    photo_url: null,
    bio: 'Electricista matriculado e instalador de aire acondicionado. Más de 10 años en obras particulares e industriales.',
    provincia: 'Córdoba',
    localidad: 'Córdoba',
    zona_trabajo: 'Centro, Nueva Córdoba, General Paz y alrededores',
    disponibilidad: 'disponible',
    modalidad: 'presencial',
    status: 'activo',
    isMock: true,
    categories: ['Oficios', 'Mantenimiento', 'Hogar'],
    skills: ['Instalaciones trifásicas', 'Tableros eléctricos', 'Detección de fugas', 'Térmicas y disyuntores'],
    services: [
      { title: 'Revisión y diagnóstico de circuito eléctrico', description: 'Chequeo completo de fugas y cortocircuitos.', precio_orientativo: 'Desde $15.000 (orientativo)' },
      { title: 'Instalación de térmicas y disyuntores', description: 'Colocación normalizada según normativa.', precio_orientativo: 'A convenir' }
    ],
    contact_methods: [
      { type: 'whatsapp', value: '+54 9 351 234-5678', is_public: true },
      { type: 'telefono', value: '0351 456-7890', is_public: true },
      { type: 'email', value: 'esteban.morales@ejemplo.com.ar', is_public: true }
    ],
    recommendations: [
      { from_name: 'Valeria R.', context: 'Cambio de tablero general en departamento', text: 'Puntual, prolijo y explicó cada paso del trabajo.', date: 'Febrero 2026' }
    ],
    created_at: '2026-01-10T12:00:00Z'
  },
  {
    id: 'mock-2',
    name: 'Carolina Gómez (MOCK DEV)',
    slug: 'carolina-gomez-mock',
    photo_url: null,
    bio: 'Diseñadora gráfica y especialista en identidad de marca para emprendimientos y pymes independientes.',
    provincia: 'Santa Fe',
    localidad: 'Rosario',
    zona_trabajo: 'Rosario y trabajo remoto para todo el país',
    disponibilidad: 'disponible',
    modalidad: 'remoto',
    status: 'activo',
    isMock: true,
    categories: ['Diseño', 'Tecnología', 'Arte y Comunicación'],
    skills: ['Figma', 'Illustrator', 'Branding', 'Manual de marca', 'Diseño editorial'],
    services: [
      { title: 'Identidad visual completa', description: 'Logotipo, paleta, tipografías y piezas base para redes.', precio_orientativo: 'Presupuesto a medida' },
      { title: 'Rediseño de packaging', description: 'Etiquetas y presentaciones para productos gastronómicos o artesanales.' }
    ],
    contact_methods: [
      { type: 'instagram', value: '@caro.mock.design', is_public: true },
      { type: 'portfolio', value: 'https://behance.net/mock-carolina', is_public: true },
      { type: 'email', value: 'caro.mock@ejemplo.com', is_public: true }
    ],
    recommendations: [
      { from_name: 'Martín P.', context: 'Identidad para café de especialidad', text: 'Entendió perfecto la onda de lo que queríamos transmitir.', date: 'Enero 2026' }
    ],
    created_at: '2026-01-20T15:30:00Z'
  },
  {
    id: 'mock-3',
    name: 'Roberto Varela (MOCK DEV)',
    slug: 'roberto-varela-mock',
    photo_url: null,
    bio: 'Gasista matriculado y plomero. Destapaciones mecánicas, termotanques, calefones y cañerías en termofusión.',
    provincia: 'Buenos Aires',
    localidad: 'Vicente López',
    zona_trabajo: 'Vicente López, Olivos, San Isidro, Florida',
    disponibilidad: 'disponible',
    modalidad: 'presencial',
    status: 'activo',
    isMock: true,
    categories: ['Oficios', 'Hogar', 'Construcción'],
    skills: ['Termofusión', 'Instalación de calefones', 'Pruebas de hermeticidad', 'Destapaciones'],
    services: [
      { title: 'Cambio de termotanque / calefón', description: 'Desinstalación del artefacto anterior y montaje del nuevo con prueba de seguridad.', precio_orientativo: 'Consultar según modelo' }
    ],
    contact_methods: [
      { type: 'whatsapp', value: '+54 9 11 0000-0000', is_public: true }
    ],
    recommendations: [],
    created_at: '2026-02-05T10:00:00Z'
  },
  {
    id: 'mock-4',
    name: 'Lucía Benítez (MOCK DEV)',
    slug: 'lucia-benitez-mock',
    photo_url: null,
    bio: 'Traductora pública y redactora de contenidos técnicos y académicos en inglés y español.',
    provincia: 'Mendoza',
    localidad: 'Mendoza',
    zona_trabajo: 'Mendoza y todo el país remoto',
    disponibilidad: 'disponible',
    modalidad: 'remoto',
    status: 'activo',
    isMock: true,
    categories: ['Educación', 'Profesionales', 'Arte y Comunicación'],
    skills: ['Traducción EN/ES', 'Corrección de estilo', 'Artículos técnicos', 'Subtitulado'],
    services: [
      { title: 'Traducción de papers y documentos', description: 'Traducción rigurosa y corrección de estilo cruzada.' }
    ],
    contact_methods: [
      { type: 'email', value: 'lucia.trad.mock@ejemplo.com', is_public: true },
      { type: 'linkedin', value: 'https://linkedin.com/in/mock-lucia-benitez', is_public: true }
    ],
    recommendations: [],
    created_at: '2026-02-18T14:10:00Z'
  }
]
