"use-strict";

const ER_LOCK_WAIT_TIMEOUT = 1205;
const ER_LOCK_TIMEOUT = 1213;
const ER_LOCK_DEADLOCK = 1213;

function proxyQuery(
  connection,
  retries,
  minMillis,
  maxMillis,
  debug = false,
  show_all_errors = false
) {
  retries = Number.isInteger(retries) ? retries : 5;
  minMillis = Number.isInteger(minMillis) ? minMillis : 1;
  maxMillis = Number.isInteger(maxMillis) ? maxMillis : 100;

  let config = {};
  if (connection.config.connectionConfig) {
    config = connection.config.connectionConfig;
    delete config.pool;
  } else {
    config = connection.config;
  }

  const pQueryFunc = connection.query;

  connection.query = function (sql, values, callback) {
    if (typeof values === "function") {
      callback = values;
      values = [];
    }

    let retry_copy = retries || 1;

    const handleResponse = function (err, rows) {
      if (
        err &&
        (+err.errno === +ER_LOCK_WAIT_TIMEOUT ||
          +err.errno === +ER_LOCK_TIMEOUT ||
          +err.errno === +ER_LOCK_DEADLOCK)
      ) {
        if (debug) {
          console.error(`ERROR - ${err.errno} ${err.message}`);
        }
        if (!--retry_copy) {
          if (debug) {
            console.error(`Out of retries so just returning the error.`);
          }
          return callback(err, rows);
        }
        const sleepMillis = Math.floor(Math.random() * maxMillis + minMillis);

        if (debug) {
          console.log(
            "Retrying request with",
            retry_copy,
            "retries left. Timeout",
            sleepMillis
          );
        }
        return setTimeout(function () {
          pQueryFunc.apply(connection, [sql, values, handleResponse]);
        }, sleepMillis);
      } else if (err && show_all_errors) {
        if (debug) {
          console.error(`Standard error - ${err.toString()}`);
        }
      }
      return callback(err, rows);
    };

    pQueryFunc.apply(connection, [sql, values, handleResponse]);
  };
}

module.exports = proxyQuery;
