require('dotenv').config();
const { Client, GatewayIntentBits, Events, EmbedBuilder, REST, Routes, SlashCommandBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Dex } = require('pokemon-showdown');

// Error handling
process.on('unhandledRejection', error => {
    console.error('Unhandled promise rejection:', error);
});

process.on('uncaughtException', error => {
    console.error('Uncaught exception:', error);
});

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages
    ]
});

// Store active battles and challenges
const activeBattles = new Map();
const activeChallengers = new Map();

// Define slash commands
const commands = [
    new SlashCommandBuilder()
        .setName('retar')
        .setDescription('Reta a otro usuario a una batalla Pokémon')
        .addUserOption(option =>
            option.setName('oponente')
                .setDescription('Usuario al que quieres retar')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('generacion')
                .setDescription('Generación de Pokémon (1-9)')
                .setRequired(false)
                .addChoices(
                    { name: 'Generación 1', value: '1' },
                    { name: 'Generación 2', value: '2' },
                    { name: 'Generación 3', value: '3' },
                    { name: 'Generación 4', value: '4' },
                    { name: 'Generación 5', value: '5' },
                    { name: 'Generación 6', value: '6' },
                    { name: 'Generación 7', value: '7' },
                    { name: 'Generación 8', value: '8' },
                    { name: 'Generación 9', value: '9' }
                ))
        .addIntegerOption(option =>
            option.setName('pokemones')
                .setDescription('Cantidad de Pokémon por equipo (1-6)')
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(6)),
    new SlashCommandBuilder()
        .setName('ayuda')
        .setDescription('Muestra la lista de comandos disponibles'),
    new SlashCommandBuilder()
        .setName('atacar')
        .setDescription('Usa un movimiento en la batalla')
        .addStringOption(option =>
            option.setName('movimiento')
                .setDescription('Número del movimiento (1-4)')
                .setRequired(true)
                .addChoices(
                    { name: 'Movimiento 1', value: '1' },
                    { name: 'Movimiento 2', value: '2' },
                    { name: 'Movimiento 3', value: '3' },
                    { name: 'Movimiento 4', value: '4' }
                ))
];

// Register slash commands
const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

// Reconnection logic
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;
const RECONNECT_INTERVAL = 5000; // 5 seconds

async function registerCommands() {
    try {
        console.log('Started refreshing application (/) commands.');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('Successfully reloaded application (/) commands.');
    } catch (error) {
        console.error('Error registering commands:', error);
        if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
            reconnectAttempts++;
            console.log(`Retrying in ${RECONNECT_INTERVAL/1000} seconds... (Attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})`);
            setTimeout(registerCommands, RECONNECT_INTERVAL);
        } else {
            console.error('Max reconnection attempts reached. Please check your internet connection and token.');
            process.exit(1);
        }
    }
}

client.once(Events.ClientReady, async () => {
    console.log(`Bot is ready! Logged in as ${client.user.tag}`);
    reconnectAttempts = 0;
    await registerCommands();
});

// Handle disconnects
client.on('disconnect', () => {
    console.log('Bot disconnected. Attempting to reconnect...');
    if (reconnectAttempts < MAX_RECONNECT_ATTEMPTS) {
        reconnectAttempts++;
        setTimeout(() => {
            console.log(`Reconnection attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS}`);
            client.login(process.env.DISCORD_TOKEN);
        }, RECONNECT_INTERVAL);
    } else {
        console.error('Max reconnection attempts reached. Please check your internet connection and token.');
        process.exit(1);
    }
});

client.on(Events.InteractionCreate, async interaction => {
    if (interaction.isButton()) {
        await handleButtonInteraction(interaction);
        return;
    }

    if (!interaction.isChatInputCommand()) return;

    const { commandName } = interaction;

    switch (commandName) {
        case 'retar':
            await handleChallenge(interaction);
            break;
        case 'atacar':
            await handleAttack(interaction);
            break;
        case 'ayuda':
            await showHelp(interaction);
            break;
    }
});

async function handleChallenge(interaction) {
    await interaction.deferReply();
    
    const challenger = interaction.user;
    const opponent = interaction.options.getUser('oponente');
    const gen = interaction.options.getString('generacion') || '9';
    const teamSize = interaction.options.getInteger('pokemones') || 3;
    
    if (opponent.bot) {
        return interaction.editReply('No puedes retar a un bot a una batalla.');
    }

    if (opponent.id === challenger.id) {
        return interaction.editReply('No puedes retarte a ti mismo.');
    }

    if (activeBattles.has(challenger.id) || activeBattles.has(opponent.id)) {
        return interaction.editReply('Uno de los jugadores ya está en una batalla.');
    }

    const validGens = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
    if (!validGens.includes(gen)) {
        return interaction.editReply('Por favor especifica una generación válida (1-9)');
    }

    // Create accept/decline buttons
    const acceptButton = new ButtonBuilder()
        .setCustomId(`accept_${challenger.id}_${gen}_${teamSize}`)
        .setLabel('Aceptar')
        .setStyle(ButtonStyle.Success);

    const declineButton = new ButtonBuilder()
        .setCustomId(`decline_${challenger.id}`)
        .setLabel('Rechazar')
        .setStyle(ButtonStyle.Danger);

    const row = new ActionRowBuilder()
        .addComponents(acceptButton, declineButton);

    // Store the challenge
    activeChallengers.set(challenger.id, {
        opponent: opponent.id,
        gen,
        teamSize,
        timestamp: Date.now()
    });

    // Create challenge embed
    const embed = new EmbedBuilder()
        .setTitle('¡Desafío Pokémon!')
        .setDescription(`${challenger.username} te ha retado a una batalla Pokémon`)
        .addFields(
            { name: 'Generación', value: `Gen ${gen}` },
            { name: 'Pokémon por equipo', value: `${teamSize}` }
        )
        .setColor('#ff9900');

    await interaction.editReply({
        content: `${opponent}, has sido retado a una batalla!`,
        embeds: [embed],
        components: [row]
    });
}

async function handleButtonInteraction(interaction) {
    const [action, ...params] = interaction.customId.split('_');
    
    if (action === 'attack') {
        await handleAttackButton(interaction, params[0]);
        return;
    }

    // Handle other button interactions (accept/decline challenge)
    const [challengerId, gen, teamSize] = params;
    const challenger = await client.users.fetch(challengerId);
    
    if (!activeChallengers.has(challengerId)) {
        return interaction.reply({ content: 'Este desafío ya no es válido.', ephemeral: true });
    }

    const challenge = activeChallengers.get(challengerId);
    
    if (interaction.user.id !== challenge.opponent) {
        return interaction.reply({ content: 'Este desafío no es para ti.', ephemeral: true });
    }

    if (action === 'decline') {
        activeChallengers.delete(challengerId);
        return interaction.update({
            content: `${interaction.user.username} ha rechazado el desafío.`,
            components: [],
            embeds: []
        });
    }

    if (action === 'accept') {
        await startBattle(interaction, challenger, interaction.user, gen, parseInt(teamSize));
        activeChallengers.delete(challengerId);
    }
}

async function startBattle(interaction, player1, player2, gen, teamSize) {
    const dex = Dex.mod(`gen${gen}`);
    const allPokemon = Array.from(dex.species.all())
        .filter(pokemon => !pokemon.isNonstandard && pokemon.name !== 'missingno');

    // Generate random teams for both players
    const team1 = generateRandomTeam(allPokemon, teamSize);
    const team2 = generateRandomTeam(allPokemon, teamSize);

    // Get moves for each Pokémon
    const team1WithMoves = await Promise.all(team1.map(pokemon => getPokemonWithMoves(dex, pokemon)));
    const team2WithMoves = await Promise.all(team2.map(pokemon => getPokemonWithMoves(dex, pokemon)));

    // Store battle information
    const battleId = `${player1.id}-${player2.id}`;
    activeBattles.set(battleId, {
        player1: { 
            id: player1.id, 
            team: team1WithMoves,
            currentPokemon: 0,
            hp: 100
        },
        player2: { 
            id: player2.id, 
            team: team2WithMoves,
            currentPokemon: 0,
            hp: 100
        },
        currentTurn: player1.id,
        gen,
        lastUpdate: Date.now(),
        channel: interaction.channel,
        messageId: null // Will store the ID of the battle message
    });

    // Create battle embeds for each player
    const player1Embed = createTeamEmbed(player1.username, team1WithMoves, gen);
    const player2Embed = createTeamEmbed(player2.username, team2WithMoves, gen);

    // Send private messages to each player with their teams
    await interaction.update({
        content: '¡La batalla ha comenzado! Revisa tus mensajes privados para ver tu equipo.',
        components: [],
        embeds: []
    });

    try {
        await player1.send({ embeds: [player1Embed] });
        await player2.send({ embeds: [player2Embed] });
    } catch (error) {
        console.error('Error sending DMs:', error);
        await interaction.followUp('No se pudieron enviar los mensajes privados. Asegúrate de tener los DMs activados.');
    }

    // Create battle message with attack buttons
    const battleEmbed = new EmbedBuilder()
        .setTitle('¡Batalla Pokémon!')
        .setDescription(`${player1.username} vs ${player2.username}`)
        .addFields(
            { name: 'Generación', value: `Gen ${gen}` },
            { name: 'Pokémon por equipo', value: `${teamSize}` },
            { name: 'Turno actual', value: `${player1.username}` }
        )
        .setColor('#00ff00');

    // Create attack buttons for the first Pokémon
    const attackButtons = createAttackButtons(team1WithMoves[0].moves);
    
    // Send the battle message with buttons
    const battleMessage = await interaction.followUp({
        embeds: [battleEmbed],
        components: [attackButtons]
    });

    // Store the message ID for future updates
    activeBattles.get(battleId).messageId = battleMessage.id;
}

function createAttackButtons(moves) {
    const row = new ActionRowBuilder();
    
    moves.forEach((move, index) => {
        const button = new ButtonBuilder()
            .setCustomId(`attack_${index + 1}`)
            .setLabel(`${move.name} (${move.type})`)
            .setStyle(ButtonStyle.Primary);
        row.addComponents(button);
    });

    return row;
}

async function handleAttackButton(interaction, moveNumber) {
    const userId = interaction.user.id;
    const moveIndex = parseInt(moveNumber) - 1;
    
    // Find the battle where this user is participating
    let battleId = null;
    for (const [id, battle] of activeBattles.entries()) {
        if (battle.player1.id === userId || battle.player2.id === userId) {
            battleId = id;
            break;
        }
    }

    if (!battleId) {
        return interaction.reply({ content: 'No estás en ninguna batalla activa.', ephemeral: true });
    }

    const battle = activeBattles.get(battleId);
    if (battle.currentTurn !== userId) {
        return interaction.reply({ content: 'No es tu turno.', ephemeral: true });
    }

    const isPlayer1 = battle.player1.id === userId;
    const attacker = isPlayer1 ? battle.player1 : battle.player2;
    const defender = isPlayer1 ? battle.player2 : battle.player1;

    // Get current Pokémon and its moves
    const currentPokemon = attacker.team[attacker.currentPokemon];
    const move = currentPokemon.moves[moveIndex];

    // Calculate damage
    const damage = calculateDamage(move, currentPokemon, defender.team[defender.currentPokemon]);
    defender.hp -= damage;

    // Create battle update embed
    const battleEmbed = new EmbedBuilder()
        .setTitle('¡Ataque!')
        .setDescription(`${interaction.user.username} usó ${move.name}!`)
        .addFields(
            { name: 'Daño', value: `${damage}%` },
            { name: 'HP restante', value: `${defender.hp}%` }
        )
        .setColor('#ff0000');

    // Check if the battle is over
    if (defender.hp <= 0) {
        battleEmbed.setTitle('¡Batalla terminada!')
            .setDescription(`${interaction.user.username} ha ganado la batalla!`)
            .setColor('#00ff00');
        
        activeBattles.delete(battleId);
        await interaction.update({
            embeds: [battleEmbed],
            components: []
        });
    } else {
        // Switch turns
        battle.currentTurn = defender.id;
        battleEmbed.addFields({ name: 'Siguiente turno', value: `<@${defender.id}>` });

        // Update attack buttons for the next player's Pokémon
        const nextPlayer = defender;
        const nextPokemon = nextPlayer.team[nextPlayer.currentPokemon];
        const newAttackButtons = createAttackButtons(nextPokemon.moves);

        await interaction.update({
            embeds: [battleEmbed],
            components: [newAttackButtons]
        });
    }
}

function calculateDamage(move, attacker, defender) {
    // Simplified damage calculation
    const baseDamage = Math.floor(Math.random() * 30) + 20; // Random damage between 20-50
    return baseDamage;
}

async function getPokemonWithMoves(dex, pokemonName) {
    const pokemon = dex.species.get(pokemonName);
    const moves = Array.from(dex.moves.all())
        .filter(move => !move.isNonstandard && move.gen <= parseInt(dex.gen))
        .sort(() => Math.random() - 0.5)
        .slice(0, 4)
        .map(move => ({
            name: move.name,
            type: move.type,
            power: move.basePower || 0,
            accuracy: move.accuracy || 100
        }));

    return {
        name: pokemon.name,
        type: pokemon.types[0],
        moves: moves
    };
}

function generateRandomTeam(allPokemon, teamSize) {
    const team = [];
    for (let i = 0; i < teamSize; i++) {
        const randomIndex = Math.floor(Math.random() * allPokemon.length);
        const randomPokemon = allPokemon[randomIndex];
        team.push(randomPokemon.name);
    }
    return team;
}

function createTeamEmbed(username, team, gen) {
    const teamDescription = team.map((pokemon, index) => {
        const moves = pokemon.moves.map((move, moveIndex) => 
            `${moveIndex + 1}. ${move.name} (${move.type})`
        ).join('\n');
        return `**${pokemon.name}** (${pokemon.type})\n${moves}`;
    }).join('\n\n');

    return new EmbedBuilder()
        .setTitle(`Equipo de ${username} - Gen ${gen}`)
        .setDescription('¡Este es tu equipo para la batalla!')
        .addFields(
            { name: 'Tu equipo:', value: teamDescription }
        )
        .setColor('#00ff00');
}

async function showHelp(interaction) {
    const embed = new EmbedBuilder()
        .setTitle('Comandos del Bot Pokémon Showdown')
        .setDescription('Aquí están los comandos disponibles:')
        .addFields(
            { name: '/retar @usuario [generación] [pokemones]', value: 'Reta a otro usuario a una batalla. Puedes especificar la generación (1-9) y la cantidad de Pokémon por equipo (1-6).' },
            { name: '/atacar [movimiento]', value: 'Usa un movimiento en tu turno. Especifica el número del movimiento (1-4).' },
            { name: '/ayuda', value: 'Muestra este mensaje de ayuda' }
        )
        .setColor('#0099ff');

    await interaction.reply({ embeds: [embed] });
}

// Start the bot with error handling
client.login(process.env.DISCORD_TOKEN).catch(error => {
    console.error('Error logging in:', error);
    process.exit(1);
}); 