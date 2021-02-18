const mysql = require('mysql2');

class MysqlClient {
    static CURRENT_TIMESTAMP = { toSqlString: function () { return 'CURRENT_TIMESTAMP()'; } };
    constructor(host, port, user, password, database) {
        this.connection = mysql.createConnection({
            host,
            port,
            user,
            password,
            database
        });
        
    }

    /**
     * 
     * @param {String} table 
     * @param {Object} data 
     */
    insert(table, data) {
        return this.query('INSERT INTO `' + table + '` SET ?', data)
    }

    query(query, params = []) {
        return new Promise((resolve, reject) => {
            this.connection.query(query, params,
                function (err, results) {
                    if (err) {
                        return reject(err)
                    }
                    return resolve(results);
                }
            );
        })

    }

    close() {
        return this.connection.destroy();
    }

}

module.exports = MysqlClient;