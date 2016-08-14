// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

// Query to load the locations at which houses can be created from the database.
const LOAD_LOCATIONS_QUERY = `
    SELECT
        house_location_id,
        entrance_x,
        entrance_y,
        entrance_z
    FROM
        houses_locations
    WHERE
        location_removed IS NULL`;

// Query to load the parking lots associated with the house locations.
const LOAD_PARKING_LOTS_QUERY = `
    SELECT
        houses_parking_lots.house_parking_lot_id,
        houses_parking_lots.house_location_id,
        houses_parking_lots.position_x,
        houses_parking_lots.position_y,
        houses_parking_lots.position_z,
        houses_parking_lots.rotation
    FROM
        houses_parking_lots
    LEFT JOIN
        houses_locations ON houses_locations.house_location_id = houses_parking_lots.house_location_id
    WHERE
        houses_parking_lots.parking_lot_removed IS NULL AND
        houses_locations.location_removed IS NULL`;

// Query to load the house details from the database.
const LOAD_HOUSES_QUERY = `
    SELECT
        houses_settings.house_id,
        houses_settings.house_location_id,
        houses_settings.house_user_id,
        houses_settings.house_interior_id,
        users.username
    FROM
        houses_settings
    LEFT JOIN
        houses_locations ON houses_locations.house_location_id = houses_settings.house_location_id
    LEFT JOIN
        users ON users.user_id = houses_settings.house_user_id
    WHERE
        houses_settings.house_removed IS NULL AND
        houses_locations.location_removed IS NULL`;

// Query to create a new house location in the database.
const CREATE_LOCATION_QUERY = `
    INSERT INTO
        houses_locations
        (entrance_x, entrance_y, entrance_z, location_creator_id, location_created)
    VALUES
        (?, ?, ?, ?, NOW())`;

// Query to create a new parking lot associated with a location in the database.
const CREATE_PARKING_LOT_QUERY = `
    INSERT INTO
        houses_parking_lots
        (house_location_id, position_x, position_y, position_z, rotation, parking_lot_creator_id, parking_lot_created)
    VALUES
        (?, ?, ?, ?, ?, ?, NOW())`;

// Query to create a new set of house settings in the database.
const CREATE_HOUSE_QUERY = `
    INSERT INTO
        houses_settings
        (house_location_id, house_user_id, house_interior_id, house_created)
    VALUES
        (?, ?, ?, NOW())`;

// Query to remove a previously created location from the database.
const REMOVE_LOCATION_QUERY = `
    UPDATE
        houses_locations
    SET
        location_removed = NOW()
    WHERE
        house_location_id = ?`;

// Query to remove a previously created parking lot from the database.
const REMOVE_PARKING_LOT_QUERY = `
    UPDATE
        houses_parking_lots
    SET
        parking_lot_removed = NOW()
    WHERE
        house_parking_lot_id = ?`;

// Query to remove a previously created house from the database.
const REMOVE_HOUSE_QUERY = `
    UPDATE
        houses_settings
    SET
        house_removed = NOW()
    WHERE
        house_id = ?`;

// Defines the database interactions for houses that are used for loading, updating and removing
// persistent data associated with them.
class HouseDatabase {
    // Loads the existing house locations from the database, and asynchronously returns them.
    async loadLocations() {
        let parkingLots = new Map();
        let locations = [];

        // (1) Load the parking lots from the database.
        {
            const data = await server.database.query(LOAD_PARKING_LOTS_QUERY);
            data.rows.forEach(parkingLot => {
                const locationId = parkingLot.house_location_id;
                const position =
                    new Vector(parkingLot.position_x, parkingLot.position_y, parkingLot.position_z);

                if (!parkingLots.has(locationId))
                    parkingLots.set(locationId, []);

                parkingLots.get(locationId).push({
                    id: parkingLot.house_parking_lot_id,
                    position: position,
                    rotation: parkingLot.rotation
                });
            });
        }

        // (2) Load the location information itself from the database.
        {
            const data = await server.database.query(LOAD_LOCATIONS_QUERY);
            data.rows.forEach(location => {
                const locationId = location.house_location_id;
                const position =
                    new Vector(location.entrance_x, location.entrance_y, location.entrance_z);

                locations.push({
                    id: locationId,
                    position: position,
                    parkingLots: parkingLots.get(locationId) || []
                });
            });
        }
        return locations;
    }

    // Loads the existing houses, including their settings and interior details, from the database.
    async loadHouses() {
        const data = await server.database.query(LOAD_HOUSES_QUERY);
        const houses = new Map();

        data.rows.forEach(row => {
            houses.set(row.house_location_id, {
                id: row.house_id,

                ownerId: row.house_user_id,
                ownerName: row.username,

                interiorId: row.house_interior_id
            });
        });

        return houses;
    }

    // Creates a new house location at |position| created by the |player|.
    async createLocation(player, position) {
        const data = await server.database.query(
            CREATE_LOCATION_QUERY, position.x, position.y, position.z, player.userId);

        return data.insertId;
    }

    // Creates a new database entry for the |parkingLot| associated with the |location|.
    async createLocationParkingLot(player, location, parkingLot) {
        const position = parkingLot.position;
        const data = await server.database.query(
            CREATE_PARKING_LOT_QUERY, location.id, position.x, position.y, position.z,
            parkingLot.rotation, player.userId);

        return data.insertId;
    }

    // Creates a new house in the database trying |interiorId| to |location|, owned by |player|.
    async createHouse(player, location, interiorId) {
        const data = await server.database.query(
            CREATE_HOUSE_QUERY, location.id, player.userId, interiorId);

        return {
            id: data.insertId,

            ownerId: player.userId,
            ownerName: player.name,

            interiorId: interiorId
        };
    }

    // Removes the |location| from the database.
    async removeLocation(location) {
        await server.database.query(REMOVE_LOCATION_QUERY, location.id);
    }

    // Removes the |parkingLot| from the database.
    async removeLocationParkingLot(parkingLot) {
        await server.database.query(REMOVE_PARKING_LOT_QUERY, parkingLot.id);
    }

    // Removes the house tied to |location| from the database.
    async removeHouse(location) {
        await server.database.query(REMOVE_HOUSE_QUERY, location.settings.id);
    }
}

exports = HouseDatabase;
