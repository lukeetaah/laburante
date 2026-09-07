// LABURANTE — Argentine provinces and major cities
// Full coverage: 24 jurisdictions

export interface Province {
  name: string
  slug: string
  localidades: string[]
}

export const PROVINCES: Province[] = [
  { name: 'Buenos Aires', slug: 'buenos-aires', localidades: ['La Plata', 'Mar del Plata', 'Bahía Blanca', 'Tandil', 'San Nicolás', 'Pergamino', 'Junín', 'Olavarría', 'Necochea', 'Zárate', 'Campana', 'Luján', 'Mercedes', 'San Pedro', 'Chivilcoy', 'Trenque Lauquen', 'Azul', 'Dolores', 'Lanús', 'Lomas de Zamora', 'Quilmes', 'Avellaneda', 'Morón', 'San Isidro', 'Vicente López', 'Tigre', 'Pilar', 'Escobar', 'Merlo', 'Moreno', 'Florencio Varela', 'Berazategui', 'San Martín', 'Tres de Febrero', 'Ituzaingó', 'Hurlingham'] },
  { name: 'CABA', slug: 'caba', localidades: ['Palermo', 'Belgrano', 'Caballito', 'Recoleta', 'Villa Urquiza', 'Flores', 'Almagro', 'Nuñez', 'Villa Crespo', 'Devoto', 'Barracas', 'La Boca', 'San Telmo', 'Constitución', 'Boedo', 'Parque Patricios', 'Villa Lugano', 'Liniers', 'Mataderos', 'Pompeya', 'Colegiales', 'Saavedra', 'Villa del Parque', 'Monte Castro'] },
  { name: 'Catamarca', slug: 'catamarca', localidades: ['San Fernando del Valle de Catamarca', 'Tinogasta', 'Belén', 'Andalgalá', 'Santa María'] },
  { name: 'Chaco', slug: 'chaco', localidades: ['Resistencia', 'Presidencia Roque Sáenz Peña', 'Villa Ángela', 'Barranqueras', 'Charata'] },
  { name: 'Chubut', slug: 'chubut', localidades: ['Rawson', 'Comodoro Rivadavia', 'Trelew', 'Puerto Madryn', 'Esquel'] },
  { name: 'Córdoba', slug: 'cordoba', localidades: ['Córdoba', 'Villa Carlos Paz', 'Río Cuarto', 'Villa María', 'San Francisco', 'Alta Gracia', 'Bell Ville', 'Jesús María', 'La Falda', 'Cosquín'] },
  { name: 'Corrientes', slug: 'corrientes', localidades: ['Corrientes', 'Goya', 'Paso de los Libres', 'Mercedes', 'Curuzú Cuatiá'] },
  { name: 'Entre Ríos', slug: 'entre-rios', localidades: ['Paraná', 'Concordia', 'Gualeguaychú', 'Concepción del Uruguay', 'Villaguay', 'Chajarí'] },
  { name: 'Formosa', slug: 'formosa', localidades: ['Formosa', 'Clorinda', 'Pirané', 'El Colorado'] },
  { name: 'Jujuy', slug: 'jujuy', localidades: ['San Salvador de Jujuy', 'Palpalá', 'San Pedro de Jujuy', 'Libertador General San Martín', 'Humahuaca', 'Tilcara'] },
  { name: 'La Pampa', slug: 'la-pampa', localidades: ['Santa Rosa', 'General Pico', 'Toay', 'General Acha'] },
  { name: 'La Rioja', slug: 'la-rioja', localidades: ['La Rioja', 'Chilecito', 'Aimogasta', 'Chamical'] },
  { name: 'Mendoza', slug: 'mendoza', localidades: ['Mendoza', 'San Rafael', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Maipú', 'Luján de Cuyo', 'Tunuyán', 'San Martín'] },
  { name: 'Misiones', slug: 'misiones', localidades: ['Posadas', 'Oberá', 'Eldorado', 'Puerto Iguazú', 'Apóstoles', 'Jardín América'] },
  { name: 'Neuquén', slug: 'neuquen', localidades: ['Neuquén', 'San Martín de los Andes', 'Centenario', 'Plottier', 'Cutral Có', 'Villa La Angostura'] },
  { name: 'Río Negro', slug: 'rio-negro', localidades: ['Viedma', 'San Carlos de Bariloche', 'General Roca', 'Cipolletti', 'Allen', 'El Bolsón'] },
  { name: 'Salta', slug: 'salta', localidades: ['Salta', 'San Ramón de la Nueva Orán', 'Tartagal', 'General Güemes', 'Metán', 'Cafayate'] },
  { name: 'San Juan', slug: 'san-juan', localidades: ['San Juan', 'Rawson', 'Rivadavia', 'Chimbas', 'Pocito', 'Caucete'] },
  { name: 'San Luis', slug: 'san-luis', localidades: ['San Luis', 'Villa Mercedes', 'Merlo', 'La Punta', 'Justo Daract'] },
  { name: 'Santa Cruz', slug: 'santa-cruz', localidades: ['Río Gallegos', 'Caleta Olivia', 'El Calafate', 'Pico Truncado', 'Puerto Deseado'] },
  { name: 'Santa Fe', slug: 'santa-fe', localidades: ['Santa Fe', 'Rosario', 'Rafaela', 'Venado Tuerto', 'Reconquista', 'Villa Gobernador Gálvez', 'Casilda', 'Esperanza', 'San Lorenzo'] },
  { name: 'Santiago del Estero', slug: 'santiago-del-estero', localidades: ['Santiago del Estero', 'La Banda', 'Termas de Río Hondo', 'Añatuya', 'Frías'] },
  { name: 'Tierra del Fuego', slug: 'tierra-del-fuego', localidades: ['Ushuaia', 'Río Grande', 'Tolhuin'] },
  { name: 'Tucumán', slug: 'tucuman', localidades: ['San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Concepción', 'Banda del Río Salí', 'Famaillá'] },
]
