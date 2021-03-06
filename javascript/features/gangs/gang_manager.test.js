// Copyright 2016 Las Venturas Playground. All rights reserved.
// Use of this source code is governed by the MIT license, a copy of which can
// be found in the LICENSE file.

const Gang = require('features/gangs/gang.js');
const GangDatabase = require('features/gangs/gang_database.js');
const GangManager = require('features/gangs/gang_manager.js');
const MockGangDatabase = require('features/gangs/test/mock_gang_database.js');

describe('GangManager', (it, beforeEach, afterEach) => {
    // The GangManager instance to use for the tests. Will be reset after each test.
    let gangManager = null;

    beforeEach(() => {
        gangManager = new GangManager(null /* database */);
        gangManager.database_ = new MockGangDatabase();
    });

    afterEach(() => gangManager.dispose());

    it('should be able to announce something to gang members', assert => {
        const gunther = server.playerManager.getById(0 /* Gunther */);
        const russell = server.playerManager.getById(1 /* Russell */);

        assert.isNull(gangManager.gangForPlayer(gunther));

        gunther.identify({ userId: MockGangDatabase.HKO_LEADER_USER_ID,
                           gangId: MockGangDatabase.HKO_GANG_ID });

        // The database result will be loaded through a promise, continue the test asynchronously.
        return Promise.resolve().then(() => {
            const gang = gangManager.gangForPlayer(gunther);
            assert.isNotNull(gang);

            gangManager.announceToGang(gang, russell, 'Hello, members!');

            assert.equal(gunther.messages.length, 1);
            assert.equal(gunther.messages[0],
                         Message.format(Message.GANG_ANNOUNCE_INTERNAL, 'Hello, members!'));

            assert.isFalse(gang.hasPlayer(russell));
            assert.isNull(gangManager.gangForPlayer(russell));
            assert.equal(russell.messages.length, 0);
        });
    });

    it('should create a gang and make the player its leader', assert => {
        const player = server.playerManager.getById(0 /* Gunther */);
        assert.isNotNull(player);

        player.identify({ userId: MockGangDatabase.CC_LEADER_USER_ID });

        return gangManager.createGangForPlayer(player, 'CC', 'name', 'goal').then(gang => {
            assert.equal(gang.id, MockGangDatabase.CC_GANG_ID);
            assert.equal(gang.tag, 'CC');
            assert.equal(gang.name, 'name');
            assert.equal(gang.goal, 'goal');

            assert.isTrue(gang.hasPlayer(player));

            assert.equal(gang.memberCount, 1);
        });
    });

    it('should refuse to create a gang when it causes ambiguity', assert => {
        const player = server.playerManager.getById(0 /* Gunther */);
        assert.isNotNull(player);

        player.identify({ userId: MockGangDatabase.CC_LEADER_USER_ID });

        return gangManager.createGangForPlayer(player, 'HKO', 'name', 'goal').then(
            () => assert.unexpectedResolution(),
            () => true /* the promise rejected due to ambiguity */);

    });

    it('should be able to purchase additional encryption time for the gang', async(assert) => {
        const player = server.playerManager.getById(0 /* Gunther */);
        assert.isNotNull(player);

        player.identify({ userId: MockGangDatabase.CC_LEADER_USER_ID });

        const gang = await gangManager.createGangForPlayer(player, 'CC', 'name', 'goal');
        assert.isNotNull(gang);

        assert.isTrue(gang.hasPlayer(player));
        assert.equal(gang.getPlayerRole(player), Gang.ROLE_LEADER);

        assert.equal(gang.chatEncryptionExpiry, 0);

        await gangManager.updateChatEncryption(gang, player, 3600 /* an hour */);
        assert.closeTo(
            gang.chatEncryptionExpiry, (server.clock.currentTime() / 1000) + 3600, 5); // 1 hour

        await gangManager.updateChatEncryption(gang, player, 7200 /* two hours */);
        assert.closeTo(
            gang.chatEncryptionExpiry, (server.clock.currentTime() / 1000) + 10800, 5); // 3 hours
    });

    it('should be able to update member preferences in regards to gang color', assert => {
        const player = server.playerManager.getById(0 /* Gunther */);
        assert.isNotNull(player);

        assert.isNull(gangManager.gangForPlayer(player));

        player.identify({ userId: MockGangDatabase.HKO_LEADER_USER_ID,
                          gangId: MockGangDatabase.HKO_GANG_ID });

        // The database result will be loaded through a promise, continue the test asynchronously.
        return Promise.resolve().then(() => {
            const gang = gangManager.gangForPlayer(player);

            assert.isTrue(gang.hasPlayer(player));
            assert.isTrue(gang.usesGangColor(player));
            assert.isNotNull(player.gangColor);

            return gangManager.updateColorPreference(gang, player, false).then(() => {
                assert.isFalse(gang.usesGangColor(player));
                assert.isNull(player.gangColor);
            });
        });
    });

    it('should respect member color preferences when they connect to the server', assert => {
        const player = server.playerManager.getById(0 /* Gunther */);
        assert.isNotNull(player);

        assert.isNull(gangManager.gangForPlayer(player));

        player.identify({ userId: MockGangDatabase.HKO_MEMBER_USER_ID,
                          gangId: MockGangDatabase.HKO_GANG_ID });

        // The database result will be loaded through a promise, continue the test asynchronously.
        return Promise.resolve().then(() => {
            const gang = gangManager.gangForPlayer(player);

            assert.isNotNull(gang);

            assert.isFalse(gang.usesGangColor(player));
            assert.isNull(player.gangColor);
        });
    });

    it('should load and unload gang data on connectivity events', assert => {
        const player = server.playerManager.getById(0 /* Gunther */);
        assert.isNotNull(player);

        assert.isNull(gangManager.gangForPlayer(player));

        player.identify({ userId: MockGangDatabase.HKO_LEADER_USER_ID,
                          gangId: MockGangDatabase.HKO_GANG_ID });

        // The database result will be loaded through a promise, continue the test asynchronously.
        return Promise.resolve().then(() => {
            const gang = gangManager.gangForPlayer(player);

            assert.isNotNull(gang);
            assert.equal(gang.tag, 'HKO');

            assert.isTrue(gang.hasPlayer(player));

            assert.isTrue(gang.usesGangColor(player));
            assert.isNotNull(player.gangColor);

            player.disconnect();

            assert.isFalse(gang.hasPlayer(player));
            assert.isNull(gangManager.gangForPlayer(player));
        });
    });

    it('should issue events to attached observers when membership changes', async(assert) => {
        const gunther = server.playerManager.getById(0 /* Gunther */);
        gunther.identify();

        assert.isNull(gangManager.gangForPlayer(gunther));

        let joinedUserCount = 0;
        let leftUserCount = 0;

        class MyObserver {
            onUserJoinGang(userId, gangId) {
                joinedUserCount++;
            }

            onUserLeaveGang(userId, gangId) {
                leftUserCount++;
            }
        }

        const observer = new MyObserver();

        // Events should be issued when a player joins or leaves a gang.
        gangManager.addObserver(observer);

        assert.equal(joinedUserCount, 0);
        assert.equal(leftUserCount, 0);

        await gangManager.createGangForPlayer(gunther, 'CC', 'name', 'goal');
        assert.isNotNull(gangManager.gangForPlayer(gunther));

        assert.equal(joinedUserCount, 1);
        assert.equal(leftUserCount, 0);

        await gangManager.removePlayerFromGang(gunther, gangManager.gangForPlayer(gunther));
        assert.isNull(gangManager.gangForPlayer(gunther));

        assert.equal(joinedUserCount, 1);
        assert.equal(leftUserCount, 1);

        // Events should no longer be issued after an observer has been removed.
        gangManager.removeObserver(observer);

        await gangManager.createGangForPlayer(gunther, 'CC', 'name', 'goal');
        assert.isNotNull(gangManager.gangForPlayer(gunther));

        assert.equal(joinedUserCount, 1);
        assert.equal(leftUserCount, 1);
    });

    it('should be able to convert to and from member roles', assert => {
        assert.equal(GangDatabase.toRoleValue('Leader'), Gang.ROLE_LEADER);
        assert.equal(GangDatabase.toRoleValue('Manager'), Gang.ROLE_MANAGER);
        assert.equal(GangDatabase.toRoleValue('Member'), Gang.ROLE_MEMBER);

        assert.throws(() => GangDatabase.toRoleValue('Glorious Leader'));

        assert.equal(GangDatabase.toRoleString(Gang.ROLE_LEADER), 'Leader');
        assert.equal(GangDatabase.toRoleString(Gang.ROLE_MANAGER), 'Manager');
        assert.equal(GangDatabase.toRoleString(Gang.ROLE_MEMBER), 'Member');

        assert.throws(() => GangDatabase.toRoleString(42 /* Glorious Leader?? */));
    });
});
