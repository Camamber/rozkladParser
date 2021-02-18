const shajs = require('sha.js')

const RozkladParserService = require('./services/rozkladParserService');
const rozkladParserService = new RozkladParserService();

const MysqlClient = require('./services/mysqlClient');
const mysqlClient = new MysqlClient('sr.kpi.ua', 3306, 'studradakpiua', 'qZCxVTqg#d2fH', 'studradakpiua');

main()

async function main() {
    if (process.argv.length > 2) {
        switch (process.argv[2]) {
            case 'parse:groups':
                await parseGroups();
                break;
            case 'parse:schedule':
                await parseSchedule();
                break;
            default:
                console.log('Comman not found');
                break;
        }
        mysqlClient.close()
    }
}


async function parseGroups() {
    const groupNames = [];
    console.time('fetchGroups');
    for (let i = 1040; i <= 1071; i++) {
        for (let j = 1040; j <= 1071; j++) {
            const prefix = String.fromCharCode(i) + String.fromCharCode(j);
            const groups = await rozkladParserService.fetchGroups(prefix);
            groupNames.push(...groups);
            console.log(prefix, groups.length, (i - 1040) * (1071 - 1040) + (j - 1040), '/', (1071 - 1040) * (1071 - 1040))
        }
    }
    console.timeEnd('fetchGroups');

    const parsedGroups = [];
    console.time('fetchIds');
    let i = 0;
    for (const groupName of groupNames) {
        const groups = await rozkladParserService.fetchIds(groupName);
        parsedGroups.push(...groups);
        console.log(groupName, ++i, '/', groupNames.length)
    }
    console.timeEnd('fetchIds');

    const groups = await mysqlClient.query('SELECT * FROM `groups`');
    for (const parsedGroup of parsedGroups) {
        if (!groups.find(group => group.uuid == parsedGroup.uuid)) {
            mysqlClient.insert('groups', [{ ...parsedGroup, created_at: new Date(), updated_at: new Date() }])
        }
    }
    return true

}

async function parseSchedule() {
    console.time('fetchSchedule');
    const groups = await mysqlClient.query(
        `SELECT groups.id, 
            uuid, 
            schedules.id as schedule_id, 
            schedules.hash as schedule_hash 
        FROM \`groups\` 
        LEFT OUTER JOIN schedules ON groups.id = schedules.group_id 
        ORDER BY id`
    );

    for (const group of groups) {
        const schedule = await rozkladParserService.fetchSchedule(group.uuid).catch(err => {
            console.log('[ERROR]', group.id, group.uuid, err.message)
            return null;
        });
        if (schedule && schedule.length && schedule[0].length && schedule[1].length) {
            const json = JSON.stringify(schedule);
            const hash = shajs('sha256').update(json).digest('hex');
            if (group.schedule_id) {
                if (hash != group.schedule_hash) {
                    mysqlClient.query('UPDATE `schedules` SET `schedule` = ?, hash = ?, `updated_at` = ? WHERE `id` = ?', [json, hash, MysqlClient.CURRENT_TIMESTAMP, group.schedule_id])
                    console.log('[UPDATED]', group.id, group.uuid)
                }
            } else {
                mysqlClient.insert('schedules', { schedule: json, hash, semester: 2, group_id: group.id, created_at: new Date(), updated_at: new Date() })
                console.log('[INSERTED]', group.id, group.uuid)
            }
        }
    }

    console.timeEnd('fetchSchedule');
}

