const request = require('request-promise');
const HTMLParser = require('fast-html-parser');
class RozkladParserService {

    fetchGroups(prefix) {
        return request({
            method: 'POST',
            url: 'http://rozklad.kpi.ua/Schedules/ScheduleGroupSelection.aspx/GetGroups',
            headers: {
                'Content-Type': 'application/json'
            },
            proxy: 'http://88.99.188.238:5566',
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
            url: 'http://rozklad.kpi.ua/Schedules/ScheduleGroupSelection.aspx',
            headers: {
                'Origin': 'http://rozklad.kpi.ua',
                'Content-Type': 'application/x-www-form-urlencoded',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/84.0.4147.135 Safari/537.36',
                'Referer': 'http://rozklad.kpi.ua/Schedules/ScheduleGroupSelection.aspx'
            },
            form: {
                '__VIEWSTATE': '/wEMDAwQAgAADgEMBQAMEAIAAA4BDAUDDBACAAAOAgwFBwwQAgwPAgEIQ3NzQ2xhc3MBD2J0biBidG4tcHJpbWFyeQEEXyFTQgUCAAAADAUNDBACAAAOAQwFAQwQAgAADgEMBQ0MEAIMDwEBBFRleHQBG9Cg0L7Qt9C60LvQsNC0INC30LDQvdGP0YLRjAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALVdjzppTCyUtNVSyV7xykGQzHz2',
                '__EVENTTARGET': '',
                '__EVENTARGUMENT': '',
                'ctl00$MainContent$ctl00$txtboxGroup': group,
                'ctl00$MainContent$ctl00$btnShowSchedule': 'Розклад+занять',
                '__EVENTVALIDATION': '/wEdAAEAAAD/////AQAAAAAAAAAPAQAAAAUAAAAIsA3rWl3AM+6E94I5Tu9cRJoVjv0LAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAHfLZVQO6kVoZVPGurJN4JJIAuaU'
            },
            proxy: 'http://88.99.188.238:5566'
            // transform: body => HTMLParser.parse(body)
        })
            .then(body => {
                const document = HTMLParser.parse(body);
                const links = document.querySelectorAll('table a');
                return links.map(link => ({ title: link.text, uuid: link.attributes.href.replace('ViewSchedule.aspx?g=', '') }))
            })
            .catch(error => {
                if (error.statusCode == 302) {
                    const scheduleId = error.response.headers.location.replace('/Schedules/ViewSchedule.aspx?g=', '')
                    return [{ title: group, uuid: scheduleId }]
                }
                return []
            })
    }


    async fetchSchedule(uuid) {
        const document = await request({
            method: 'GET',
            url: 'http://rozklad.kpi.ua/Schedules/ViewSchedule.aspx?g=' + uuid,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0.4183.102 Safari/537.36',
                'Referer': 'http://rozklad.kpi.ua/Schedules/ScheduleGroupSelection.aspx',

            },
            formData: {
                '__EVENTTARGET': 'ctl00$MainContent$ddlSemesterType',
                'ctl00$MainContent$ddlSemesterType': '2',
                '__EVENTVALIDATION': '/wEdAAEAAAD/////AQAAAAAAAAAPAQAAAAYAAAAIsA3rWl3AM+6E94I5ke7WZqDu1maj7tZmCwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAANqZqakPTbOP2+koNozn1gOvqUEW'
            },
            proxy: 'http://88.99.188.238:5566',
            transform: body => HTMLParser.parse(body)
        });

        const weekTables = document.querySelectorAll('table');
        const weeks = weekTables.map(this.parseWeekTable)

        return weeks
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


}

module.exports = RozkladParserService;