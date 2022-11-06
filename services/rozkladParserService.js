const request = require('request-promise');
const HTMLParser = require('fast-html-parser');
const PROXY = 'http://lum-customer-c_275eb0df-zone-static:ewll4pzkeqe7@zproxy.lum-superproxy.io:22225';
// const PROXY = 'http://88.99.188.238:5577';

class RozkladParserService {

    fetchGroups(prefix) {
        return request({
            method: 'POST',
            url: 'http://epi.kpi.ua/Schedules/ScheduleGroupSelection.aspx/GetGroups',
            headers: {
                'Content-Type': 'application/json'
            },
            proxy: PROXY,
            json: { "prefixText": prefix, "count": 100 }
        })
            .then(response => response.d || [])
            .catch(err => {
                console.log(err);
                return []
            });

    }

    fetchIds(group) {
        return request({
            method: 'POST',
            followRedirect: false,
            followAllRedirects: false,
            url: 'http://epi.kpi.ua/Schedules/ScheduleGroupSelection.aspx',
            headers: {
                'Origin': 'http://epi.kpi.ua',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36',
                'Referer': 'http://epi.kpi.ua/Schedules/ScheduleGroupSelection.aspx'
            },
            form: {
                '__VIEWSTATE': '/wEMDAwQAgAADgEMBQAMEAIAAA4BDAUDDBACAAAOAgwFBwwQAgwPAgEIQ3NzQ2xhc3MBD2J0biBidG4tcHJpbWFyeQEEXyFTQgUCAAAADAUNDBACAAAOAQwFAQwQAgAADgEMBQ0MEAIMDwEBBFRleHQBG9Cg0L7Qt9C60LvQsNC0INC30LDQvdGP0YLRjAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALVdjzppTCyUtNVSyV7xykGQzHz2',
                '__EVENTTARGET': '',
                '__EVENTARGUMENT': '',
                'ctl00$MainContent$ctl00$txtboxGroup': group,
                'ctl00$MainContent$ctl00$btnShowSchedule': 'Розклад+занять',
                '__EVENTVALIDATION': '/wEdAAEAAAD/////AQAAAAAAAAAPAQAAAAUAAAAIsA3rWl3AM+6E94I5Tu9cRJoVjv0LAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHfLZVQO6kVoZVPGurJN4JJIAuaU'
            },
            proxy: PROXY
            // transform: body => HTMLParser.parse(body)
        })
            .then(body => {
                const document = HTMLParser.parse(body);
                const links = document.querySelectorAll('table a');
                return links.map(link => ({ title: link.text, uuid: link.attributes.href.replace('ViewSchedule.aspx?g=', '') }))
            })
            .catch(error => {
                if (error.statusCode == 302 && error.response.headers.location.includes('ViewSchedule.aspx?g=')) {
                    const scheduleId = error.response.headers.location.replace('/Schedules/ViewSchedule.aspx?g=', '')
                    return [{ title: group, uuid: scheduleId }]
                } else {
                    console.log(error.message)
                }
                return []
            })
    }


    async fetchSchedule(uuid, semester) {
        const document = await request({
            method: 'POST',
            url: 'http://epi.kpi.ua/Schedules/ViewSchedule.aspx?g=' + uuid,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36',
                'Referer': 'http://epi.kpi.ua/Schedules/ScheduleGroupSelection.aspx',

            },
            formData: {
                '__EVENTTARGET': 'ctl00$MainContent$ddlSemesterType',
                'ctl00$MainContent$ddlSemesterType': `${semester}`,
                '__EVENTVALIDATION': '/wEdAAEAAAD/////AQAAAAAAAAAPAQAAAAYAAAAIsA3rWl3AM+6E94I5ke7WZqDu1maj7tZmCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANqZqakPTbOP2+koNozn1gOvqUEW'
            },
            proxy: PROXY,
            transform: body => HTMLParser.parse(body)
        });

        const isWeekly = document.querySelector('#ctl00_MainContent_lblFirstTable')
        if (isWeekly) {
            const weekTables = document.querySelectorAll('table');
            const weeks = weekTables.map(this.parseWeekTable)
            return weeks
        } else {
            const daysTable = document.querySelector('table')
            const lessons = this.parseDaysTable(daysTable)

            return lessons;
        }
    }


    /**
     * 
     * @param {HTMLElement} weekTable 
     */
    parseWeekTable(weekTable) {
        const week = [];

        const rows = weekTable.querySelectorAll('tr');
        for (let i = 1; i < rows.length; i++) {
            const rowDays = rows[i].querySelectorAll('td');

            const rawTime = rowDays[0].childNodes[2].text;
            for (let j = 1; j < rowDays.length; j++) {
                const lesson = { teacher: {} };
                if (!rowDays[j].childNodes.length) {
                    continue;
                }

                lesson['time'] = rawTime;
                let tmp = rowDays[j].querySelectorAll('a');
                if (tmp && tmp.length) {
                    for (let k = 0; k < tmp.length; k++) {
                        const href = tmp[k].attributes['href'];
                        if (href.indexOf('wiki.kpi.ua') >= 0) {
                            lesson['full_name'] = tmp[k].attributes['title'];
                            lesson['short_name'] = tmp[k].text;
                        } else if (href.indexOf('Schedules') >= 0) {
                            lesson['teacher']['full_name'] = tmp[k].attributes['title'];
                            lesson['teacher']['short_name'] = tmp[k].text;
                        } else if (href.indexOf('maps.google.com') >= 0) {
                            lesson['type'] = tmp[k].text;
                        }
                    }
                }
                if (!week[j - 1]) week[j - 1] = [];
                week[j - 1].push(lesson);
            }
        }
        return week;
    }

    /**
     * 
     * @param {HTMLElement} daysTable 
     */
    parseDaysTable(daysTable) {
        const lessons = [];
        const rows = daysTable.querySelectorAll('tr');

        let day = null;
        for (let i = 0; i < rows.length; i++) {
            const td = rows[i].querySelectorAll('td');
            if (!td[0].text && td[1].text) {
                day = td[1].text;
                continue;
            }

            if (td[0].text && td[1].text) {
                const lesson = { teacher: {} };
                lesson['time'] = td[0].lastChild.text;
                lesson['day'] = day;

                let tmp = td[1].querySelectorAll('a');
                if (tmp && tmp.length) {
                    for (let k = 0; k < tmp.length; k++) {
                        const href = tmp[k].attributes['href'];
                        if (href.indexOf('wiki.kpi.ua') >= 0) {
                            lesson['full_name'] = tmp[k].attributes['title'];
                            lesson['short_name'] = tmp[k].text;
                        } else if (href.indexOf('Schedules') >= 0) {
                            lesson['teacher']['full_name'] = tmp[k].attributes['title'];
                            lesson['teacher']['short_name'] = tmp[k].text;
                        } else if (href.indexOf('maps.google.com') >= 0) {
                            lesson['type'] = tmp[k].text;
                        }
                    }
                }
                lessons.push(lesson);
            }

        }

        return lessons
    }


    fetchGroups2() {
        return request({
            method: 'GET',
            url: 'https://schedule.kpi.ua/api/schedule/groups',
            json: true
        }).then(r => r.data)
    }

    async fetchSchedule2(uuid) {
        const data = await request({
            method: 'GET',
            url: 'https://schedule.kpi.ua/api/schedule/lessons?groupId=' + uuid,
            json: true
        }).then(r => r.data);

        const first = data.scheduleFirstWeek.map(this.mapDay)
        const second = data.scheduleSecondWeek.map(this.mapDay)

        return [first, second];
    }

    mapDay(day) {
        if (!day.pairs.length) {
            return null
        }

        return day.pairs.map(pair => ({
            teacher: {
                full_name: pair.teacherName,
                short_name: pair.teacherName
            },
            time: pair.time,
            full_name: pair.name,
            short_name: pair.name,
            type: (pair.place ? (pair.place + ' ') : '') + pair.type
        }))
    }


}

module.exports = RozkladParserService;