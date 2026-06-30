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
Mouse = apuntado del jugador y de la torreta montada
Click izquierdo = dispara si no hay bloque seleccionado / coloca bloque seleccionado
Click izquierdo sostenido = arrastra y encola bloques sobre el rastro
Click derecho = iniciar deconstruccion o deseleccionar bloque si no hay nada deconstruible
R = rotar el bloque seleccionado cuando tenga rotaciones
```

## Estado actual

La version actual contiene:

- Canvas fullscreen.
- Fondo negro con lineas blancas y scanlines suaves.
- Mapa hexagonal pointy-top con coordenadas axiales `q,r`.
- Grilla virtual grande: el mapa tiene radio amplio, pero solo se dibujan los hexes visibles con contenido relevante.
- Sistema de chunks para generar terreno bajo demanda.
- Hexagonos al `0.8` del tamaño visual anterior.
- Camara centrada en la nave del jugador.
- Tres capas de mapa: suelo, terrestre y aerea.
- Minerales en capa de suelo.
- Muros hexagonales naturales generados proceduralmente en capa terrestre.
- Bloques naturales y construidos en capa terrestre.
- Jugador en capa aerea.
- Jugador con rotacion visual suave hacia el mouse.
- Movimiento vectorial con inercia, frenado suave y aceleracion progresiva.
- Jugador como triangulo equilatero amarillo de diametro visual igual al 80% de un hex.
- Particulas de escape detras del jugador al moverse, con mayor emision a mayor velocidad.
- Torreta de unidad montada en el jugador, con rotacion propia y disparo automatico si se mantiene click izquierdo.
- Proyectiles aereos como rayitas rapidas; impactan contra enemigos y atraviesan muros por pertenecer a capa aerea.
- Menu inferior derecho de construccion con pestanas por categoria.
- Tres bloques construibles de muro: chico, grande y enorme.
- Recursos infinitos para pruebas de construccion.
- Preview tenue del bloque seleccionado siguiendo el mouse.
- Construcciones y deconstrucciones encoladas con siluetas translucidas.
- Una sola operacion de construccion/deconstruccion avanza por vez; las demas quedan como previas en espera.
- Ritmo de construccion y deconstruccion multiplicado por 4 respecto del tiempo base del bloque.
- ECS minimo.
- Enemigos iniciales desactivados temporalmente.

Todavia no hay simulacion productiva ni combate real. Esta version fija la base visual, geometrica, capas de mapa, chunks, UI base, primeros muros construibles y ECS.

## Estructura tecnica minima

```txt
src/
  main.js
  app/
    createGame.js
  content/
    buildingDefinitions.js
  ecs/
    createWorld.js
  game/
    createInitialGameState.js
  hex/
    hexMath.js
  input/
    buildPlacementInput.js
    keyboardInput.js
  render/
    canvasRenderer.js
  systems/
    constructionSystem.js
    enemyAiSystem.js
    groundEnemySystem.js
    movementSystem.js
    playerControlSystem.js
    playerTurretSystem.js
    projectileSystem.js
  ui/
    buildMenu.js
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
- `unitTurret`: torreta montada sobre una unidad, con rotacion relativa, recarga y datos de proyectil.
- `projectile`: proyectil con vida util, radio de impacto y daño.
- `enemyAi`: comportamiento basico de enemigo.
- `groundEnemyAi`: comportamiento basico de enemigo terrestre por hexagonos.
- `team`: faccion o bando.
- `triangleRenderable`: dibujo de nave triangular.
- `circleRenderable`: dibujo de unidad circular.
- `lineRenderable`: dibujo de rayitas, usado por proyectiles.
- `health`: vida actual y maxima.

### Sistemas actuales

- `playerControlSystem`: lee input, rota visualmente hacia el objetivo, acelera la nave y emite particulas.
- `playerTurretSystem`: rota la torreta montada hacia el mouse y dispara si se mantiene click izquierdo sin bloque seleccionado.
- `projectileSystem`: envejece proyectiles, detecta impacto contra enemigos y elimina entidades destruidas.
- `enemyAiSystem`: busca una entidad del equipo jugador y acelera hacia ella.
- `groundEnemySystem`: mueve enemigos terrestres por hexagonos y evita muros solidos.
- `movementSystem`: aplica velocidad sobre transform.
- `constructionSystem`: procesa una sola operacion de construccion/deconstruccion por vez y mantiene el resto como cola visual.
- `canvasRenderer`: no decide gameplay; dibuja por orden de capas.

## Jugador

El jugador rota suavemente hacia el mouse. La rotacion visual no depende de la direccion de movimiento.

El jugador es un triangulo equilatero amarillo. Su diametro visual es igual al 80% de un hexagono.

El movimiento es vectorial: se puede acelerar en cualquier direccion usando WASD o flechas. La nave tiene inercia, tarda un poco en frenar y su velocidad maxima sube progresivamente hasta 2x despues de 3 segundos continuos de movimiento.

Cuando se mueve, la parte trasera de la nave emite particulas. La emision y el tamaño de las particulas aumentan con la velocidad actual.

La nave tiene una torreta de unidad montada cerca del centro. Visualmente es un palito con pivote alrededor del 25% de su largo: una parte corta queda hacia atras y la mayor parte queda hacia adelante. La torreta rota de forma independiente respecto del cuerpo de la nave; su rotacion mundial resulta de la rotacion del cuerpo mas su propia rotacion relativa.

Si no hay bloque seleccionado, mantener click izquierdo dispara automaticamente rayitas rapidas desde la torreta. Los proyectiles son aereos: atraviesan muros y solo impactan contra entidades enemigas con vida.

## Menu de construccion

El menu inferior derecho contiene pestanas para categorias futuras:

- torretas;
- extractores;
- transportadores;
- fabricas;
- muros;
- unidades;
- apoyo.

La seleccion de categoria se guarda en `gameState.ui.buildMenu.activeCategory`. La seleccion de bloque se guarda en `gameState.ui.buildMenu.selectedBlockId`. La rotacion actual se guarda en `gameState.ui.buildMenu.rotationIndex`.

## Muros construibles

Hay tres muros construibles en la pestana `MUROS`:

- `basicWall`: ocupa 1 hex y cuesta `8 copper`.
- `largeWall`: ocupa 3 hexes unidos, cuesta `24 copper` y tiene 2 rotaciones alternables con `R`.
- `hugeWall`: ocupa 7 hexes, un hex central completamente rodeado, y cuesta `56 copper` + `8 graphite`.

Todos los muros:

- son solidos;
- bloquean enemigos terrestres;
- usan el color amarillo del jugador;
- se renderizan como una figura construida, no como piedra natural.

Los muros multi-hex reservan todos los tiles de su huella, pero el renderer solo dibuja el contorno exterior y no dibuja divisorias internas entre hexes.

El muro grande mantiene una huella axial entera igual que los otros muros. Su unica diferencia de input es `snapMouseToFootprintCenter`: el mouse se interpreta desde el centro efectivo/interseccion de la pieza para calcular el hex ancla, pero la preview, la construccion y el muro construido usan la misma grilla final sin offsets visuales ni subgrillas.

Flujo:

1. Abrir la pestana `MUROS`.
2. Seleccionar un muro.
3. Mover el mouse para ver la previa tenue.
4. Rotar con `R` si el muro seleccionado lo permite.
5. Hacer click izquierdo sobre un hex libre o arrastrar con click izquierdo sostenido.
6. Cada bloque valido del rastro entra como silueta translucida en la cola de construccion.
7. Solo la operacion mas antigua avanza; las demas quedan visibles en espera.
8. Al terminar una construccion, aparece el muro solido y empieza la siguiente operacion de la cola.
9. Click derecho sobre cualquier hex ocupado por un muro construido encola deconstruccion.
10. Al terminar la deconstruccion, el muro desaparece y devuelve sus materiales.

## Capas del mapa

Cada tile hexagonal tiene tres capas:

### `ground`

Capa de suelo. Contiene:

- terreno base;
- minerales.

La grilla del suelo no se dibuja como contorno visual. Solo se renderizan elementos con lectura propia, como minerales.

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
- unidades voladoras;
- proyectiles aereos.

El renderer dibuja en este orden:

```txt
ground -> surface -> air
```

Eso permite que minerales queden debajo, edificios/bloques queden en superficie y naves/proyectiles aereos queden por encima.

## Chunks y cuevas

`chunkedCaveGeneration.js` genera chunks de `16 x 16` hexagonos. Cada chunk se genera una sola vez y se marca en `generatedChunks`.

La estructura busca una lectura similar a cuevas de Terraria:

- paredes naturales agrupadas;
- corredores abiertos irregulares;
- bolsillos de aire;
- variacion entre `cave-wall` y `dense-rock`;
- zona segura alrededor del origen para no encerrar al jugador.

El renderer calcula los hexagonos visibles, asegura los chunks cercanos con `ensureChunksForHexes` y luego aplica un postproceso visual sobre los muros naturales generados. Ese postproceso agrupa `cave-wall` y `dense-rock` en siluetas de 1, 3 o 7 hexes cuando encajan sobre terreno ya generado; no modifica la generacion ni la ocupacion real del mapa.

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
