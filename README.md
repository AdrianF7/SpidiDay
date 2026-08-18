# SpidiDay 1.0

SpidiDay es una PWA privada para hábitos, gastos, reflexiones y progreso diario. Funciona sin conexión, no usa servicios externos y conserva los datos en IndexedDB dentro del dispositivo.

La planificación principal es flexible: permite preparar manualmente las actividades de mañana o asignarlas a una fecha concreta. Las rutinas semanales creadas en versiones anteriores se conservan para no perder el historial.

## Ejecutar localmente

La aplicación debe abrirse mediante HTTP, nunca con `file://`.

1. Abre una terminal en la raíz del proyecto.
2. Ejecuta `python -m http.server 8080`.
3. Abre `http://localhost:8080/`.
4. En las herramientas del navegador, confirma que `service-worker.js` se registró y que no aparecen errores en la consola.

No hay dependencias, compilación ni variables de entorno.

## Publicar en GitHub Pages

1. Crea en GitHub un repositorio, por ejemplo `spididay`.
2. Sube el contenido de esta carpeta directamente a la raíz del repositorio. Incluye `.nojekyll`, `data/`, `fonts/`, `icons/` y todos los SVG.
3. Comprueba que `index.html` esté en la raíz, no dentro de otra carpeta.
4. Abre **Settings → Pages**.
5. En **Build and deployment**, elige **Deploy from a branch**.
6. Selecciona la rama `main`, la carpeta `/(root)` y pulsa **Save**.
7. Espera a que GitHub publique `https://USUARIO.github.io/NOMBRE-REPOSITORIO/`.
8. Abre esa dirección con conexión y recarga una vez para que la versión 1.0 del service worker instale todos los recursos.

Todas las rutas de ejecución son relativas a la carpeta del repositorio. El manifest usa `start_url: "./index.html"`, `scope: "./"`; el service worker se registra mediante `./service-worker.js` y controla únicamente esa subcarpeta.

## Instalar en un iPhone

1. Abre la URL HTTPS de GitHub Pages en Safari.
2. Espera a que la pantalla termine de cargar con conexión.
3. Pulsa **Compartir → Añadir a pantalla de inicio**.
4. Confirma el nombre **SpidiDay** y pulsa **Añadir**.
5. Abre SpidiDay desde el icono instalado.
6. Después de la primera carga completa, activa el modo avión, cierra la PWA y ábrela nuevamente para comprobar el modo sin conexión.

Los datos pertenecen al origen exacto de GitHub Pages y al navegador del iPhone. Cambiar el usuario, repositorio o URL crea otro almacenamiento independiente.

## Lista manual de publicación para iPhone

- Abrir y cerrar los editores de hábito, gasto y presupuesto con X y Cancelar.
- Crear, editar, completar y eliminar un hábito.
- Registrar, editar y eliminar un gasto; comprobar presupuesto y filtros.
- Cerrar y abrir la PWA y confirmar que hábitos y gastos siguen presentes.
- Comprobar que el versículo permanece igual durante el día.
- Escribir una reflexión, guardarla y confirmar que el campo queda vacío.
- Abrir **Perfil → Mi cuaderno**, editar y eliminar una reflexión.
- Marcar y desmarcar un versículo favorito.
- Exportar una copia JSON, conservarla en Archivos e importarla de nuevo.
- Usar **Otra frase** varias veces y comprobar que no repite inmediatamente.
- Probar con modo avión después de una carga completa.
- Revisar que la navegación inferior no tape el último contenido.
- Girar o usar el zoom de texto de iOS y comprobar que los controles siguen siendo accesibles.

## Copias de seguridad

En **Perfil → Copia de seguridad**:

- **Exportar datos** descarga `spididay-copia-FECHA.json` con todos los almacenes.
- **Importar datos** valida copias de SpidiDay y copias antiguas de AdriDay antes de solicitar confirmación.
- La restauración reemplaza los datos únicamente después de que el usuario lo confirme.
- **Dinero → Filtrar y exportar → Exportar CSV** exporta los gastos visibles.

Guarda una copia antes de borrar datos de Safari, cambiar de iPhone o cambiar la URL del repositorio.

## Privacidad y almacenamiento

- Los datos se guardan localmente en `AdriDayDB`; se conserva este nombre interno para no perder instalaciones anteriores.
- La versión actual de IndexedDB es la 7.
- Las migraciones crean almacenes e índices faltantes sin borrar los anteriores.
- `clear()` solo se utiliza al restaurar una copia confirmada o al ejecutar **Restablecer datos** con doble confirmación; no se utiliza durante una actualización.
- No se usa `indexedDB.deleteDatabase()` ni `localStorage.clear()`.
- No hay analítica, publicidad, rastreadores, contraseñas ni solicitudes a APIs.
- SpidiDay solicita almacenamiento persistente cuando el navegador lo permite.

## Contenido local y funcionamiento offline

El service worker `spididay-v1.0.0` precarga la interfaz, scripts, manifest, tipografías, iconos, 366 versículos, 300 frases y las ilustraciones SVG. La navegación usa red primero y conserva `index.html` como alternativa offline; los demás recursos utilizan caché primero.

Los versículos proceden de la **Reina-Valera 1909**, edición de dominio público publicada por [eBible.org](https://ebible.org/details.php?id=spaRV1909). La selección se calcula con la fecha local, baraja los 366 textos con el año como semilla y no repite versículos dentro del mismo año.

## Migraciones y Mi cuaderno

La actualización a IndexedDB 2 añadió los datos de Brújula, versículos y recuperaciones parciales. La actualización a IndexedDB 3 añadió `verseJournalEntries` y sus índices. Las reflexiones anteriores se migran conservando toda la información disponible.

En **Perfil → Mi cuaderno** se pueden consultar, buscar, editar, compartir y eliminar reflexiones. Favoritos y reflexiones son estados independientes.

## Archivos principales

- `index.html`: estructura, formularios y metadatos iOS.
- `styles.css`: diseño móvil, áreas seguras y movimiento reducido.
- `app.js`: hábitos, gastos, navegación, CSV y copias.
- `finance.js`: cuentas, movimientos, transferencias y cálculos financieros centralizados.
- `compass.js`: Brújula, versículo diario y Mi cuaderno.
- `db.js`: IndexedDB y migraciones.
- `service-worker.js`: caché offline.
- `manifest.webmanifest`: instalación PWA.
- `data/`: versículos y frases locales.
- `fonts/`, `icons/` y SVG: recursos visuales locales.
- `.nojekyll`: publicación estática directa en GitHub Pages.
## Mi historia

SpidiDay incluye una vista editorial para conservar días, hábitos, gastos,
versículos y reflexiones. La carta para tu yo pequeño, las promesas y la
fotografía de “El origen” se guardan únicamente en IndexedDB del dispositivo.
La fotografía de “El origen” está incluida localmente en `assets/spidiiii.jpeg`
y también puede sustituirse desde el selector del iPhone; nunca se sube a un
servidor. La migración de base de datos es aditiva (versión 4)
y conserva todos los stores existentes. Los mensajes positivos y de apoyo se
integrarán cuando se proporcionen sus dos listas exactas, sin generar textos
automáticamente.
