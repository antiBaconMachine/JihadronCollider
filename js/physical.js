db.physical = {
		Collider        :    function(container, params) {
				container = jQuery(container);

				//TODO: don't hardcode widths
				var limit = container.offset();
				limit.bottom = limit.top + container.outerHeight() - 50;
				limit.right = limit.left + container.outerWidth() - 50;

				var self = this;
				var defaults = {
						stepSpeed : 16,
						friction : 0.03,
						minSpeed : 0.2,
						maxSpeed : 100,
						glideCancelTimeout : 100
				}
				params = jQuery.extend({},defaults,params);

				var interval;
				var isVolatile;

				var cache = new db.physical.Collider.ElementCache(params);
				var runTimes = [];
				
				var run = function() {
						var startTime = new Date();
						var items = jQuery("#items").children();
						var log = new db.physical.TestLog();
						isVolatile = false;

						var len = items.length;
						for(var i = 0; i < len; i++) {
								var e1 = cache.get(items.get(i));
								if (e1.projectile.isMoving()) {
										isVolatile = true

										move(e1);
										hitWall(e1);
										e1.projectile.applyFriction();

										for (var j=0; j < len; j++) {
												var e2 = cache.get(items.get(j));
												if (e1.equals(e2)) {
												//return;
												} else {
														if (!log.tested(e1,e2)) {
																//log.add(e1,e2);
																//db.log(db.LogLevel.DEBUG, "Testing %s against %s", e1.id, e2.id);
																if (self.intersects(e1,e2)) {
																		//db.log(db.LogLevel.DEBUG, "%o intersects %o", e1,e2);
																		tame(e1,e2);
																		react(e1,e2);
																}
														}
												}
										}
								}

						}
						runTimes.push(new Date().getTime()-startTime.getTime());
						if (!isVolatile) {
								self.stop();
						}
				};

					//Actual velocity swapping happens here
				var react = function(e1, e2) {
						if (e2) {
								var p1 = e1.projectile;
								var p2 = e2.projectile;
								var v1 = {
										x : p1.velocity.x,
										y : p1.velocity.y
								}

								p1.velocity.x = elasticCollision(p1.velocity.x, p2.velocity.x, p1.mass, p2.mass);
								p1.velocity.y = elasticCollision(p1.velocity.y, p2.velocity.y, p1.mass, p2.mass);

								p2.velocity.x = elasticCollision(p2.velocity.x, v1.x, p1.mass, p2.mass);
								p2.velocity.y = elasticCollision(p2.velocity.y, v1.y, p1.mass, p2.mass);

						}
				}
			
				var elasticCollision = function(u1, u2, m1, m2) {
						return (u1*(m1-m2) + (2*m2*u2))  / (m1+m2);
				}



				var move = function(e) {
						var proj = e.projectile;
						var pos = e.offset;
						e.saveOffset();

						var chooseInverse = function(s,max){
								return Math.max(s,max*-1)
						};
						var chooseX = proj.velocity.x >= 0 ? Math.min : chooseInverse;
						var chooseY = proj.velocity.y >= 0 ? Math.min : chooseInverse;

						pos.left = pos.left + chooseX(proj.velocity.x, params.maxSpeed);
						pos.top = pos.top + chooseY(proj.velocity.y, params.maxSpeed);

						//db.log(db.LogLevel.DEBUG, "position of %o is %o",e,coords);

						e.$element.offset(pos);
				}

				//essentially a run on from move
				var hitWall = function(e) {

						var hitX = true;
						var hitY = true;
						var switchX = false;
						var switchY = false;

						var fudge = 7;

						if(e.element.offsetLeft < limit.left) {
								e.offset.left = limit.left + fudge;
								//if (e.projectile.velocity.x < 0) switchX = true;
						}else if((e.element.offsetLeft) > limit.right) {
								e.offset.left = limit.right;
								//if (e.projectile.velocity.x > 0) switchX = true;
						} else {
								hitX = false;
						}

						if (e.element.offsetTop < limit.top) {
								e.offset.top = limit.top + fudge;
								//if (e.projectile.velocity.y < 0) switchY = true;
						} else if ((e.element.offsetTop ) > limit.bottom) {
								e.offset.top = limit.bottom;
								//if (e.projectile.velocity.y > 0) switchY = true;
						} else {
								hitY = false;
						}

						//db.log(db.LogLevel.INFO, "Hits x: %b y: %b",hitX,hitY);
						if (hitX) {
								e.projectile.velocity.x *= -1;
						}
						if (hitY) {
								e.projectile.velocity.y *= -1;
						}
						var hit =  hitX || hitY;
						if (hit) {
								e.$element.offset(e.offset);
						}
						return hit
				}

				/*When an item has passed into abother reset it to it's last position
				*hopefully this will happen fast enough that the user won;t notice
				*we're totally cheating :)
				*/
				var tame = function(e1, e2) {
								e1.offset = e1.lastOffset;
								e1.$element.offset(e1.offset);
				}

				var onDragInit = function(e) {
						return function(ev, dd) {
								dd.wrappedElement = self.getElement(e.get(0));
								dd.wrappedElement.projectile.velocity = {
										x:0,
										y:0
								};
						};
				};
				var onDrag = function(ev, dd) {
						dd.wrappedElement.projectile.update({
								x : dd.offsetX,
								y : dd.offsetY
						});
				};
				var onDragEnd = function(ev, dd) {
						dd.wrappedElement.projectile.calcVelocity();
						dd.wrappedElement.refresh();
						self.start();
				};


				//****PUBLIC COLLIDER FUNCTIONS*******//

				this.bindHandlers = function(args) {
						var initHandler = onDragInit(args.item)
						args.item.data("physicalDragInit",initHandler);
						args.item
						.drag("init", onDragInit(args.item))
						.drag(onDrag)
						.drag("end", onDragEnd)
				};
				this.unbindHandlers = function(args) {
						args.item
						.unbind("dragInit", args.item.data("physicalDragInit"))
						.unbind("drag", onDrag)
						.unbind("dragEnd", onDragEnd);
				}

				this.getElement = cache.get;

				this.calcMass = function(args) {
						var item = args.item;
						if (item) {
								var len = item.children().length;
								if (len) {
										//TODO DOM agnostic way of finding the correct element
										self.getElement(item.parent()).projectile.setMass(len);
								}
						}
				};

				this.step = function() {
						run();
				};
				this.start = function() {
						db.log(db.LogLevel.INFO, "GRID TESTING");
						
						if (!interval) {

								if (db.profile) {
								    console.profile("running collider");
								}
								interval = setInterval(run, params.stepSpeed);
						}
				};

				this.stop = function() {
						clearInterval(interval);
						interval = null;
						if (db.profile) {
				    console.profileEnd();
						}
						var len = runTimes.length;
						var av = 0;
						jQuery(runTimes).each(function(i,e) {
								av += runTimes[i];
						});
						av = av/len;
						db.log(db.LogLevel.INFO, "Collider has stopped, average pass time: %i (%ifps)",av,Math.round(1000/av));

				};

				this.intersects = function(e1, e2) {

						var o1 = e1.offset;
						var o2 = e2.offset;

						var x1 = o1.left, y1 = o1.top,
						w1 = e1.element.offsetWidth, h1 = e1.element.offsetHeight,
						x2 = o2.left, y2 = o2.top,
						w2 = e2.element.offsetWidth, h2 = e2.element.offsetHeight;

						return !(y2 + h2 < y1 || y1 + h1 < y2 || x2 + w2 < x1 || x1 + w1 < x2);
				};

				if (db.logLevel) {
						this.getElements = function() {
								return cache.getElements();
						}
				};

		},

		TestLog : function() {
				var tested= [];
				return {
						add : function(e1,e2) {
								if (!e1.id) e1.id = db.util.generateID("node");
								if (!e2.id) e2.id = db.util.generateID("node");

								if (!tested[e1.id]) {
										tested[e1.id] = [];
								}
								tested[e1.id][e2.id]=true;
						},
						tested : function(e1,e2) {
								if 
										(tested[e1.id] && tested[e1.id][e2.id])  {
										return true;
								}
								return false;
						},
						clear : function() {
								tested=[];
						}
				}
		}

}

db.physical.Collider.Projectile = function(element, params, velocity) {
		var history = [];
		var timeout;

		this.velocity = (velocity ? velocity :{
				x : 0,
				y : 0
		});

		this.applyFriction = function() {
				var f = (1-(params.friction * this.mass));
				if (f<0) f=0;

				this.velocity.x = this.velocity.x * f;
				this.velocity.y = this.velocity.y * f;
		};
		this.update = function(pos) {
				clearTimeout(timeout);
				history.push(pos);
				if (history.length > (200 / params.stepSpeed)) {
						history = history.slice(1);
				}
				timeout = setTimeout(function(){history=[]}, params.glideCancelTimeout);
		};
		this.calcVelocity = function() {
				if (history.length > 1) {
						this.velocity = this.averageSpeed(history);
				}
				db.log(db.LogLevel.DEBUG, "velocity is %i %i",this.velocity.x, this.velocity.y);
		};
		this.setMass = function(mass) {
				this.mass = mass //+ (Math.random()-0.5)/2;
		};
		this.isMoving = function() {
				return Math.abs(this.velocity.x) > params.minSpeed
				&& Math.abs(this.velocity.y) > params.minSpeed
		};
		this.averageSpeed = function(history) {
				var samples = history.length-1;
				var velocity = {
						x : 0,
						y : 0
				}
				if (samples) {
						velocity = ( function(head, tail, acc) {
								var nextHead = history.pop();
								velocity.x += (head.x - nextHead.x) / samples;
								velocity.y += (head.y - nextHead.y) / samples;
								if (tail.length) {
										return arguments.callee(nextHead,tail, velocity);
								}
								return velocity;
						}(history.pop(), history, velocity) )
				}
				return velocity;
		};

		this.setMass(1);
		element.data("physical",this);
};

db.physical.Collider.ElementCache = function(params) {
		var elements ={}

		this.get = function(element) {
				if (element.length) element = element[0];
				var id = element.id;
				if (!id) {
						id = db.util.generateID("node");
						element.id = id;
				}

				var we = elements[id];
				if (!we) {
						we = new db.physical.Collider.WrappedElement(element, params);
						elements[id] = we;
				}
				return we;
		}

		if (db.logLevel) {
				this.getElements = function() {
						return elements;
				}
		}
};


//TODO effective use of params
db.physical.Collider.WrappedElement = function(element, params){
		this.element = element;
		this.$element = jQuery(element);
		this.offset = this.$element.offset();
		this.lastOffset = this.offset;
		this.projectile = this.$element.data("physical");
		if(!this.projectile) {
				this.projectile = new db.physical.Collider.Projectile(this.$element, params);
		}
};
db.physical.Collider.WrappedElement.prototype = {
		refresh : function() {
				this.offset = this.$element.offset();
				this.lastOffset = this.offset;
				return this;
		},
		equals : function(w2) {
				return this.element === w2.element;
		},
		addOffset : function(of) {
				this.offset = {
						top : this.offset.top + of.top,
						left : this.offset.left + of.left
				}
				this.$element.offset(this.offset);
		},
		saveOffset : function() {
				this.lastOffset = {
						top : this.offset.top,
						left : this.offset.left
				}
		}
};
