/*
 *
 *
 *       Complete the API routing below
 *
 *
 */

"use strict";

var expect = require("chai").expect;
var MongoClient = require("mongodb");

//
var fetch = require("node-fetch");
var bodyParser = require("body-parser");

const CONNECTION_STRING = process.env.DB; //MongoClient.connect(CONNECTION_STRING, function(err, db) {});

module.exports = function(app) {
  app.route("/api/stock-prices").get(function(req, res) {
    // console.log(req.query);
    var ip = req.headers["x-forwarded-for"] || req.connection.remoteAddress;
    var newip = ip.substring(0, 13);
   // console.log(req.query);
    var obj = {};
    obj[newip] = true;

    //UPDATE FUNCTION
    function update(symbol) {
      MongoClient.connect(CONNECTION_STRING, function(err, db) {
        var dbo = db.db("stocksDB");
        dbo
          .collection("stocks")
          .findOneAndUpdate(
            { stock: symbol },
            { $addToSet: { ips: newip } },
            { returnOriginal: false, upsert: true },
            function(err, docs) {
              if (err) console.log(err);
              db.close();
            }
          );
      });
    }

    //ONE REQUEST
    if (Array.isArray(req.query.stock) == false) {
      fetch(
        "https://repeated-alpaca.glitch.me/v1/stock/" +
          req.query.stock +
          "/quote"
      )
        .then(function(res) {
          //console.log("fetch responses: " + res.statusText);
          return res.text();
        })
        .then(function(body) {
          var data = JSON.parse(body);

          console.log(req.query);

          MongoClient.connect(CONNECTION_STRING, function(err, db) {
            var dbo = db.db("stocksDB");
            dbo
              .collection("stocks")
              .findOne({ stock: data.symbol }, function(err, result) {
                //console.log(result);
                var count;

                if (result !== null) {
                  if (req.query.like !== undefined) {
                    if (result.ips.includes(newip)) {
                      count = result.ips.length;
                    } else {
                      count = result.ips.length + 1;
                    }
                  } else {
                    count = result.ips.length;
                  }
                } else {
                  if (req.query.like !== undefined) {
                    count = 1;
                  } else {
                    count = 0;
                  }
                }

                var stockData = {
                  stockData: {
                    stock: data.symbol,
                    price: data.latestPrice,
                    likes: count
                  }
                };
                //console.log()
                res.json(stockData);

                db.close;

                //ADD NEW IP DATABASE

                result == null ? (result = { ips: [] }) : "";

                if (
                  result.ips.includes(newip) !== true &&
                  req.query.like !== undefined
                ) {
                 // console.log("second phase");
                  update(data.symbol);
                }
              });
          });

          ///
        });
    } else {
      //SECOND REQUEST
      console.log(req.query);
      //console.log("we are going");
      fetch(
        "https://repeated-alpaca.glitch.me/v1/stock/" +
          req.query.stock[0] +
          "/quote"
      )
        .then(function(res) {
         // console.log("fetch responses #1: " + res.statusText);
          return res.text();
        })
        .then(function(body) {
          var dataOne = JSON.parse(body);

          //Fetch others request

          fetch(
            "https://repeated-alpaca.glitch.me/v1/stock/" +
              req.query.stock[1] +
              "/quote"
          )
            .then(function(res) {
              //console.log("fetch responses: #2" + res.statusText);
              return res.text();
            })
            .then(function(body) {
              var dataTwo = JSON.parse(body);
              //console.log(dataOne.symbol)
              //console.log(dataTwo.symbol)

              MongoClient.connect(CONNECTION_STRING, function(err, db) {
                var dbo = db.db("stocksDB");
                dbo
                  .collection("stocks")
                  .find({
                    $or: [{ stock: dataOne.symbol }, { stock: dataTwo.symbol }]
                  })
                  .toArray()
                  .then(function(result) {
                    //console.log(result);
                    var rel_likes = 0;

                    if (result.length == 2) {
                      rel_likes = result[0].ips.length - result[1].ips.length;
                    }

                    if (result.length == 1) {
                      if (result[0].stock == dataOne.symbol) {
                        rel_likes = result[0].ips.length;
                      } else {
                        rel_likes = result[0].ips.length * -1;
                      }
                    }

                    var stockDatas = {
                      stockData: [
                        {
                          stock: dataOne.symbol,
                          price: dataOne.latestPrice,
                          rel_likes: rel_likes
                        },
                        {
                          stock: dataTwo.symbol,
                          price: dataTwo.latestPrice,
                          rel_likes: rel_likes * -1
                        }
                      ]
                    };

                    res.json(stockDatas);
                    db.close;

                    result == null ? (result = [{ ips: [] }, { ips: [] }]) : "";
                    result[1] == null ? (result[1] = { ips: [] }) : "";

                    if (
                      result[0].ips.includes(newip) !== true &&
                      req.query.like !== undefined
                    ) {
                      update(dataOne.symbol);
                    }

                    if (
                      result[1].ips.includes(newip) !== true &&
                      req.query.like !== undefined
                    ) {
                      update(dataTwo.symbol);
                    }
                  });
              });
            });
        });
    }
  });
};
