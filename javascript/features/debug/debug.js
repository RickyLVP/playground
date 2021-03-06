// Copyright 2015 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

const CommandBuilder = require('components/command_manager/command_builder.js');
const Feature = require('components/feature_manager/feature.js');

// Utility function to return |value| in |len| digits, left-padded with zeros when necessary.
function leftPad(value, len = 2) {
  return ('0' + value).slice(-2);
}

// The debug feature offers useful tools for administrators to debug the server or the Las Venturas
// Playground gamemode itself. It's driven by a number of in-game comments.
class Debug extends Feature {
  constructor() {
    super();

    // /serverfps
    server.commandManager.buildCommand('serverfps')
        .restrict(Player.LEVEL_ADMINISTRATOR)
        .build(this.__proto__.serverFrameCounter.bind(this));

    // /trace [seconds]
    server.commandManager.buildCommand('trace')
        .restrict(Player.LEVEL_MANAGEMENT)
        .parameters([{ name: 'seconds', type: CommandBuilder.NUMBER_PARAMETER }])
        .build(this.__proto__.captureTrace.bind(this));

    // /sound [id]
    server.commandManager.buildCommand('sound')
        .restrict(Player.LEVEL_MANAGEMENT)
        .parameters([{ name: 'sound', type: CommandBuilder.NUMBER_PARAMETER }])
        .build(this.__proto__.playSound.bind(this));

    // /int [id]
    server.commandManager.buildCommand('int')
        .restrict(Player.LEVEL_ADMINISTRATOR)
        .parameters([ { name: 'id', type: CommandBuilder.NUMBER_PARAMETER } ])
        .build(this.__proto__.int.bind(this));

    // /cam
    server.commandManager.buildCommand('cam')
        .restrict(Player.LEVEL_ADMINISTRATOR)
        .build(this.__proto__.cam.bind(this));

    // /eval
    server.commandManager.buildCommand('eval')
        .restrict(Player.LEVEL_MANAGEMENT)
        .parameters([ { name: 'command', type: CommandBuilder.SENTENCE_PARAMETER } ])
        .build(this.__proto__.eval.bind(this));

    // /idlers
    server.commandManager.buildCommand('idlers')
        .restrict(Player.LEVEL_ADMINISTRATOR)
        .build(this.__proto__.idlers.bind(this));

    // /pattach
    server.commandManager.buildCommand('pattach')
        .restrict(Player.LEVEL_MANAGEMENT)
        .parameters([ { name: 'player', type: CommandBuilder.PLAYER_PARAMETER },
                      { name: 'model', type: CommandBuilder.NUMBER_PARAMETER },
                      { name: 'x', type: CommandBuilder.NUMBER_PARAMETER },
                      { name: 'y', type: CommandBuilder.NUMBER_PARAMETER },
                      { name: 'z', type: CommandBuilder.NUMBER_PARAMETER } ])
        .build(this.__proto__.attach.bind(this));

    // /pdetach
    server.commandManager.buildCommand('pdetach')
        .restrict(Player.LEVEL_MANAGEMENT)
        .parameters([ { name: 'player', type: CommandBuilder.PLAYER_PARAMETER } ])
        .build(this.__proto__.detach.bind(this));

    this.attachedObjects_ = new Map();

    server.playerManager.addObserver(this);
  }

  // Displays the number of FPS the server was able to handle since the last call to this command.
  serverFrameCounter(player) {
    let stats = global.frameCounter(),
        message = Message.format(Message.DEBUG_FRAME_COUNTER, stats.fps, stats.duration / 1000);

    player.sendMessage(message)
  }

  // Captures a trace for |seconds| (which must be in range of [0, 300]) and stores it to the
  // trace.log.[DMYHIS] file in the server's root directory.
  captureTrace(player, seconds) {
    if (typeof seconds !== 'number' || seconds < 0 || seconds > 300) {
      player.sendMessage(Message.DEBUG_TRACE_INVALID_TIME);
      return;
    }

    let date = new Date(),
        filename = 'trace.log.';

    filename += date.getUTCFullYear() + leftPad(date.getUTCMonth() + 1) + leftPad(date.getUTCDate());
    filename += leftPad(date.getUTCHours()) + leftPad(date.getUTCMinutes()) +
                leftPad(date.getUTCSeconds());

    global.startTrace();
    wait(seconds * 1000).then(() => {
      global.stopTrace(filename);

      if (player.isConnected())
        player.sendMessage(Message.DEBUG_TRACE_FINISHED);
    });

    player.sendMessage(Message.DEBUG_TRACE_STARTED);
  }

  // Plays |soundId| for all in-game players.
  playSound(player, soundId) {
    server.playerManager.forEach(p => p.playSound(soundId));
  }

  // Changes the interior of |player| to |id|.
  int(player, id) {
    player.interior = id;
  }

  // Has the player spectate their current position.
  cam(player) {
    player.setSpectating(true);

    const position = player.position;
    const camera = new Vector(position.x, position.y, position.z + 10);

    player.setCamera(camera, position);

    wait(5000).then(() => player.setSpectating(false));
  }

  // Evaluates the |command| on behalf of |player|.
  eval(player, command) {
    console.log('[JavaScript] Evaluating: ' + command);

    // Utility functions that are often used with the `/eval` command.
    const cm = server.commandManager;
    const fm = server.featureManager;
    const p = playerId => server.playerManager.getById(playerId);
    const vid = playerId => pawnInvoke('GetPlayerVehicleID', 'i', playerId);
    const v = playerId => server.playerManager.getById(playerId).vehicle;

    try {
      const output = '' + JSON.stringify(eval(command), null, '    ');
      const lines = output.split('\n');

      for (let i = 0; i < Math.min(8, lines.length); ++i) {
        player.sendMessage('>> ' + lines[i]);
      }

      if (lines.length > 8)
        player.sendMessage('>> Omitted ' + (lines.length - 8) + ' lines.');
    } catch (error) {
      player.sendMessage('>> ' + error.name + ': ' + error.message);
    }
  }

  // Lists the players who currently have minimized their game.
  idlers(player) {
    const idlers = [];

    for (const player of server.playerManager) {
      if (player.isMinimized())
        idlers.push(player.name);
    }

    if (!idlers.length)
      player.sendMessage('Nobody minimized their game.');
    else
      player.sendMessage('Minimized: ' + idlers.sort().join(', '));
  }

  // Called when the |player| disconnects from the server.
  onPlayerDisconnect(player) {
    if (!this.attachedObjects_.has(player))
      return;

    for (const objectId of this.attachedObjects_.get(player))
      pawnInvoke('DestroyObject', 'i', objectId);

    this.attachedObjects_.delete(player);
  }

  // Attaches the object with |modelId| to the |subject| at the given offset.
  attach(player, subject, modelId, x, y, z) {
    if (!this.attachedObjects_.has(subject))
      this.attachedObjects_.set(subject, new Set());

    const objectId = pawnInvoke('CreateObject', 'ifffffff', modelId, 0, 0, 0, 0, 0, 0, 0);
    this.attachedObjects_.get(subject).add(objectId);

    pawnInvoke('AttachObjectToPlayer', 'iiffffff', objectId, subject.id, x, y, z, 0, 0, 0);

    player.sendMessage('Done!');
  }

  // Removes all attached objects from the |subject|.
  detach(player, subject) {
    this.onPlayerDisconnect(subject);

    player.sendMessage('Done!');
  }

  dispose() {
    server.playerManager.removeObserver(this);

    for (const [player, objects] of this.attachedObjects_) {
      for (const objectId of objects)
        pawnInvoke('DestroyObject', 'i', objectId);
    }

    this.attachedObjects_.clear();
    this.attachedObjects_ = null;

    server.commandManager.removeCommand('serverfps')
    server.commandManager.removeCommand('trace')
    server.commandManager.removeCommand('sound')
    server.commandManager.removeCommand('int')
    server.commandManager.removeCommand('cam')
    server.commandManager.removeCommand('eval')
    server.commandManager.removeCommand('idlers')
    server.commandManager.removeCommand('pattach')
    server.commandManager.removeCommand('pdetach')
  }
}

exports = Debug;
