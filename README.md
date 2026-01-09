# JEWELRY GIRL - Proyecto (mejorado)

Pequeña tienda demo con Express y EJS. He actualizado el proyecto para:

- Usar `express.urlencoded` y `express-session` para manejar sesiones y el carrito por usuario.
- Normalizar recursos estáticos en `/public/css` y `/public/images`.
- Añadir vistas mínimas faltantes (`tickets.ejs`, `tienda.ejs`).

Cómo ejecutar:

1. Instala dependencias:

   npm install

2. Ejecuta en modo desarrollo (requiere `nodemon`):

   npm run dev

3. Abrir en el navegador:

   http://localhost:9999

Notas:
- Para producción, exporta `SESSION_SECRET`, `PORT` y `MONGO_URI` como variables de entorno.
- El carrito ahora se guarda en la sesión para usuarios no autenticados y en MongoDB para usuarios autenticados.

Variables de ejemplo (archivo `.env`):

MONGO_URI=mongodb://127.0.0.1:27017/jewelry-girl
SESSION_SECRET=algún_secreto_seguro
PORT=9999

Asegúrate de tener MongoDB corriendo localmente o configura `MONGO_URI` apuntando a tu instancia remota.