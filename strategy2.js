const shajs = require('sha.js')

class Strategy2 {

    constructor(rozkladParserService, mysqlClient) {
        this.rozkladParserService = rozkladParserService
        this.mysqlClient = mysqlClient
    }

    async parseGroups() {
        console.time('fetchGroups');
        const parsedGroups = await this.rozkladParserService.fetchGroups2().map(item => ({ uuid: item.id, title: item.name }));
        console.timeEnd('fetchGroups');


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

        const SEMESTER = 1;
        const SIZE = 10
        for (let i = 0; i < groups.length; i += SIZE) {
            const chunk = groups.slice(i, i + SIZE);
            await Promise.all(chunk.map(async (group) => {
                const schedule = await this.rozkladParserService.fetchSchedule2(group.uuid).catch(err => {
                    console.log('[ERROR]', group.id, group.uuid, err.message)
                    return null;
                });
                if (schedule && schedule.length && schedule[0].length && schedule[1].length) {
                    const json = JSON.stringify(schedule);
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

module.exports = Strategy2;