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

		logLevel     :   db.LogLevel.DEBUG,
		
		profile						:			false,

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

				HookStore : function(hooks, globalArgs) {

						globalArgs = globalArgs || {};

						//The only reason this function exists is to keep the object extension out of the loop
						var startLoop = function(arr, scopedArgs) {
								scopedArgs = scopedArgs || {};
								return looper(arr, jQuery.extend({}, globalArgs, scopedArgs));
						};
						//recursive function to iterate the hooks in priority order
						var looper = function(arr, args) {
								if (arr.length) {
										var element = arr[0];
										if (typeof element === "object") {
												//Element is an array so walk it
												return continueProcessing(looper(element, args), arr, args);
										} else if (typeof element === "function") {
												//Element is a function so call it
												return continueProcessing(element.call(this, args), arr, args);
										} else {
												//Element is unusable (probably an undefined priority)
												return continueProcessing(true, arr, args);
										}
								} else {
										//array is empty
										return true;
								}
						}
						//Encapsulates the continuation logic which is called from more than one location in looper
						var continueProcessing = function(boo, arr, args) {
								if (boo) {
										//function indicated we should continue processing the hook chain
										return looper(arr.slice(1), args);
								} else {
										//function indicated no further hooks should be processed
										return false;
								}
						}

						var hookStore = {};
						if (hooks) {
								jQuery(hooks).each(function(i, e) {
										hookStore[e] =[];
								});
						}

						return {

								PRIORITY : {
										HIGHEST :   0,
										HIGH    :   2,
										MEDIUM  :   4,
										LOW     :   6,
										LOWEST  :   8
								},

								addHooks : function(hookMap, priority) {
										for (var key in hookMap) {
												this.addHook(key, hookMap[key], priority);
										}
								},
								
								addHook :   function(event, fn, priority) {
										if (!priority) {
												priority = this.PRIORITY.LOW;
										}
										var eventContainer = hookStore[event];
										if (!eventContainer) {
												db.log(db.LogLevel.WARN, "Hook container %s is undefined, creating",event);
												hookStore[event] = [];
												eventContainer = hookStore[event];
										}
										var container = eventContainer[priority];
										if (!container) {
												eventContainer[priority] = [];
												container = eventContainer[priority];
										}
										container.push(fn);
								},

								doHooks :   function(event, args) {
										var priorities = hookStore[event] || [];
										return startLoop(priorities, args);
								},

								setArgs :   function(args){
										args = args || {};
										jQuery.extend(globalArgs, args);
								}

						}
				}
		},

		Blocker : function() {
				var queue = [];
				var blocked = false;

				return {
						block : function(timeout) {
								blocked = true;
								if (timeout) {
										setTimeout(this.release, timeout);
								}
						},
						isBlocked : function() {
								return blocked;
						},
						release : function() {
								blocked = false;
								jQuery(queue).each(function(i,e) {
										e.fn.call(e.ctx);
								});
								queue = [];
						},
						doIfNotBlocked : function(fn, ctx) {
								ctx = ctx || window;
								if (!blocked) {
										fn.call(ctx);
										return true;
								}
								return false;
						},
						doWhenNotBlocked : function(fn, ctx) {
								ctx = ctx || window;
								if (!this.doIfNotBlocked(fn, ctx)) {
										queue.push({
												fn : fn,
												ctx : ctx
										});
								}
						}
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