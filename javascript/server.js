// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

const ActorManager = require('entities/actor_manager.js');
const CommandManager = require('components/command_manager/command_manager.js');
const Database = require('components/database/database.js');
const FeatureManager = require('components/feature_manager/feature_manager.js');
const Natives = require('natives.js');
const ObjectManager = require('entities/object_manager.js');
const PlayerManager = require('entities/player_manager.js');
const VehicleManager = require('entities/vehicle_manager.js');

// The Server object is the global instance of the Las Venturas Playground run-time. It is globally
// available and exposes an interface that enables any aspect of the server to be changed.
class Server {
    constructor() {
        this.database_ = new Database();
        this.natives_ = new Natives();

        this.commandManager_ = new CommandManager();
        this.featureManager_ = new FeatureManager();

        this.actorManager_ = new ActorManager();
        this.objectManager_ = new ObjectManager();
        this.playerManager_ = new PlayerManager();
        this.vehicleManager_ = new VehicleManager();

        // TODO(Russell): The DialogManager should be owned by the Server instance.
    }

    // ---------------------------------------------------------------------------------------------

    // Gets the connection to the Las Venturas Playground database.
    get database() { return this.database_; }

    // ---------------------------------------------------------------------------------------------

    // Gets the global command manager that owns all commands available to players.
    get commandManager() { return this.commandManager_; }

    // Gets the feature manager, which is responsible for tracking all enabled features.
    get featureManager() { return this.featureManager_; }

    // ---------------------------------------------------------------------------------------------

    // Gets the global actor manager, responsible for all actors in the game.
    get actorManager() { return this.actorManager_; }

    // Gets the global object manager, responsible for all objects created in the game.
    get objectManager() { return this.objectManager_; }

    // Gets the global player manager that knows the details and whereabouts of all in-game players.
    get playerManager() { return this.playerManager_; }

    // Gets the vehicle manager that controls all vehicles on the server.
    get vehicleManager() { return this.vehicleManager_; }

    // ---------------------------------------------------------------------------------------------

    // Returns whether the Server instance is used to drive tests.
    isTest() { return false; }

    // ---------------------------------------------------------------------------------------------

    // Disposes and uninitializes the server object and all objects owned by it.
    dispose() {
        this.featureManager_.dispose();
        this.commandManager_.dispose();

        this.vehicleManager_.dispose();
        this.playerManager_.dispose();
        this.objectManager_.dispose();
        this.actorManager_.dispose();

        this.natives_.dispose();
        this.database_.dispose();
    }
}

exports = Server;

// The Server object is exposed on the global scope. It must, however, be instantiated manually when
// the test runner has finished verifying the state of the gamemode.
global.server = null;
