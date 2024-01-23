require('newrelic');
const request = require("request");
const express = require("express");

const port = process.env.PORT || 3000;
const parcelService = require("./service/parcelService.js");

const app = express();
app.use(express.json());
app.use(express.static("public"));

app.use(function (req, res, next) {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "Content-Type");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, PATCH, DELETE");
  next();
});

const AMQP_PREFIX = "crowdkey";
const MY_AMQP_PREFIX = process.env.MY_AMQP_PREFIX || "parcel";

var EXCHANGE_TASK_CREATE = AMQP_PREFIX + ".exchange.notify.task-create";
var EXCHANGE_NOTIFY_PREPARE_DATA_SERVICE = AMQP_PREFIX + ".exchange.notify.prepare-data-service";

var MY_EXCHANGE_PREPARE_BOOKING = MY_AMQP_PREFIX + ".exchange.prepare-booking";
var MY_EXCHANGE_CHECK_QUICKQUICK = MY_AMQP_PREFIX + ".exchange.check-quickquick";
var MY_EXCHANGE_PICK_TRACKING = MY_AMQP_PREFIX + ".exchange.picking-tracking";

var QUEUE_CAPTURE = MY_AMQP_PREFIX + ".queue.submit-capture";
var QUEUE_KEYIN = MY_AMQP_PREFIX + ".queue.submit-address";
var QUEUE_PICK_TRACKING = MY_AMQP_PREFIX + ".queue.picking-tracking";
var QUEUE_CHECK_AUTO_LABEL = MY_AMQP_PREFIX + ".queue.check-autolabel";

var error_capture_queue = MY_AMQP_PREFIX + ".queue.capture.error";
var error_keyin_queue = MY_AMQP_PREFIX + ".queue.keyin.error";
var error_pick_tracking_queue = MY_AMQP_PREFIX + ".queue.picking-tracking.error";
var error_check_auto_queue = MY_AMQP_PREFIX + ".queue.check-autolable.error";

const initDb = require("./shared/db");
const initAmqp = require("./shared/amqp");

function submitCapture(appCtx, task) {
  const db = appCtx.db;
  const amqpChannel = appCtx.amqpChannel;

  let rawData = JSON.stringify(task);
  let data = task;

  let ref = data.ref;
  let dataType = data.dataType;
  let owner = data.owner;
  let phoneNumber = data.phoneNumber;

  return new Promise(function (resolve, reject) {

    if (dataType === 'MOBILE_CAPTURE_IMAGE') {
      if (data.barcodes !== undefined) {
        let barcodes = data.barcodes;
        codes = {};
        barcodes.forEach(value => {
          if (!(value.code in codes)) {
            codes[String(value.code)] = value;
          }
        });
        var objCodes = Object.values(codes);

        let saveItem = async () => {
          await objCodes.forEach(async val => {
            let imageUrl = val.imageUrl;
            let imagePath = val.imagePath;
            let code = val.code;
            console.log("save capture = %s", code);
            await parcelService.checkDataCapture(db, ref, owner, phoneNumber, imageUrl, imagePath, code, rawData);
          });
          return true;
        };
        saveItem().then(result => {
          resolve(result)
        });
      } else {
        let barcode = data.barcode;

        let code = barcode.code;
        let imageUrl = barcode.imageUrl;
        let imagePath = barcode.imagePath;
        console.log("save capture = %s", code);
        parcelService.checkDataCaptureConsume(db, ref, owner, phoneNumber, imageUrl, imagePath, code, rawData).then(data => {
          if (data) {
            parcelService.saveDataCaptureBillingReceiverInfo(db, code).then(data_receiver => {
              if (data_receiver) {
                resolve(data_receiver);
              } else {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        });
      }
    } else if (dataType === 'API_JSON_TEXT') {
      let barcode = data.barcode;

      let code = barcode.code;
      let imageUrl = barcode.label_address; //ใช้ข้อมูลที่ลูกค้ากรอก มาใส่แทน imageUrl
      let imagePath = "";

      if (code == undefined) {
        console.log("no barcode API_JSON_TEXT");
        resolve(false);
      } else {
        console.log("save capture API_JSON_TEXT = %s", code);

        parcelService.checkDataCaptureConsume(db, ref, owner, phoneNumber, imageUrl, imagePath, code, rawData).then(data => {
          console.log("result check capture API_JSON_TEXT = %s", data);
          if (data) {
            parcelService.saveDataCaptureBillingReceiverInfo(db, code).then(data_receiver => {
              console.log("result save receiver info API_JSON_TEXT = %s", data_receiver);
              if (data_receiver) {
                parcelService.saveDataAutoLabel(db, barcode).then(data_autolabel => {
                  console.log("result save auto label = %s", data_autolabel);
                  resolve(data_autolabel);
                });
              } else {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        });
      }
    } else {
      resolve(null);
    }
  })
}

function submitCrowdkeyAddress(appCtx, task) {
  const db = appCtx.db;
  const amqpChannel = appCtx.amqpChannel;

  let data = task[0];

  console.log("key In for barcode : %s", data.barcode);
  return new Promise(function (resolve, reject) {
    parcelService.checkKeyinTrackingTemp(db, data, task).then(function (res_key) {
      if (res_key) {
        parcelService.getAmphurAndDistrictAndProvince(db, data.label_district_code).then(function (dataAddress) {
          parcelService.checkDataReceiver(db, data, dataAddress).then(function (dataReceiver) {
            if (dataReceiver) {
              parcelService.checkDataAutoLabel(db, data, dataAddress).then(function (dataAutoLabel) {
                if(dataAutoLabel == false) {
                  resolve(false);
                } else {
                  let dataToQueue = {
                    tracking: data.barcode,
                    source: 'KEY_IN'
                  };
                  amqpChannel.publish(MY_EXCHANGE_PICK_TRACKING, "", Buffer.from(JSON.stringify(dataToQueue)), { persistent: true });
                  resolve(true);
                }
              });
            } else {
              resolve(false);
            }
          });
        });
      } else {
        resolve(false)
      }
    });
  });
}

function pickTracking(appCtx, task) {
  const db = appCtx.db;
  const amqpChannel = appCtx.amqpChannel;

  let tracking = task.tracking;
  console.log("picking tracking = %s", tracking);
  return new Promise(function (resolve, reject) {
    parcelService.checkTypeBilling(db, task).then(function (result) {
      if (result == false) {
        resolve(false);
      } else {
        if (result) {
          amqpChannel.publish(MY_EXCHANGE_CHECK_QUICKQUICK, "", Buffer.from(JSON.stringify(task)), { persistent: true });
          resolve({ tracking: tracking, status: result, type: "check-quickquick" });
        } else {
          amqpChannel.publish(MY_EXCHANGE_PREPARE_BOOKING, "", Buffer.from(JSON.stringify(task)), { persistent: true });
          resolve({ tracking: tracking, status: result, type: "prepare-booking" });
        }
      }
    });
  });
}

Promise.all([initDb(), initAmqp()]).then(values => {
  const appCtx = {
    db: values[0],
    amqpChannel: values[1]
  };
  channel = appCtx.amqpChannel;
  channel.prefetch(1);

  require('./routers/healthz')(app, appCtx);
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /* CAPTURE QUEUE */
  channel.checkExchange(EXCHANGE_TASK_CREATE, "fanout", { durable: true });
  channel.assertQueue(QUEUE_CAPTURE, { durable: true });
  channel.assertQueue(error_capture_queue, { durable: true });
  channel.bindQueue(QUEUE_CAPTURE, EXCHANGE_TASK_CREATE);
  console.log("Started");

  channel.consume(QUEUE_CAPTURE, async function (msg_capture) {
    task_capture = JSON.parse(msg_capture.content.toString());
    // console.log("Got task QUEUE_CAPTURE", task_capture);
    try {
      let result = await submitCapture(appCtx, task_capture);
      console.log("result_capture = %s", result);
      if (result !== null) {
        channel.ack(msg_capture);
      } else {
        channel.sendToQueue(error_capture_queue, Buffer.from(JSON.stringify(task_capture)));
        channel.ack(msg_capture);
      }

    } catch (error) {
      console.log("error_capture = %s", error);
      channel.sendToQueue(error_capture_queue, Buffer.from(JSON.stringify(task_capture)));
      channel.ack(msg_capture);
    }
  });
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /* KEYIN QUEUE */
  channel.checkExchange(EXCHANGE_NOTIFY_PREPARE_DATA_SERVICE, "fanout", { durable: true });
  channel.assertQueue(QUEUE_KEYIN, { durable: true });
  channel.assertQueue(error_keyin_queue, { durable: true });
  channel.bindQueue(QUEUE_KEYIN, EXCHANGE_NOTIFY_PREPARE_DATA_SERVICE);
  console.log("Started");
  channel.consume(QUEUE_KEYIN, async function (msg_keyin) {
    task_keyin = JSON.parse(msg_keyin.content.toString());
    // console.log("Got task QUEUE_KEYIN", task_keyin);
    try {
      let result = await submitCrowdkeyAddress(appCtx, task_keyin)
      console.log("result_keyin = %s", result);
      if (result) {
        channel.ack(msg_keyin);
      } else {
        channel.sendToQueue(error_keyin_queue, Buffer.from(JSON.stringify(task_keyin)));
        channel.ack(msg_keyin);
      }
    } catch (error) {
      console.log("error_keyin = %s", error);
      channel.sendToQueue(error_keyin_queue, Buffer.from(JSON.stringify(task_keyin)));
      channel.ack(msg_keyin);
    }
  });
  ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
  /* PICK TRACKING QUEUE */
  channel.checkExchange(MY_EXCHANGE_PICK_TRACKING, "fanout", { durable: true });
  channel.assertQueue(QUEUE_PICK_TRACKING, { durable: true });
  channel.assertQueue(error_pick_tracking_queue, { durable: true });
  channel.bindQueue(QUEUE_PICK_TRACKING, MY_EXCHANGE_PICK_TRACKING);
  console.log("Started");
  channel.consume(QUEUE_PICK_TRACKING, async function (msg) {
    task = JSON.parse(msg.content.toString());
    // console.log("Got task QUEUE_PICK_TRACKING", task);
    try {
      let result = await pickTracking(appCtx, task);
      console.log("result pick tracking %s to %s", result.tracking, result.type);

      if(result.status == undefined){
        channel.sendToQueue(error_pick_tracking_queue, Buffer.from(JSON.stringify(task)));
        channel.ack(msg);
      } else {
        channel.ack(msg);
      }
    } catch (error) {
      console.log("error picking queue = %s", error);
      channel.sendToQueue(error_pick_tracking_queue, Buffer.from(JSON.stringify(task)));
      channel.ack(msg);
    }
  });
})
  .then()
  .catch(console.warn);
  app.listen(port, () => console.log(`listening on port ${port}!`));
