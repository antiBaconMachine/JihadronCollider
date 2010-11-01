//Create db namespace and add logging functions
if(typeof db === "undefined") {
		var db={};
}
jQuery.extend(db, {

		LogLevel : {
				OFF   : 0,
				DEBUG : 8,
				INFO  : 6,
				WARN  : 4,
				ERROR : 2,
				FATAL : 1
		}
});

jQuery.extend(db, {

		logLevel     :   db.LogLevel.OFF,
		

		log   : function(level, msg) {
				var args = Array.prototype.slice.call(arguments, 1);
				db.logArray(level, args);
		},

		logSpecial  :   function(level, fnc, msg) {
				var args = Array.prototype.slice.call(arguments, 2);
				db.logArray(level, args, fnc);
		},

		logArray  : function(level, arrMsg, strFnc) {
				if(this.logLevel) {

						level = level || db.LogLevel.INFO;

						if (level <= this.logLevel) {
								var strLevel = db.getLogDescriptor(level).toLowerCase() || "info";
								strFnc = strFnc || strLevel;

								if(!(arrMsg instanceof Array)){
										arrMsg = [arrMsg];
								}
								if (strLevel === "fatal") {
										arrMsg[0] = strLevel+ " " + arrMsg[0];
										strFnc = "error";
								}

								this.attachConsole();

								if(typeof console[strFnc] !== "function") {
										strFnc = "info";
								}

								//IE console is made of objects not functions so we have to use the apply method out of place
								Function.prototype.apply.apply(console[strFnc], [console, arrMsg]);
																
						}
				}
		},

		getLogDescriptor : function(i) {
				var reverseLog = {};
				jQuery.each(db.LogLevel, function(k,v) {
						reverseLog[v]=k;
				});
				db.getLogDescriptor = function(i) {
						return reverseLog[i];
				};
				return reverseLog[i];
		},

		attachConsole : function(force) {
				if(force || (db.logLevel && typeof console === "undefined")){
						var head= document.getElementsByTagName('head')[0];
						var script= document.createElement('script');
						script.type= 'text/javascript';
						script.src= 'http://getfirebug.com/releases/lite/1.2/firebug-lite-compressed.js';
						head.appendChild(script);
						return true;
				}
				return false;
		},

		util : {
				getPageDimensions : function(){
						var dims = {};
						var ie=document.all && !window.opera;
						var domclientWidth=document.documentElement && parseInt(document.documentElement.clientWidth) || 100000; //Preliminary doc width in non IE browsers
						var standardbody=(document.compatMode=="CSS1Compat")? document.documentElement : document.body; //create reference to common "body" across doctypes

						dims.scrollTop = (ie)? standardbody.scrollTop : window.pageYOffset;
						dims.scrollLeft = (ie)? standardbody.scrollLeft : window.pageXOffset;
						dims.docWidth = (ie)? standardbody.clientWidth : (/Safari/i.test(navigator.userAgent))? window.innerWidth : Math.min(domclientWidth, window.innerWidth-16);
						dims.docHeight = (ie)? standardbody.clientHeight: window.innerHeight;
						dims.scrollHeight = Math.max(standardbody.scrollHeight,standardbody.offsetHeight);

						db.log(db.LogLevel.DEBUG, "page dimensions: %o", dims);
						return dims;
				},

				generateID : function(prefix) {
						prefix = prefix || "id";
						return prefix + "_" + new Date().getTime() + Math.floor(Math.random()*1000);
				},

				indexToAlpha : function(i) {
						return unescape("%" + parseInt(i+29, 16));
				},

				average : function(arr) {
						var len = arr.length;
						var acc = 0;
						for (var i = 0; i < len; i++) {
								acc += arr[i];
						}
						return acc / len;
				},

				getUrlParams : function() {
						var vars = {}, hash;
						var hashes = window.location.href.slice(window.location.href.indexOf('?') + 1).split('&');
						for(var i = hashes.length-1; i >= 0; i--)
						{
								hash = hashes[i].split('=');

								var val = hash[1];
								var intVal = parseInt(val);
								if (!isNaN(intVal)) {
										val = intVal;
								}else if (val==="true" || val==="false") {
										val = Boolean(val);
								}
								vars[hash[0]] = val;
						}
						return vars;
				}
		}
});

//Add equals method to jQuery
(function( $ ) {
		$.fn.equals = function (comparison) {
				if (comparison) {
						return (this.length === comparison.length)
						&& (this.length = this.filter(comparison).length);
				}
				return false;
		}
}(jQuery));

//@deprecated
var DEBUG = db.logLevel;
db.attachConsole();