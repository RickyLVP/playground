// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

// A pickup is an object spawned in the world that can be picked up by players, upon which an action
// should occur. Pickups can be created for any valid object Id in San Andreas: Multiplayer.
class Pickup {
    constructor(manager, modelId, type, position, virtualWorld, respawnDelay) {
        this.manager_ = manager;

        this.modelId_ = modelId;
        this.type_ = type;
        this.position_ = position;
        this.virtualWorld_ = virtualWorld;
        this.respawnDelay_ = respawnDelay;

        this.respawning_ = false;
        this.id_ = pawnInvoke('CreatePickup', 'iifffi', modelId, type, position.x, position.y,
                              position.z, virtualWorld);

        if (this.id_ == -1)
            console.log('[Pickup] Failed to create a pickup with model Id ' + modelId +'.');
    }

    // Gets the id assigned to this pickup by the SA-MP server.
    get id() { return this.id_; }

    // Returns whether the pickup still exists on the server.
    isConnected() { return this.id_ !== null || this.respawning_; }

    // Returns whether the pickup is in process of being respawned.
    isRespawning() { return this.respawning_; }

    // Gets the model Id used to present this pickup.
    get modelId() { return this.modelId_; }

    // Gets the type of this pickup, which defines its behaviour.
    get type() { return this.type_; }

    // Gets the position of this pickup in the world.
    get position() { return this.position_; }

    // Gets the Virtual World in which this pickup will appear.
    get virtualWorld() { return this.virtualWorld_; }

    // Gets the respawn delay for the pickup after it has been picked up. A respawn delay of -1
    // means that the pickup will never be automatically removed.
    get respawnDelay() { return this.respawnDelay_; }

    // Schedules the pickup to respawn after the given respawn delay. Should only be called by the
    // PickupManager, as this adds additional functionality on top of SA-MP features.
    async scheduleRespawn() {
        pawnInvoke('DestroyPickup', 'i', this.id_);

        this.respawning_ = true;
        this.id_ = null;

        await seconds(this.respawnDelay_);

        if (!this.isConnected())
            return;  // the pickup has been disposed of since

        this.respawning_ = false;
        this.id_ = pawnInvoke('CreatePickup', 'iifffi', this.modelId_, this.type_, this.position_.x,
                              this.position_.y, this.position_.z, this.virtualWorld_);

        if (this.id_ == -1) {
            console.log('[Pickup] Failed to recreate a pickup with model Id ' + modelId +'.');
            return;
        }

        this.manager_.didRecreatePickup(this);
    }

    // Disposes of the pickup, and removes it from the server.
    dispose() {
        if (!this.respawning_) {
            pawnInvoke('DestroyPickup', 'i', this.id_);

            this.manager_.didDisposePickup(this);
        }

        this.manager_ = null;

        this.respawning_ = false;
        this.id_ = null;
    }
}

// Pickups of this type will not disappear, nor will trigger default effects.
Pickup.TYPE_PERSISTENT = 1;

// Pickups of this type can only be picked up with a vehicle. Will disappear automatically.
Pickup.TYPE_VEHICLE = 14;

// Expose the Pickup object globally since it is an entity.
global.Pickup = Pickup;
