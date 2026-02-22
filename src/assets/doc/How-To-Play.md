# Chuleta de reglas — Tablut (variante Nicolas Cartier)

> Base: “TABLUT RULES by CARTIER Nicolas” (1 página). [R1]

## 0) Glosario / Bandos
- **Defensores (Suecos, negros)**: 1 **Rey** + 8 **guerreros** (9 piezas en total). [R1]
- **Atacantes (Moscovitas, blancos)**: 16 **guerreros**. [R1]
- **Trono / Ciudadela (citadel / throne)**: **la casilla central** donde inicia el Rey. [R1]

## 1) Tablero y colocación inicial
- Tablero **9×9**. [R1]
- El **Rey** empieza en el **Trono** (ciudadela). [R1]
- Los **8 defensores** empiezan alrededor del Rey (según el diagrama de Linnaeus al que refiere Cartier). [R1]
- Los **16 atacantes** empiezan en una formación de asedio (según el mismo diagrama referenciado). [R1]

> Nota para implementación: Cartier menciona numeración “square 1/2/3/4” como referencia del diagrama; para el motor conviene usar coordenadas (p. ej. A1..I9) y cargar un “setup” fijo equivalente.

## 2) Turno
- **Empiezan los Atacantes (Moscovitas)**. [R1]
- Luego alternan turnos normalmente. [R1]

## 3) Movimiento (todas las piezas, incluido el Rey)
- Una pieza se mueve en línea recta **horizontal o vertical** como la **torre** en ajedrez. [R1]
- Puede avanzar cualquier cantidad de casillas en esa línea, **mientras estén vacías** (no salta piezas). [R1]
- Restricción clave: el movimiento es “en todas las casillas **excepto el trono**” (ver regla 4). [R1]

## 4) Trono / Ciudadela (casilla especial)
- El **Trono** está **ocupado por el Rey al inicio**. [R1]
- **Nadie puede entrar ni pasar a través del Trono durante la partida.** [R1]
- Cuando el Rey **sale del Trono**:
    - El Rey **no puede volver** a entrar **ni atravesarlo**. [R1]
    - El Trono pasa a ser **hostil “como un peón”** y **participa en capturas** (ver regla 5). [R1]
- Mientras el Rey **está en el Trono**, para que el Trono sea considerado “hostil” en capturas, Cartier indica:
    - “**tres oponentes** deben estar colocados en las casillas adyacentes al Trono” (las 4 ortogonales). [R1]

> Nota práctica: en el motor, modela el Trono como:
> - `restrictedSquare = true` siempre (no se puede ocupar ni atravesar),
> - `hostileSquare = (kingHasLeftThrone) OR (kingOnThrone AND attackersAdjacentCount>=3)`.

## 5) Capturas (custodial / “sandwich”)
### 5.1 Captura estándar (guerreros y también el Rey, con excepciones)
- Capturas una pieza enemiga (y también al Rey, salvo reglas especiales) **encerrándola entre dos de tus piezas** en lados opuestos (arriba/abajo o izquierda/derecha). [R1]
- La pieza capturada se **retira inmediatamente**. [R1]
- Una pieza puede moverse a una casilla vacía **entre dos enemigas** sin ser capturada “por estar ahí”; solo se captura cuando el rival **cierra** el sandwich en su turno. [R1]
- Se pueden capturar **2 o incluso 3 guerreros** en un mismo movimiento (multi-captura). [R1]
- **El Rey puede capturar** guerreros enemigos igual que cualquier pieza. [R1]

### 5.2 Captura del Rey (casos especiales)
- **Rey en el Trono**: solo se captura si queda **rodeado en los 4 lados ortogonales** por atacantes. [R1]
- **Rey adyacente al Trono**: se captura si queda rodeado por **3 atacantes** y el **4º lado** es el **Trono** (que cuenta como el lado faltante). [R1]

> Nota de motor: estas dos reglas son excepciones explícitas a “captura por 2 lados” para el Rey.

## 6) Objetivo / Condición de victoria
- **Defensores ganan** si el Rey llega a **cualquier casilla del borde** del tablero. [R1]
- **Atacantes ganan** si **capturan al Rey**. [R1]

## 7) Repetición (anti-empate)
- Si una **serie de movimientos** se repite **tres veces**, el **jugador ofensivo** debe encontrar un movimiento alternativo. [R1]
    - Cartier añade que esta regla existe para evitar empates. [R1]
- Referencia histórica citada por Cartier: Hervarar saga ok Heiðreks. [R1]

> Sugerencia de implementación (determinista):
> - Define una “posición” como (tablero + jugador al turno).
> - Lleva un contador por hash de posición.
> - Si una posición se registra por 3ª vez, prohíbe los movimientos que la reproduzcan y exige otro movimiento legal.

## 8) Checklist directo para motor de reglas (resumen “programable”)
1. **Turno alterno**, empiezan atacantes. [R1]
2. **Movimiento tipo torre**, sin saltos. [R1]
3. **Trono restringido**: no se entra ni se atraviesa nunca; el Rey tampoco puede volver/atravesar tras salir. [R1]
4. **Captura por sandwich** (2 lados) + **multi-captura** (2–3 piezas) + **Rey captura**. [R1]
5. **Captura del Rey especial**:
    - en trono: 4 lados,
    - junto al trono: 3 lados + trono. [R1]
6. **Victoria**:
    - Rey a cualquier borde = defensores,
    - Rey capturado = atacantes. [R1]
7. **Repetición x3**: el ofensivo debe variar. [R1]

---

## Referencias
- [R1] Nicolas Cartier, *Tablut Rules* (PDF reproducido por Aage Nielsen): https://aagenielsen.dk/TablutrulesbyCartier.pdf

[R1]: https://aagenielsen.dk/TablutrulesbyCartier.pdf