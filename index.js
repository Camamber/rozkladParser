const Strategy2 = require('./strategy2');
const Strategy1 = require('./strategy1');

const RozkladParserService = require('./services/rozkladParserService');
const rozkladParserService = new RozkladParserService();

const MysqlClient = require('./services/mysqlClient');
const mysqlClient = new MysqlClient('localhost', 3306, 'root', 'root', 'rozklad');


main()

async function main() {
    const strategy = new Strategy1(rozkladParserService, mysqlClient);
    
    if (process.argv.length > 2) {
        switch (process.argv[2]) {
            case 'parse:groups':
                await strategy.parseGroups();
                break;
            case 'parse:schedules':
                await strategy.parseSchedule();
                break;
            default:
                console.log('Comman not found');
                break;
        }
        mysqlClient.close()
    }
}
