const request = require("request");
const moment = require("moment");
moment.locale("th");

module.exports = {
  saveKeyin: (db, data, task) => {
    var sql = `INSERT INTO parcel_keyin_data(uid, ref, barcode, owner, phone_number, operator_id, raw_data, record_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    var data = [data.uid, data.ref, data.barcode, data.owner, data.phone_number, data.operator_id.replace("+", ""), JSON.stringify(task), new Date()];

    return new Promise(function (resolve, reject) {
      db.query(sql, data, (err, results) => {
        resolve(results);
      });
    });
  },
  checkKeyinTrackingTemp: (db, data, task) => {
    var sqlSaveKeyIn = `INSERT INTO parcel_keyin_data(uid, ref, barcode, owner, phone_number, operator_id, raw_data, record_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    var dataSaveKeyIn = [data.uid, data.ref, data.barcode, data.owner, data.phone_number, data.operator_id.replace("+", ""), JSON.stringify(task), new Date()];

    var sqlCheckKeyInTemp = `SELECT barcode FROM parcel_keyin_data_temp WHERE barcode = ?`;
    var dataCheckKeyInTemp = [data.barcode];

    var sqlSaveKeyInTemp = `INSERT INTO parcel_keyin_data_temp(uid, ref, barcode, owner, phone_number, operator_id, raw_data, record_created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    var dataSaveKeyInTemp = [data.uid, data.ref, data.barcode, data.owner, data.phone_number, data.operator_id.replace("+", ""), JSON.stringify(task), new Date()];

    var sqlUpdateKeyInTemp = `UPDATE parcel_keyin_data_temp SET uid = ?, ref = ?, barcode = ?, owner = ?, phone_number = ?, operator_id = ?, raw_data = ?, record_created_at = ? WHERE barcode = ?`;
    var dataUpdateKeyInTemp = [data.uid, data.ref, data.barcode, data.owner, data.phone_number, data.operator_id.replace("+", ""), JSON.stringify(task), new Date(), data.barcode];

    return new Promise(function (resolve, reject) {
      db.query(sqlSaveKeyIn, dataSaveKeyIn, (err_key, results_key) => {
        if (err_key == null) {
          db.query(sqlCheckKeyInTemp, dataCheckKeyInTemp, (err_check_temp, results_check_temp) => {
            if (err_check_temp == null) {
              if (results_check_temp.length > 0) {
                db.query(sqlUpdateKeyInTemp, dataUpdateKeyInTemp, (err_update_temp, results_update_temp) => {
                  resolve(true);
                });
              } else {
                db.query(sqlSaveKeyInTemp, dataSaveKeyInTemp, (err_save_temp, results_save_temp) => {
                  resolve(true);
                });
              }
            } else {
              console.log("err_check_temp", err_check_temp);
              resolve(false);
            }
          });
        } else {
          console.log("err_key", err_key);
          resolve(false);
        }
      })

    });
  },
  getAmphurAndDistrictAndProvince: (db, label_district_code) => {
    var sql = `SELECT d.DISTRICT_NAME,a.AMPHUR_NAME,p.PROVINCE_NAME 
          FROM postinfo_zipcodes z 
          JOIN postinfo_district d ON z.district_code=d.DISTRICT_CODE 
          JOIN postinfo_amphur a ON d.AMPHUR_ID=a.AMPHUR_ID 
          JOIN postinfo_province p ON d.PROVINCE_ID=p.PROVINCE_ID 
          WHERE z.district_code = ?`;
    var data = [label_district_code];

    return new Promise(function (resolve, reject) {
      db.query(sql, data, (err, results) => {
        if (err === null) {
          resolve(results);
        } else {
          resolve(false);
        }
      });
    });
  },
  checkDataReceiver: (db, data, data_address) => {
    let address = data_address[0];

    let sqlCheckReceiver = `SELECT tracking FROM billing_receiver_info WHERE tracking = ?`;
    var dataCheckReceiver = [data.barcode];

    var cod_value = (data.label_cod_value == null || data.label_cod_value == "" || data.label_cod_value == undefined) ? 0 : parseInt(data.label_cod_value);

    let sqlUpdateReceiver = `UPDATE billing_receiver_info SET parcel_type=?, cod_value=?,receiver_name=?, phone=?, receiver_address=?, district_id=?, district_name=?, amphur_id=?, amphur_name=?, province_id=?, province_name=?, zipcode=?, remark=?, created_at=? WHERE tracking = ? AND status is null`;
    let dataUpdateReceiver = [
      data.label_parcel_type.toUpperCase(),
      cod_value,
      data.label_name,
      data.label_phone_number,
      data.label_address,
      data.label_district_id,
      address.DISTRICT_NAME,
      data.label_amphur_id,
      address.AMPHUR_NAME,
      data.label_province_id,
      address.PROVINCE_NAME,
      data.label_zipcode,
      "KEYIN",
      new Date(),
      data.barcode
    ];

    let sqlSaveReceiver = `INSERT INTO billing_receiver_info(tracking, parcel_type, cod_value, receiver_name, phone, receiver_address, district_id, district_name, amphur_id, amphur_name, province_id, province_name, zipcode, remark, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,?)`;
    let dataSaveReceiver = [
      data.barcode,
      data.label_parcel_type.toUpperCase(),
      cod_value,
      data.label_name,
      data.label_phone_number,
      data.label_address,
      data.label_district_id,
      address.DISTRICT_NAME,
      data.label_amphur_id,
      address.AMPHUR_NAME,
      data.label_province_id,
      address.PROVINCE_NAME,
      data.label_zipcode,
      "KEYIN",
      new Date()
    ];

    return new Promise(function (resolve, reject) {
      db.query(sqlCheckReceiver, dataCheckReceiver, (err_check_receiver, results_check_receiver) => {
        if (err_check_receiver === null) {
          if (results_check_receiver.length <= 0) {
            db.query(sqlSaveReceiver, dataSaveReceiver, (err_save_receiver, results_save_receiver) => {
              resolve(true);
            });
          } else {
            db.query(sqlUpdateReceiver, dataUpdateReceiver, (err_update_receiver, results_update_receiver) => {
              resolve(true);
            });
          }
        } else {
          resolve(false);
        }
      });
    });
  },
  checkDataCaptureConsume: (db, ref, owner, phoneNumber, imageUrl, imagePath, code, rawData) => {
    var sql = "SELECT barcode FROM parcel_capture_data WHERE barcode=?";
    var data = [code];

    var sqlCapture = "INSERT INTO parcel_capture_data(ref, owner, phone_number, barcode, image_url, image_path, record_created_at, raw_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)";
    var dataCapture = [ref, owner, phoneNumber, code, imageUrl, imagePath, new Date(), rawData];

    return new Promise(function (resolve, reject) {
      db.query(sql, data, (err_capture, res_capture) => {
        if (err_capture == null) {
          if (res_capture.length <= 0) {
            db.query(sqlCapture, dataCapture, (err_save_capture, res_save_capture) => {
              if (err_save_capture == null) {
                if (res_save_capture.affectedRows > 0) {
                  resolve(true);
                } else {
                  console.log("cannot save capture data = %s", code);
                  resolve(false);
                }
              } else {
                console.log("error save capture", err_save_capture);
                resolve(false);
              }
            });
          } else {
            console.log("existed capture data = %s", code);
            resolve(false);
          }
        } else {
          console.log("error check capture", err_capture);
          resolve(false);
        }
      });
    });
  },
  saveDataCaptureBillingReceiverInfo: (db, code) => {
    var sqlCheckReceiver = `SELECT tracking FROM billing_receiver_info WHERE tracking=?`;
    var dataReceiver = [code];

    var sqlReceiver = `INSERT INTO billing_receiver_info(tracking) VALUES (?)`;
    var dataCode = [code];

    return new Promise(function (resolve, reject) {
      db.query(sqlCheckReceiver, dataReceiver, (err_receiver, result_receiver) => {
        if (err_receiver == null) {
          if (result_receiver.length <= 0) {
            db.query(sqlReceiver, dataCode, (err_save_receiver, result_save_receiver) => {
              if (err_save_receiver == null) {
                if (result_save_receiver.affectedRows > 0) {
                  resolve(true);
                } else {
                  resolve(false);
                }
              } else {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  },
  saveDataAutoLabel: (db, data) => {
    var sqlCheckAutoLabel = `SELECT * FROM parcel_auto_label WHERE tracking=?`;
    var dataCheckAutoLabel = [data.code];

    var patternPhone = /06|08|09\d{8}/;
    var rawData = data.label_address;

    let text = (rawData).trim();
    let rawDataStr = removeCharacter(text);
    var foundPhone = rawDataStr.search(patternPhone);

    var tracking = data.code;
    var parcelType = (rawDataStr.search(("COD").toLowerCase()) == -1 && rawDataStr.search("ปลายทาง") == -1) ? "NORMAL" : "COD";

    var receiverPhone = foundPhone !== -1 ? rawDataStr.substring(foundPhone, foundPhone + 10) : "0000";

    var sqlSaveAutoLabel = `INSERT INTO parcel_auto_label(tracking, raw_data, parcel_type, receiver_phone, create_at) VALUES (?, ?, ?, ?, ?)`;
    var dataAutoLabel = [tracking, rawData, parcelType, receiverPhone, new Date()];

    return new Promise(function (resolve, reject) {
      db.query(sqlCheckAutoLabel, dataCheckAutoLabel, (errCheckAutoLabel, resultCheckAutoLabel) => {
        if (errCheckAutoLabel == null) {
          if (resultCheckAutoLabel.length <= 0) {
            db.query(sqlSaveAutoLabel, dataAutoLabel, (errSaveAutoLabel, resultSaveAutoLabel) => {
              if (errSaveAutoLabel == null) {
                if (resultSaveAutoLabel.affectedRows > 0) {
                  resolve(true);
                } else {
                  resolve(false);
                }
              } else {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  },
  checkDataAutoLabel: (db, data, dataAddress) => {
    var sqlCheckAutoLabel = `SELECT * FROM parcel_auto_label WHERE tracking = ?`;
    var dataCheckAutoLabel = [data.barcode];

    var sqlUpdateAutoLabel = `UPDATE parcel_auto_label SET cod_value = ?, zipcode = ? WHERE tracking = ?`;

    return new Promise(function (resolve, reject) {
      db.query(sqlCheckAutoLabel, dataCheckAutoLabel, (errCheckAutoLabel, resultCheckAutoLabel) => {
        if (errCheckAutoLabel == null) {
          if (resultCheckAutoLabel.length > 0) {
            let text = (resultCheckAutoLabel[0].raw_data).trim();
            let rawDataStr = removeCharacter(text);

            var cod_value = (rawDataStr.search(data.label_cod_value) !== -1) ? data.label_cod_value : 0;
            var zipcode = (rawDataStr.search(data.label_zipcode) !== -1) ? data.label_zipcode : "000";

            var dataUpdateAutoLabel = [cod_value, zipcode, data.barcode];
            db.query(sqlUpdateAutoLabel, dataUpdateAutoLabel, (errUpdateAutoLabel, resultUpdateAutoLabel) => {
              if (errUpdateAutoLabel == null) {
                if (resultUpdateAutoLabel.affectedRows > 0) {
                  resolve(true);
                } else {
                  resolve(false);
                }
              } else {
                resolve(false);
              }
            });
          } else {
            resolve(null);
          }
        } else {
          resolve(false);
        }
      });
    });
  },
  saveDataBillingItem: (db, code) => {
    var sqlCheckBillingItem = `SELECT tracking FROM billing_item WHERE tracking=?`;
    var dataBillingItem = [code];

    var sqlSaveBillingItem = "INSERT INTO billing_item(tracking) VALUES (?)"
    var dataItem = [code];

    return new Promise(function (resolve, reject) {
      db.query(sqlCheckBillingItem, dataBillingItem, (err_item, result_item) => {
        if (err_item == null) {
          if (result_item.length <= 0) {
            db.query(sqlSaveBillingItem, dataItem, (err_save_item, result_save_item) => {
              if (err_save_item == null) {
                if (result_save_item.affectedRows > 0) {
                  resolve(true);
                } else {
                  resolve(false);
                }
              } else {
                resolve(false);
              }
            });
          } else {
            resolve(false);
          }
        } else {
          resolve(false);
        }
      });
    });
  },
  checkDataCapture: (db, ref, owner, phoneNumber, imageUrl, imagePath, code, rawData) => {
    var sql = "SELECT barcode FROM parcel_capture_data WHERE barcode=?"

    var sqlCapture = "INSERT INTO parcel_capture_data(ref,owner,phone_number,barcode,image_url,image_path,record_created_at,raw_data) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    var dataCapture = [ref, owner, phoneNumber, code, imageUrl, imagePath, new Date(), rawData];

    var sqlCheckReceiver = `SELECT tracking FROM billing_receiver_info WHERE tracking=?`;
    // var dataReceiver = [code];

    var sqlSaveReceiver = "INSERT INTO billing_receiver_info(tracking) VALUES (?)"
    var data = [code];

    return new Promise(function (resolve, reject) {
      db.query(sql, data, (err, results) => {
        console.log("capture = %s", code);
        if (err === null) {
          if (results.length <= 0) {

            db.query(sqlCapture, dataCapture, (err, results) => { });

            db.query(sqlCheckReceiver, data, (err_check_receiver, results_check_receiver) => {
              if (err_check_receiver == null) {
                if (results_check_receiver.length <= 0) {
                  db.query(sqlSaveReceiver, data, (err, results) => { });
                }
              }
            });
          }
        }
      });
    })
  },
  checkTypeBilling: (db, data) => {
    let sqlBillingItem = `SELECT * FROM billing_item WHERE tracking = ?`;

    return new Promise(function (resolve, reject) {
      db.query(sqlBillingItem, [data.tracking], (err, results) => {
        if(err == null){
          if(results.length > 0) {
            if(results[0].source == "QUICKQUICK"){
              resolve(true);
            } else {
              resolve(null);
            }
          } else {
            resolve(null);
          }
        } else {
          resolve(false);
        }
      });
    });
  },
};

function removeCharacter(text) {
  var newText = "";
  text = text.replace(/^[<br>]*/g, '');

  for (i = 0; i < text.length; i++) {
    if (text[i] == "-") {
      newCha = text[i].replace('-', '');
      newText += newCha;
    } else if (text[i] == " ") {
      newCha = text[i].replace(' ', '');
      newText += newCha;
    } else if (text[i] == ":") {
      newCha = text[i].replace(':', '');
      newText += newCha;
    } else if (text[i] == "?") {
      newCha = text[i].replace('?', '');
      newText += newCha;
    } else {
      newText += text[i];
    }
  }

  return newText;
}
