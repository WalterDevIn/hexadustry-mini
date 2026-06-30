# Hexadustry Mini

Fangame/prototipo inspirado en la idea general de una fabrica defensiva tipo Mindustry, pero con grilla hexagonal y estetica retro de lineas blancas sobre fondo negro.

## Ejecutar

```bash
npm install
npm run dev
```

## Estado actual

La primera version contiene:

- Canvas fullscreen.
- Fondo negro con lineas blancas y scanlines suaves.
- Mapa hexagonal pointy-top con coordenadas axiales `q,r`.
- Minerales prototipo.
- Nucleo.
- Extractor.
- Transportadores visuales.
- Torreta visual.
- Enemigo visual.

Todavia no hay simulacion productiva ni combate real. Esta version solo fija la base visual, geometrica y estructural.

## Estructura tecnica minima

```txt
src/
  main.js
  app/
    createGame.js
  hex/
    hexMath.js
  world/
    createInitialWorld.js
  render/
    canvasRenderer.js
  styles.css
```

### `hex/`

Responsable de toda la matematica hexagonal. Aca deben vivir:

- conversion axial `q,r` a pixel;
- vecinos hexagonales;
- distancia hexagonal;
- seleccion de celda desde mouse;
- pathfinding sobre la grilla.

Regla: ningun sistema de gameplay deberia recalcular geometria hexagonal por su cuenta.

### `world/`

Responsable del estado del mapa y entidades de gameplay. Aca deben vivir:

- tiles;
- minerales;
- edificios;
- enemigos;
- recursos globales;
- creacion de mapas iniciales;
- carga/guardado futuro.

### `render/`

Responsable de dibujar. No deberia decidir reglas. Solo recibe estado y lo representa.

### `app/`

Responsable de coordinar el juego:

- crear mundo;
- crear renderer;
- ejecutar loop;
- conectar input;
- llamar sistemas.

## Roadmap de version minima jugable

### 1. Mapa interactivo

- Detectar celda bajo el mouse.
- Resaltar hex seleccionado.
- Click para colocar edificios.
- Camara con pan y zoom.

### 2. Minerales y extractores

- Tile con mineral y cantidad.
- Extractor consume mineral del tile.
- Extractor genera item interno cada cierto tiempo.

### 3. Transportadores

- Cinta con direccion hexagonal 0..5.
- Item viaja de celda en celda.
- Cinta entrega al nucleo o a otro edificio.

### 4. Nucleo

- Recibe items.
- Almacena recursos.
- Pierde vida si un enemigo llega.

### 5. Torreta

- Busca enemigo en rango hexagonal.
- Consume recurso o dispara gratis en prototipo.
- Baja HP del enemigo.

### 6. Enemigo

- Spawnea en borde del mapa.
- Busca camino hacia el nucleo.
- Ataca el nucleo o edificios que bloqueen.

## Convenciones iniciales

- Coordenadas: axial `q,r`.
- Hexes: pointy-top.
- Estetica base: blanco/negro, sin colores fuertes hasta que sean necesarios por lectura.
- Renderer: canvas 2D.
- Gameplay: primero data simple, despues sistemas separados.
