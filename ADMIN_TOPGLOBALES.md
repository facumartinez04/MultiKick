# 🎮 Admin Top Globales - Guía de Uso

## 📋 Resumen
Se ha creado una página de administración **exclusiva** para editar el slug `lostopglobales`. Esta página está completamente separada del panel de administración principal.

---

## 🔗 Acceso

### URL de Acceso
```
http://localhost:3000/admin-topglobales
```
O en producción:
```
https://tu-dominio.com/admin-topglobales
```

---

## 🔐 Sistema de Autenticación

### Endpoint de Login
- **URL:** `POST /api/admin/login-topglobales`
- **Body:** 
  ```json
  {
    "password": "tu-clave-topglobales"
  }
  ```
- **Respuesta exitosa:**
  ```json
  {
    "token": "topglobales-token-9f7e6d5c4b3a2e1f0a9b8c7d6e5f4a3b",
    "message": "Acceso autorizado para editar TopGlobales"
  }
  ```

### Token de Autenticación
- El token se guarda en `localStorage` con la clave: `topGlobalesToken`
- Este token es **diferente** al token del admin principal
- Se debe incluir en el header `Authorization: Bearer {token}` para todas las peticiones

---

## ✏️ Edición del Slug

### Endpoint de Actualización
- **URL:** `PUT /api/admin/slug-lostopglobales`
- **Headers:**
  ```
  Content-Type: application/json
  Authorization: Bearer topglobales-token-9f7e6d5c4b3a2e1f0a9b8c7d6e5f4a3b
  ```
- **Body:**
  ```json
  {
    "channels": ["duendepablo", "zeko", "goncho", "coker", "coscu", "robergalati"]
  }
  ```

### Ejemplo de Petición Completa
```javascript
const response = await fetch('http://localhost:3000/api/admin/slug-lostopglobales', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': 'Bearer topglobales-token-9f7e6d5c4b3a2e1f0a9b8c7d6e5f4a3b'
  },
  body: JSON.stringify({
    channels: ['duendepablo', 'zeko', 'goncho', 'coker', 'coscu', 'robergalati']
  })
});

const data = await response.json();
// Respuesta: { message: "Slug lostopglobales actualizado", channels: [...] }
```

---

## 🎨 Características de la Página

### Login
- Pantalla de autenticación con input de password
- Validación de credenciales específicas para Top Globales
- Mensajes de error claros en caso de fallo

### Dashboard
- **Solo vista:** Muestra los canales actuales del slug `lostopglobales`
- **Editor:** Textarea para modificar la lista de canales
- **Validación:** Feedback visual al guardar cambios
- **Diseño:** Estilo consistente con el resto de la aplicación (tema Kick)

### Restricciones
✅ **SÍ puede:**
- Ver los canales actuales de `lostopglobales`
- Editar la lista de canales de `lostopglobales`
- Cerrar sesión (logout)

❌ **NO puede:**
- Crear nuevos slugs
- Editar otros slugs
- Ver estadísticas de usuarios online
- Eliminar el slug `lostopglobales`

---

## 🔧 Integración en App.jsx

Se agregó:
1. **Import del componente:**
   ```javascript
   import AdminTopGlobales from './components/AdminTopGlobales';
   ```

2. **Ruta de acceso:**
   ```javascript
   if (window.location.pathname === '/admin-topglobales') {
     return <AdminTopGlobales />;
   }
   ```

3. **Exclusión de inicialización:**
   - La ruta `/admin-topglobales` se excluye del proceso de inicialización de canales
   - Se filtra de los `pathSegments` para evitar conflictos

---

## 📂 Archivos Modificados/Creados

### Nuevos Archivos
- ✨ `src/components/AdminTopGlobales.jsx` - Componente principal de la página de admin

### Archivos Modificados
- 🔧 `src/App.jsx` - Agregada ruta y import del nuevo componente

---

## 🚀 Próximos Pasos en el Backend

Para que esto funcione completamente, necesitas implementar en tu backend:

### 1. Endpoint de Login
```javascript
// POST /api/admin/login-topglobales
app.post('/api/admin/login-topglobales', (req, res) => {
  const { password } = req.body;
  
  // Verifica con una password específica para Top Globales
  if (password === process.env.TOPGLOBALES_PASSWORD) {
    const token = 'topglobales-token-9f7e6d5c4b3a2e1f0a9b8c7d6e5f4a3b'; // Genera un JWT
    res.json({ token, message: 'Acceso autorizado para editar TopGlobales' });
  } else {
    res.status(401).json({ error: 'Clave incorrecta' });
  }
});
```

### 2. Endpoint de Actualización
```javascript
// PUT /api/admin/slug-lostopglobales
app.put('/api/admin/slug-lostopglobales', authenticateTopGlobales, (req, res) => {
  const { channels } = req.body;
  
  // Actualiza SOLO el slug "lostopglobales"
  // ... lógica de actualización en base de datos
  
  res.json({ 
    message: 'Slug lostopglobales actualizado',
    channels 
  });
});
```

### 3. Middleware de Autenticación
```javascript
function authenticateTopGlobales(req, res, next) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  
  // Verifica que sea el token correcto de Top Globales
  if (token === 'topglobales-token-9f7e6d5c4b3a2e1f0a9b8c7d6e5f4a3b') { // o verifica JWT
    next();
  } else {
    res.status(403).json({ error: 'No autorizado' });
  }
}
```

---

## 💡 Notas Importantes

- El sistema de autenticación es **independiente** del admin principal
- El token se almacena en una clave diferente de localStorage
- La página **solo** permite editar `lostopglobales`, no puede tocar otros slugs
- El diseño mantiene la estética de la app (colores Kick, glassmorphism, etc.)

---

¡La página está lista para usar una vez que implementes los endpoints en el backend! 🎉
