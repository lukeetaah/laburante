# Datos geográficos del mapa administrativo

`public/argentina-provinces.geojson` contiene las 24 jurisdicciones de primer orden de Argentina a partir de la descarga oficial de la API GeoRef de Argentina (`https://apis.datos.gob.ar/georef/api/v2.0/provincias.geojson`), cuyos atributos de fuente indican IGN.

Para que el mapa administrativo sea legible, se conservaron únicamente las geometrías de Tierra del Fuego con latitud superior a `-56`; esto excluye la geometría antártica reclamada que devuelve el recurso, sin inventar límites provinciales ni alterar las otras jurisdicciones.
