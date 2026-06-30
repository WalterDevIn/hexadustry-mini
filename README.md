# Hexadustry Mini

Fangame/prototipo inspirado en la idea general de una fabrica defensiva tipo Mindustry, pero con grilla hexagonal y estetica retro de lineas blancas sobre fondo negro.

## Ejecutar

```bash
npm install
npm run dev
```

Controles actuales:

```txt
WASD / Flechas = mover nave del jugador
```

## Estado actual

La version actual contiene:

- Canvas fullscreen.
- Fondo negro con lineas blancas y scanlines suaves.
- Mapa hexagonal pointy-top con coordenadas axiales `q,r`.
- Grilla virtual grande: el mapa tiene radio amplio, pero solo se dibujan los hexes visibles en camara.
- Sistema de chunks para generar terreno bajo demanda.
- Hexagonos al `0.8` del tamaño visual anterior.
- Camara centrada en la nave del jugador.
- Tres capas de mapa: suelo, terrestre y aerea.
- Minerales en capa de suelo.
- Muros hexagonales naturales generados proceduralmente en capa terrestre.
- Bloques naturales y construidos en capa terrestre.
- Jugador y enemigo volador en capa aerea.
- ECS minimo.
- Jugador como nave triangular.
- Enemigo como nave triangular con AI simple de persecucion.

Todavia no hay simulacion productiva ni combate real. Esta version fija la base visual, geometrica, capas de mapa, chunks y ECS.

## Estructura tecnica minima

```txt
src/
  main.js
  app/
    createGame.js
  ecs/
    createWorld.js
  game/
    createInitialGameState.js
  hex/
    hexMath.js
  input/
    keyboardInput.js
  render/
    canvasRenderer.js
  systems/
    enemyAiSystem.js
    movementSystem.js
    playerControlSystem.js
  world/
    chunkedCaveGeneration.js
    createInitialWorld.js
  styles.css
```

## ECS actual

El ECS separa entidades, componentes y sistemas.

### Entidades

Las entidades son solo IDs numericos. No contienen logica.

### Componentes actuales

- `transform`: posicion `x,y` y rotacion.
- `velocity`: velocidad y velocidad maxima.
- `mapLayer`: capa de mapa donde existe la entidad.
- `playerControlled`: marca y parametros de control del jugador.
- `enemyAi`: comportamiento basico de enemigo.
- `team`: faccion o bando.
- `triangleRenderable`: dibujo de nave triangular.
- `health`: vida actual y maxima.

### Sistemas actuales

- `playerControlSystem`: lee input y acelera la nave del jugador.
- `enemyAiSystem`: busca una entidad del equipo jugador y acelera hacia ella.
- `movementSystem`: aplica velocidad sobre transform.
- `canvasRenderer`: no decide gameplay; dibuja por orden de capas.

## Capas del mapa

Cada tile hexagonal tiene tres capas:

### `ground`

Capa de suelo. Contiene:

- terreno base;
- minerales.

### `surface`

Capa terrestre. Contiene:

- unidades terrestres;
- bloques naturales;
- bloques construidos;
- edificios;
- muros naturales generados por chunks.

### `air`

Capa aerea. Contiene:

- jugador;
- unidades voladoras.

El renderer dibuja en este orden:

```txt
ground -> surface -> air
```

Eso permite que minerales queden debajo, edificios/bloques queden en superficie y naves voladoras queden por encima.

## Chunks y cuevas

`chunkedCaveGeneration.js` genera chunks de `16 x 16` hexagonos. Cada chunk se genera una sola vez y se marca en `generatedChunks`.

La estructura busca una lectura similar a cuevas de Terraria:

- paredes naturales agrupadas;
- corredores abiertos irregulares;
- bolsillos de aire;
- variacion entre `cave-wall` y `dense-rock`;
- zona segura alrededor del origen para no encerrar al jugador.

El renderer calcula los hexagonos visibles, asegura los chunks cercanos con `ensureChunksForHexes` y luego dibuja la capa terrestre.

## Mapa y camara

El mapa ya no se dibuja iterando una lista completa de hexagonos. `generateVisibleHexes` calcula los hexagonos que entran en la pantalla segun:

- posicion del jugador;
- tamaño del viewport;
- tamaño actual del hexagono;
- radio maximo del mapa.

El estado del mapa es sparse: `tileMap` solo guarda tiles especiales, como minerales, bloques naturales, muros generados o edificios. Los tiles vacios se construyen temporalmente al renderizar.

## Convenciones iniciales

- Coordenadas del mapa: axial `q,r`.
- Hexes: pointy-top.
- Coordenadas de naves: espacio de mundo 2D centrado sobre el canvas.
- Estetica base: blanco/negro, sin colores fuertes hasta que sean necesarios por lectura.
- Renderer: canvas 2D.
- Gameplay: data simple + sistemas separados.

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

- Busca enemigo en rango hexagonal o rango 2D.
- Consume recurso o dispara gratis en prototipo.
- Baja HP del enemigo.

### 6. Enemigo

- Spawnea en borde del mapa.
- Busca camino hacia el nucleo o persigue al jugador, segun modo.
- Ataca el nucleo, edificios o jugador.
