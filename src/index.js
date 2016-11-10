'use strict';

var express = require('express');
var app = express();
var http = require('http').Server(app);
var io = require('socket.io')(http);
var firebaseAPI = require(__dirname+'/private/files/firebase.json');

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

//HOME ROUTE--
//      Should be what the user sees when they first arrive on the website
app.get("/",function(req,res){
    res.render("home.jade",{firebaseAPIData: JSON.stringify(firebaseAPI)});
});