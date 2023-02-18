const shajs = require('sha.js')
const MysqlClient = require('./services/mysqlClient');
const alphabet1 = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'І', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Я'];
const alphabet2 = ['А', 'Б', 'В', 'Г', 'Д', 'Е', 'Ж', 'З', 'І', 'К', 'Л', 'М', 'Н', 'О', 'П', 'Р', 'С', 'Т', 'У', 'Ф', 'Х', 'Ц', 'Я'];

class Strategy1 {

    constructor(rozkladParserService, mysqlClient) {
        this.rozkladParserService = rozkladParserService
        this.mysqlClient = mysqlClient
    }

    async parseGroups() {
        const groupNames = [];

        console.time('fetchGroups');
        let k = 0;
        for (const i of alphabet1) {
            for (const j of alphabet2) {
                const prefix = i + j;
                const groups = await this.rozkladParserService.fetchGroups(prefix);
                groupNames.push(...groups);
                console.log(prefix, groups.length, ++k, '/', alphabet1.length * alphabet2.length)
            }
        }
        console.timeEnd('fetchGroups');

        const parsedGroups = [];

        console.time('fetchIds');
        const SIZE = 10
        for (let i = 0; i < groupNames.length; i += SIZE) {
            const chunk = groupNames.slice(i, i + SIZE);
            const groups = await Promise.all(chunk.map(async (groupName) => this.rozkladParserService.fetchIds(groupName)))
                .then(groups => groups.flat());
            parsedGroups.push(...groups);
            console.log(JSON.stringify(chunk), i, '/', groupNames.length)
        }
        console.timeEnd('fetchIds');

        const groups = await this.mysqlClient.query('SELECT * FROM `groups`');
        for (const parsedGroup of parsedGroups) {
            if (!groups.find(group => group.uuid == parsedGroup.uuid)) {
                await this.mysqlClient.insert('groups', [{ ...parsedGroup, created_at: new Date(), updated_at: new Date() }])
                console.log('[INSERTED]', JSON.stringify(parsedGroup));
            }
        }
        console.log('prased')
    }

    async parseSchedule() {
        console.time('fetchSchedule');

        const groups = await this.mysqlClient.query(
            `SELECT groups.id, 
                uuid, 
                schedules.id as schedule_id, 
                schedules.hash as schedule_hash 
            FROM \`groups\` 
            LEFT OUTER JOIN schedules ON groups.id = schedules.group_id 
            ORDER BY id`
        )
        // .then(rows => rows.filter(row => !row.schedule_id));

        const SEMESTER = 2;
        const SIZE = 10
        for (let i = 0; i < groups.length; i += SIZE) {
            const chunk = groups.slice(i, i + SIZE);
            await Promise.all(chunk.map(async (group) => {
                const schedule = await this.rozkladParserService.fetchSchedule(group.uuid, SEMESTER).catch(err => {
                    console.log('[ERROR]', group.id, group.uuid, err.message)
                    return null;
                });
                if (schedule && schedule.length && ((schedule[0].length && schedule[1].length) || schedule.length > 2)) {
                    const json = JSON.stringify(schedule.reverse());
                    const hash = shajs('sha256').update(json).digest('hex');
                    if (group.schedule_id) {
                        if (hash != group.schedule_hash) {
                            await this.mysqlClient.query('UPDATE `schedules` SET `schedule` = ?, hash = ?, `updated_at` = ? WHERE `id` = ?', [json, hash, MysqlClient.CURRENT_TIMESTAMP, group.schedule_id])
                            console.log('[UPDATED]', group.id, group.uuid)
                        }
                    } else {
                        await this.mysqlClient.insert('schedules', { schedule: json, hash, semester: SEMESTER, group_id: group.id, created_at: new Date(), updated_at: new Date() })
                        console.log('[INSERTED]', group.id, group.uuid)
                    }
                }
            }))
            console.log(i, '/', groups.length)
        }

        console.timeEnd('fetchSchedule');
    }
}

module.exports = Strategy1;