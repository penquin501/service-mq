const express = require("express");
const router = express.Router();
const moment = require("moment");
// const m = require("moment-timezone");
const request = require("request");
const os = require('os');

const MY_AMQP_PREFIX = process.env.MY_AMQP_PREFIX || "parcel";
var QUEUE_HEALTH = MY_AMQP_PREFIX + ".queue.health.consume." + os.hostname();

module.exports = function (app, appCtx) {
    const db = appCtx.db;
    const channel = appCtx.amqpChannel;
    var healthzCheck = 0;

    router.get("/", async function (req, res) {
        getHealthz();
        let connectdb = await connectSql(db);
        if (connectdb.code == 'ECONNREFUSED') {
            return res.status(500).send("Internal server error");
        } else {
            return res.json({ statusCode: res.statusCode, healthzCheck: healthzCheck });
        }
    });
    /****************************************************************************************************************/
    channel.assertQueue(QUEUE_HEALTH, { exclusive: true });
    console.log("Started %s", QUEUE_HEALTH);
    channel.consume(QUEUE_HEALTH, async function (msg) {
        task = JSON.parse(msg.content.toString());
        // console.log("task", task);
        try {
            console.log("%s task = %s, health = %d", QUEUE_HEALTH, task.ts, healthzCheck);
            healthzCheck = task.ts;

            channel.ack(msg);
        } catch (error) {
            throw new Error('%s Internal server error', QUEUE_HEALTH, error);
            // throw new HttpException('Internal server error', 500);
        }
    });

    setInterval(async () => {
        console.log("healthz setInterval %s", QUEUE_HEALTH);
        await channel.sendToQueue(QUEUE_HEALTH, Buffer.from(JSON.stringify({ ts: new Date().getTime() })));
    }, 5000);
    /****************************************************************************************************************/
    function getHealthz() {
        const FIVE_MINUTE = 5 * 1000; /* ms */
        const now = new Date().getTime();
        const last = healthzCheck;
        const result = now - last;
        console.log("%s getHealthz (%s-%s) result = %s ", QUEUE_HEALTH, now, last, result);
        if (now - last > FIVE_MINUTE * 1.5 && healthzCheck != 0) {
            throw new Error('Internal server error', 500);
        }
        return {
            ts: last
        };
    }

    app.use("/healthz", router);
};

function connectSql(db) {
    let sql = `SELECT 1`;

    return new Promise(function (resolve, reject) {
        db.query(sql, (error, result, fields) => {
            if (error == null) {
                resolve(true);
            } else {
                console.log(error);
                resolve(error);
            }
        });
    });
}