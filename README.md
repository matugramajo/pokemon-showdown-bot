# Pokémon Showdown Discord Bot

Este bot de Discord te permite jugar batallas aleatorias de Pokémon Showdown directamente en tu servidor de Discord.

## Características

- Batallas aleatorias con equipos generados automáticamente
- Soporte para todas las generaciones de Pokémon (1-9)
- Interfaz simple y fácil de usar
- Comandos con slash (/) para una mejor experiencia de usuario
- Selección de generación mediante menú desplegable

## Requisitos

- Node.js 16.x o superior
- npm (Node Package Manager)
- Un bot de Discord (creado a través del [Portal de Desarrolladores de Discord](https://discord.com/developers/applications))

## Configuración

1. Clona este repositorio
2. Instala las dependencias:
   ```bash
   npm install
   ```
3. Crea un archivo `.env` en la raíz del proyecto y añade tu token de Discord:
   ```
   DISCORD_TOKEN=tu_token_aquí
   ```
4. Inicia el bot:
   ```bash
   npm start
   ```

## Comandos

- `/randbats [generación]` - Inicia una batalla aleatoria. Puedes seleccionar la generación (1-9) desde un menú desplegable o usar Gen 9 por defecto.
- `/ayuda` - Muestra la lista de comandos disponibles.

## Cómo usar

1. Invita el bot a tu servidor de Discord
2. Usa `/randbats` para iniciar una batalla aleatoria
3. Selecciona la generación que deseas jugar desde el menú desplegable
4. Sigue las instrucciones en pantalla para jugar

## Notas

- El bot usa la API oficial de Pokémon Showdown
- Las batallas son contra un bot controlado por la IA
- Los comandos con slash (/) son más intuitivos y ofrecen autocompletado
- La selección de generación es más fácil gracias al menú desplegable 