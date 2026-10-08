# Publicación HTTPS

Esta primera versión es una web estática. El servidor no almacena entrenamientos: IndexedDB conserva los datos en cada navegador. La página puede ser pública sin publicar los registros de usuario. No hay autenticación ni sincronización todavía.

## GitHub Pages

El flujo `.github/workflows/pages.yml` compila la rama `main` y publica únicamente `dist/`. Las notas de gimnasio, la transcripción y los documentos con datos personales están excluidos de Git y no forman parte del bundle.

1. En el repositorio, abre **Settings → Pages**.
2. En **Build and deployment → Source**, selecciona **GitHub Actions**.
3. En **Actions → Publicar Beast Log**, ejecuta **Run workflow** sobre `main` si el primer intento ocurrió antes de activar Pages.
4. Usa la dirección que confirme el despliegue. El candidato para este repositorio es `https://rafaelvargaspinilla-a11y.github.io/appCodex/`, pero no debe tratarse como una página activa hasta comprobar el despliegue.

Pages puede requerir un plan compatible si el repositorio es privado. No cambies su visibilidad sin revisar primero qué contiene.

## Compilación local equivalente

```bash
VITE_BASE_PATH=/appCodex/ npm run build
npm run preview
```

Comprueba `/appCodex/`, el manifiesto, los iconos y el service worker; recarga sin conexión después de una primera carga. Para desarrollo normal o un alojamiento en la raíz:

```bash
npm run build
```

## Verificación tras publicar

- Confirmar que la página HTTPS carga y no devuelve 404.
- Registrar una serie, recargar y comprobar que persiste.
- Esperar a que se instale el service worker; activar modo avión y recargar.
- Abrirla en el otro dispositivo: su diario comienza vacío hasta añadir sincronización o restaurar una copia.
- En iPhone: Safari → Compartir → Añadir a pantalla de inicio. En Android: opción de instalar del navegador.

Cambiar de dirección web cambia el almacenamiento local. Exporta una copia antes de migrar desde otro origen. Publicar el entorno cloud de Codex no publica esta web.
