'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var firebaseAPI = require(__dirname+'/private/files/firebase.json');
var colors = require('colors'); //Colored Console Ouput ;)

//Scrapers
var request = require('request');
var cheerio = require('cheerio');

//Something to help with asynchronous scraping
//I am sure there is a more elegant solution than
//a global variables, but I am tired right now...
var canMoveToNextAthlete = false;
var canMoveToNextEvent = false;

//Firebase Admin Edition
var admin = require("firebase-admin");

var currentYear = new Date().getFullYear();  //Originally const, but if I leave the server running the year could change
var dataSourceUrl = "http://butedock.demon.co.uk/cgs/event_list.php?year="+currentYear+"&country=World";

//PREPARE BOOTSTRAP STATIC LINK
app.use('/bootstrap', express.static(__dirname+'/node_modules/bootstrap'));
//PREPARE STATIC FILES FOR DISTRIBUTION
app.use('/static', express.static(__dirname + '/public'));

app.set('views', __dirname + '/views');
app.set('view engine', 'jade');

//CHANGE LATER, HERE FOR C9
var port = process.env.PORT;
http.listen(port,function(){
    console.log("The process is running on port:"+port);
});

//SETUP FIREBASE ADMIN ACCOUNT
admin.initializeApp({
  credential: admin.credential.cert(__dirname+"/private/files/fantasy-croquet-firebase-adminsdk-xyf6j-2ce6e507c9.json"),
  databaseURL: "https://fantasy-croquet.firebaseio.com"
});

//HOME ROUTE--
//      Should be what the user sees when they first arrive on the website
app.get("/",function(req,res){
    res.render("home.jade",{firebaseAPIData: JSON.stringify(firebaseAPI)});
    scrapeSite();
});

////////////////////////////////////////////////////////////////////////////////
//                                                                            //
//                     Firebase Data Updating Methods                         //
//                                                                            //
////////////////////////////////////////////////////////////////////////////////

//Get the required data from the database and update firebase;
//Won't do anything if up to date already, so feel free to call whenever
function scrapeSite(){
    currentYear = new Date().getFullYear();
    dataSourceUrl = "http://butedock.demon.co.uk/cgs/event_list.php?year="+currentYear+"&country=World";
    
    request(dataSourceUrl, function(error, response, html) {
        if(!error){
            var $ = cheerio.load(html);
            
            var amtOfEvents = $('a').first().text().trim();
            var eventRef = admin.database().ref("statistics/"+currentYear+"/events");
            var savedEvents;
            eventRef.once("value")
              .then(function(snapshot) {
                savedEvents = snapshot.child("amount").val();
                if(savedEvents==null){
                    eventRef.child("amount").set(0);
                    savedEvents = 0;
                }
                if((savedEvents*1) < (amtOfEvents*1)){
                    canMoveToNextEvent = true;
                    moveToNextEvent(((savedEvents*1)+1),amtOfEvents*1); //TODO: ADD IN CHECK TO SEE IF SOMEONE ELSE ALREADY ACTIVATED UPDATE
                }
              }
            );
            
        } else {
            console.log('ERROR: Could not properly scrape data site!!! PANICKING!!!'.bold.red);
        }
    });
}

//Helper method that would never get called for any user needs.
//Just to assist with asynchronous scraping
function runNextEventUpdate(index){
    scrapeEventPage("http://butedock.demon.co.uk/cgs/event.php?y="+currentYear+"&e="+index);
}

//Another helper method for ansynchronous player updating
function moveToNextEvent(index,final){
    if(canMoveToNextEvent){
        if(index<final){
            console.log("Running next event");
            runNextEventUpdate(index);
            canMoveToNextEvent = false;
            index++;
            setTimeout(moveToNextEvent,500,index,final);
        }
    } else {
        setTimeout(moveToNextEvent,500,index,final);
    }
}

//Get Wins/Losses of players in tournaments from URL
function scrapeEventPage(url){
    request(url, function(error,response,html) {
       if(!error){
            var $ = cheerio.load(html);

            canMoveToNextAthlete = true;
            moveToNextAthlete($, html, 0, $('a').length);
        } else {
            var log = 'ERROR: Could not properly scrape event page'+url;
            console.log(log.bold.red);
        }
    });
}

//Helper method that would never get called for any user needs.
//Just to assist with asynchronous scraping
function runNextPlayerUpdate($,html,i){
    var currPlayer = $('a').eq(i);
    var newWins = currPlayer.parent().siblings().eq(2).text().trim()*1;
    var newLosses = currPlayer.parent().siblings().eq(3).text().trim()*1;
    var playerRef = admin.database().ref("statistics/"+currentYear+"/players/"+currPlayer.text());
    canMoveToNextAthlete = true;
    playerRef.once("value").then(function(snapshot) {
        var wins = snapshot.child("wins").val();
        var losses = snapshot.child("losses").val();
        if(wins == null){
            playerRef.child("wins").set(0);
            wins = 0;
        }
        if(losses == null){
            playerRef.child("losses").set(0);
            losses = 0;
        }
        playerRef.child("wins").set((wins*1)+newWins);
        playerRef.child("losses").set((losses*1)+newLosses);
        
        canMoveToNextAthlete = true;
    });
}

//Another helper method for ansynchronous player updating
function moveToNextAthlete($,html,index,final){
    if(canMoveToNextAthlete){
        if(index<final){
            runNextPlayerUpdate($,html,index)
            canMoveToNextAthlete = false;
            index++;
            setTimeout(moveToNextAthlete,500,$,html,index,final)
        } else {
            var eventRef = admin.database().ref("statistics/"+currentYear+"/events");
            eventRef.once("value").then(function(snapshot) {
                var savedEvents = snapshot.child("amount").val();
                if(savedEvents == null){
                    eventRef.child("amount").set(1);
                    savedEvents = 1;
                } else {
                    eventRef.child("amount").set((savedEvents*1)+1);
                }
                canMoveToNextEvent = true;
            });
        }
    } else {
        setTimeout(moveToNextAthlete,500,$,html,index,final);
    }
    
}