// LABURANTE — Categories
// Extensible category system — add entries here, no code changes needed elsewhere

export interface CategoryDef {
  id: string
  name: string
  slug: string
  icon: string
  subcategories?: string[]
}

export const CATEGORIES: CategoryDef[] = [
  { id: 'oficios', name: 'Oficios', slug: 'oficios', icon: '🔧', subcategories: ['Plomero', 'Electricista', 'Gasista', 'Carpintero', 'Cerrajero', 'Pintor', 'Albañil', 'Herrero', 'Vidriero', 'Soldador'] },
  { id: 'construccion', name: 'Construcción', slug: 'construccion', icon: '🏗️', subcategories: ['Albañil', 'Maestro mayor de obras', 'Durlock', 'Pisos', 'Techos', 'Refacciones'] },
  { id: 'hogar', name: 'Hogar', slug: 'hogar', icon: '🏠', subcategories: ['Limpieza', 'Jardinero', 'Fumigador', 'Mudanza', 'Aire acondicionado', 'Mantenimiento general'] },
  { id: 'tecnologia', name: 'Tecnología', slug: 'tecnologia', icon: '💻', subcategories: ['Programador', 'Diseñador web', 'Técnico PC', 'Redes', 'Soporte técnico', 'Desarrollo de apps'] },
  { id: 'diseno', name: 'Diseño', slug: 'diseno', icon: '🎨', subcategories: ['Diseño gráfico', 'Diseño UX/UI', 'Diseño de interiores', 'Diseño industrial', 'Ilustración'] },
  { id: 'profesionales', name: 'Profesionales', slug: 'profesionales', icon: '📋', subcategories: ['Abogado', 'Contador', 'Arquitecto', 'Ingeniero', 'Médico', 'Psicólogo', 'Nutricionista', 'Coach', 'Coach ontológico'] },
  { id: 'educacion', name: 'Educación', slug: 'educacion', icon: '📚', subcategories: ['Profesor particular', 'Profesor de inglés', 'Profesor de música', 'Tutor', 'Apoyo escolar'] },
  { id: 'cuidado', name: 'Cuidado', slug: 'cuidado', icon: '💚', subcategories: ['Niñera', 'Cuidador de adultos mayores', 'Cuidador de mascotas', 'Enfermero/a'] },
  { id: 'gastronomia', name: 'Gastronomía', slug: 'gastronomia', icon: '🍳', subcategories: ['Cocinero', 'Chef a domicilio', 'Pastelero', 'Catering', 'Viandas'] },
  { id: 'eventos', name: 'Eventos', slug: 'eventos', icon: '🎉', subcategories: ['Fotógrafo', 'Camarógrafo', 'DJ', 'Sonido', 'Iluminación', 'Decoración', 'Animador'] },
  { id: 'transporte', name: 'Transporte', slug: 'transporte', icon: '🚗', subcategories: ['Flete', 'Mudanza', 'Mensajería', 'Chofer', 'Delivery'] },
  { id: 'arte', name: 'Arte y Comunicación', slug: 'arte', icon: '🎭', subcategories: ['Músico', 'Fotógrafo', 'Productor audiovisual', 'Community manager', 'Redactor', 'Traductor'] },
  { id: 'mantenimiento', name: 'Mantenimiento', slug: 'mantenimiento', icon: '🔩', subcategories: ['Mecánico', 'Electricista automotor', 'Refrigeración', 'Ascensores', 'Reparación electrodomésticos'] },
  { id: 'servicios-personales', name: 'Servicios personales', slug: 'servicios-personales', icon: '✨', subcategories: ['Peluquero', 'Masajista', 'Manicura', 'Maquillaje', 'Entrenador personal'] },
  { id: 'administracion', name: 'Administración', slug: 'administracion', icon: '📊', subcategories: ['Asistente virtual', 'Secretario/a', 'Data entry', 'Gestión', 'RRHH'] },
  { id: 'otros', name: 'Otros', slug: 'otros', icon: '🌟', subcategories: [] },
]
